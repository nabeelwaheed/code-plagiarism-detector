import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync } from "fflate";
import { prepareBulkCurrentSubmissionArtifacts } from "./prepare-upload-artifacts.service.ts";

function createZipBuffer(entries: Record<string, Buffer>) {
  return Buffer.from(zipSync(entries));
}

async function withTempObjectStorageRoot(fn: () => Promise<void>) {
  const originalRoot = process.env.OBJECT_STORAGE_ROOT;
  const tempRoot = await mkdtemp(join(tmpdir(), "similarity-worker-"));
  process.env.OBJECT_STORAGE_ROOT = tempRoot;

  try {
    await fn();
  } finally {
    if (originalRoot === undefined) {
      delete process.env.OBJECT_STORAGE_ROOT;
    } else {
      process.env.OBJECT_STORAGE_ROOT = originalRoot;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
}

test("prepareBulkCurrentSubmissionArtifacts keeps valid children and warns when one child has no supported files", async () => {
  await withTempObjectStorageRoot(async () => {
    const parentArchive = createZipBuffer({
      "BadChild.zip": createZipBuffer({
        "notes.txt": Buffer.from("not source\n"),
      }),
      "GoodChild.zip": createZipBuffer({
        "Main.JAVA": Buffer.from("class Main {}\n"),
      }),
    });

    const result = await prepareBulkCurrentSubmissionArtifacts({
      assignmentId: "assignment-1",
      assignmentLanguage: "java",
      uploadBatchId: "batch-1",
      archiveBuffer: parentArchive,
    });

    assert.equal(result.submissions.length, 1);
    assert.equal(result.submissions[0]?.displayName, "GoodChild");
    assert.equal(result.skippedSubmissionCount, 1);
    assert.equal(
      result.warningMessage,
      "1 submission was skipped because it contained no supported source files for this assignment language.",
    );
  });
});

test("prepareBulkCurrentSubmissionArtifacts fails when all child zips lack supported files", async () => {
  await withTempObjectStorageRoot(async () => {
    const parentArchive = createZipBuffer({
      "Child1.zip": createZipBuffer({
        "notes.txt": Buffer.from("not source\n"),
      }),
      "Child2.zip": createZipBuffer({
        "README.md": Buffer.from("still not source\n"),
      }),
    });

    await assert.rejects(
      () => prepareBulkCurrentSubmissionArtifacts({
        assignmentId: "assignment-1",
        assignmentLanguage: "java",
        uploadBatchId: "batch-1",
        archiveBuffer: parentArchive,
      }),
      /no relevant java source files found in uploaded archive/i,
    );
  });
});

test("prepareBulkCurrentSubmissionArtifacts ignores skipped children when checking duplicate sanitized names", async () => {
  await withTempObjectStorageRoot(async () => {
    const parentArchive = createZipBuffer({
      "Student#1.zip": createZipBuffer({
        "notes.txt": Buffer.from("not source\n"),
      }),
      "Student-1.zip": createZipBuffer({
        "Main.java": Buffer.from("class Main {}\n"),
      }),
    });

    const result = await prepareBulkCurrentSubmissionArtifacts({
      assignmentId: "assignment-1",
      assignmentLanguage: "java",
      uploadBatchId: "batch-1",
      archiveBuffer: parentArchive,
    });

    assert.equal(result.submissions.length, 1);
    assert.equal(result.submissions[0]?.displayName, "Student-1");
    assert.equal(result.skippedSubmissionCount, 1);
  });
});

test("prepareBulkCurrentSubmissionArtifacts still fails on duplicate names among kept children", async () => {
  await withTempObjectStorageRoot(async () => {
    const parentArchive = createZipBuffer({
      "Student#1.zip": createZipBuffer({
        "Main.java": Buffer.from("class First {}\n"),
      }),
      "Student-1.zip": createZipBuffer({
        "Main.java": Buffer.from("class Second {}\n"),
      }),
    });

    await assert.rejects(
      () => prepareBulkCurrentSubmissionArtifacts({
        assignmentId: "assignment-1",
        assignmentLanguage: "java",
        uploadBatchId: "batch-1",
        archiveBuffer: parentArchive,
      }),
      /bulk current archive contains duplicate submission names after sanitization/i,
    );
  });
});

test("prepareBulkCurrentSubmissionArtifacts keeps other failure modes strict", async () => {
  await withTempObjectStorageRoot(async () => {
    const parentArchive = createZipBuffer({
      "Broken.zip": Buffer.from("not actually a zip"),
      "Good.zip": createZipBuffer({
        "Main.java": Buffer.from("class Main {}\n"),
      }),
    });

    await assert.rejects(
      () => prepareBulkCurrentSubmissionArtifacts({
        assignmentId: "assignment-1",
        assignmentLanguage: "java",
        uploadBatchId: "batch-1",
        archiveBuffer: parentArchive,
      }),
      /failed to read zip archive:/i,
    );
  });
});
