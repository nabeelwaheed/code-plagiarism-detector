import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createObjectKey,
  createStagedObjectKey,
  deleteObject,
  promoteStagedObject,
  readObjectBuffer,
  writeObjectStream,
} from "./storage.js";

test("writeObjectStream persists a staged upload that can be promoted to a final object", async () => {
  const originalRoot = process.env.OBJECT_STORAGE_ROOT;
  const tempRoot = await mkdtemp(join(tmpdir(), "similarity-storage-test-"));
  process.env.OBJECT_STORAGE_ROOT = tempRoot;

  try {
    const stagedObjectKey = createStagedObjectKey("bulk-current-submissions.zip");
    const finalObjectKey = createObjectKey("raw/assignment-1/bulk_student_submission", "bulk-current-submissions.zip");

    await writeObjectStream(stagedObjectKey, Readable.from([Buffer.from("chunk-1"), Buffer.from("chunk-2")]));
    await promoteStagedObject(stagedObjectKey, finalObjectKey);

    await assert.rejects(() => access(join(tempRoot, ...stagedObjectKey.split("/"))));
    const finalContents = await readObjectBuffer(finalObjectKey);
    assert.equal(finalContents.toString("utf8"), "chunk-1chunk-2");
  } finally {
    if (originalRoot === undefined) {
      delete process.env.OBJECT_STORAGE_ROOT;
    } else {
      process.env.OBJECT_STORAGE_ROOT = originalRoot;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("writeObjectStream removes a staged file when the incoming stream fails", async () => {
  const originalRoot = process.env.OBJECT_STORAGE_ROOT;
  const tempRoot = await mkdtemp(join(tmpdir(), "similarity-storage-test-"));
  process.env.OBJECT_STORAGE_ROOT = tempRoot;

  const failingStream = Readable.from((async function* () {
    yield Buffer.from("partial");
    throw new Error("stream interrupted");
  })());

  try {
    const stagedObjectKey = createStagedObjectKey("submission.zip");

    await assert.rejects(
      () => writeObjectStream(stagedObjectKey, failingStream),
      /stream interrupted/,
    );

    await assert.rejects(() => readObjectBuffer(stagedObjectKey));
    assert.deepEqual(await readdir(tempRoot), []);
  } finally {
    if (originalRoot === undefined) {
      delete process.env.OBJECT_STORAGE_ROOT;
    } else {
      process.env.OBJECT_STORAGE_ROOT = originalRoot;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("promoteStagedObject rejects non-staged object keys", async () => {
  await assert.rejects(
    () => promoteStagedObject("raw/not-staged/file.zip", "raw/assignment/final.zip"),
    /cannot promote non-staged object key/,
  );
});

test("deleteObject can remove a promoted object after cleanup", async () => {
  const originalRoot = process.env.OBJECT_STORAGE_ROOT;
  const tempRoot = await mkdtemp(join(tmpdir(), "similarity-storage-test-"));
  process.env.OBJECT_STORAGE_ROOT = tempRoot;

  try {
    const stagedObjectKey = createStagedObjectKey("submission.zip");
    const finalObjectKey = createObjectKey("raw/assignment-1/student_submission", "submission.zip");

    await writeObjectStream(stagedObjectKey, Readable.from([Buffer.from("hello")]));
    await promoteStagedObject(stagedObjectKey, finalObjectKey);
    await deleteObject(finalObjectKey);

    await assert.rejects(() => readObjectBuffer(finalObjectKey));
  } finally {
    if (originalRoot === undefined) {
      delete process.env.OBJECT_STORAGE_ROOT;
    } else {
      process.env.OBJECT_STORAGE_ROOT = originalRoot;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});
