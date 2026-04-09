import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyRequest } from "fastify";
import { readObjectBuffer } from "@similarity/shared";
import { readMultipartArchiveRequest } from "./submissions.controller.js";

test("readMultipartArchiveRequest streams a multipart archive to staged storage even when fields arrive after the file", async () => {
  const originalRoot = process.env.OBJECT_STORAGE_ROOT;
  const tempRoot = await mkdtemp(join(tmpdir(), "similarity-api-upload-"));
  process.env.OBJECT_STORAGE_ROOT = tempRoot;

  try {
    const request = createMultipartRequest([
      {
        type: "file",
        fieldname: "file",
        filename: "bulk-current-submissions.zip",
        file: createReadableStream([Buffer.from("child-zip-contents")]),
      },
      {
        type: "field",
        fieldname: "assignmentKey",
        value: " COSC4P02-A1 ",
      },
    ]);

    const result = await readMultipartArchiveRequest(request, ["assignmentKey"]);

    assert.equal(result.fileName, "bulk-current-submissions.zip");
    assert.equal(result.fields.assignmentKey, " COSC4P02-A1 ");
    assert.match(result.stagedObjectKey, /^_staging\/uploads\//);
    assert.equal(
      (await readObjectBuffer(result.stagedObjectKey)).toString("utf8"),
      "child-zip-contents",
    );
  } finally {
    if (originalRoot === undefined) {
      delete process.env.OBJECT_STORAGE_ROOT;
    } else {
      process.env.OBJECT_STORAGE_ROOT = originalRoot;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("readMultipartArchiveRequest cleans up staged files when the uploaded archive exceeds the file-size limit", async () => {
  const originalRoot = process.env.OBJECT_STORAGE_ROOT;
  const tempRoot = await mkdtemp(join(tmpdir(), "similarity-api-upload-"));
  process.env.OBJECT_STORAGE_ROOT = tempRoot;

  try {
    const oversizedStream = createReadableStream([Buffer.from("oversized")]);
    oversizedStream.truncated = true;

    const request = createMultipartRequest([
      {
        type: "field",
        fieldname: "assignmentKey",
        value: "a1",
      },
      {
        type: "file",
        fieldname: "file",
        filename: "bulk-current-submissions.zip",
        file: oversizedStream,
      },
    ]);

    await assert.rejects(
      () => readMultipartArchiveRequest(request, ["assignmentKey"]),
      request.server.multipartErrors.RequestFileTooLargeError,
    );
    assert.equal((await listFiles(tempRoot)).length, 0);
  } finally {
    if (originalRoot === undefined) {
      delete process.env.OBJECT_STORAGE_ROOT;
    } else {
      process.env.OBJECT_STORAGE_ROOT = originalRoot;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("readMultipartArchiveRequest cleans up staged files when the upload stream fails", async () => {
  const originalRoot = process.env.OBJECT_STORAGE_ROOT;
  const tempRoot = await mkdtemp(join(tmpdir(), "similarity-api-upload-"));
  process.env.OBJECT_STORAGE_ROOT = tempRoot;

  try {
    const failingStream = new Readable({
      read() {
        this.push(Buffer.from("partial"));
        this.destroy(new Error("socket closed"));
      },
    }) as Readable & { truncated?: boolean };
    failingStream.truncated = false;

    const request = createMultipartRequest([
      {
        type: "field",
        fieldname: "assignmentKey",
        value: "a1",
      },
      {
        type: "file",
        fieldname: "file",
        filename: "bulk-current-submissions.zip",
        file: failingStream,
      },
    ]);

    await assert.rejects(
      () => readMultipartArchiveRequest(request, ["assignmentKey"]),
      /socket closed/,
    );
    assert.equal((await listFiles(tempRoot)).length, 0);
  } finally {
    if (originalRoot === undefined) {
      delete process.env.OBJECT_STORAGE_ROOT;
    } else {
      process.env.OBJECT_STORAGE_ROOT = originalRoot;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});

function createMultipartRequest(parts: Array<Record<string, unknown>>) {
  class RequestFileTooLargeError extends Error {}

  return {
    parts: async function* () {
      for (const part of parts) {
        yield part;
      }
    },
    server: {
      multipartErrors: {
        RequestFileTooLargeError,
      },
    },
  } as unknown as FastifyRequest & {
    server: {
      multipartErrors: {
        RequestFileTooLargeError: typeof RequestFileTooLargeError;
      };
    };
  };
}

function createReadableStream(chunks: Buffer[]) {
  const stream = Readable.from(chunks) as Readable & { truncated?: boolean };
  stream.truncated = false;
  return stream;
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}
