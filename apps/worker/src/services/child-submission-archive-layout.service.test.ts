import assert from "node:assert/strict";
import test from "node:test";
import type { ArchiveEntryDescriptor } from "@similarity/shared";
import { resolveChildSubmissionZipPaths } from "./child-submission-archive-layout.service";

function file(relativePath: string): ArchiveEntryDescriptor {
  return {
    relativePath,
    isDirectory: false,
  };
}

function directory(relativePath: string): ArchiveEntryDescriptor {
  return {
    relativePath,
    isDirectory: true,
  };
}

test("resolveChildSubmissionZipPaths ignores mixed-case root junk entries for bulk current archives", () => {
  const childZipPaths = resolveChildSubmissionZipPaths({
    archiveKind: "bulk_current",
    entries: [
      directory("__macosx"),
      file(".ds_store"),
      file("thumbs.db"),
      file("._Student1.zip"),
      file("Student1.zip"),
      file("Student2.ZIP"),
    ],
  });

  assert.deepEqual(childZipPaths, ["Student1.zip", "Student2.ZIP"]);
});

test("resolveChildSubmissionZipPaths ignores mixed-case wrapper junk entries without affecting child zip detection", () => {
  const childZipPaths = resolveChildSubmissionZipPaths({
    archiveKind: "bulk_current",
    entries: [
      directory("Folder"),
      directory("Folder/__MACOSX"),
      file("Folder/.DS_Store"),
      file("Folder/Thumbs.DB"),
      file("Folder/._Student3.zip"),
      file("Folder/Student3.zip"),
      file("Folder/Student4.zip"),
    ],
  });

  assert.deepEqual(childZipPaths, ["Folder/Student3.zip", "Folder/Student4.zip"]);
});
