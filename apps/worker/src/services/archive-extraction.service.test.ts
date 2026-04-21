import assert from "node:assert/strict";
import test from "node:test";
import { zipSync } from "fflate";
import { extractSourceFilesFromSubmissionArchive } from "./archive-extraction.service.ts";

test("extractSourceFilesFromSubmissionArchive ignores junk entries in a java submission archive", () => {
  const archiveBuffer = Buffer.from(
    zipSync({
      "__MACOSX/Foo.java": Buffer.from("class Junk {}\n"),
      ".DS_Store": Buffer.from("junk"),
      "Thumbs.db": Buffer.from("junk"),
      "._Main.java": Buffer.from("class Shadow {}\n"),
      "Student1.java": Buffer.from("class Student1 {}\n"),
    }),
  );

  const files = extractSourceFilesFromSubmissionArchive({
    assignmentLanguage: "java",
    archiveBuffer,
  });

  assert.deepEqual(
    files.map((file) => file.relativePath),
    ["Student1.java"],
  );
});

test("extractSourceFilesFromSubmissionArchive ignores junk entries in a cpp submission archive", () => {
  const archiveBuffer = Buffer.from(
    zipSync({
      "__MACOSX/nested/Bar.cpp": Buffer.from("int junk() { return 0; }\n"),
      "src/RealFile.cpp": Buffer.from("int real() { return 1; }\n"),
    }),
  );

  const files = extractSourceFilesFromSubmissionArchive({
    assignmentLanguage: "cpp",
    archiveBuffer,
  });

  assert.deepEqual(
    files.map((file) => file.relativePath),
    ["src/RealFile.cpp"],
  );
});

test("extractSourceFilesFromSubmissionArchive applies the junk filter case-insensitively where intended", () => {
  const archiveBuffer = Buffer.from(
    zipSync({
      "__macosx/Lower.java": Buffer.from("class Lower {}\n"),
      ".ds_store": Buffer.from("junk"),
      "Thumbs.DB": Buffer.from("junk"),
      "Real.java": Buffer.from("class Real {}\n"),
    }),
  );

  const files = extractSourceFilesFromSubmissionArchive({
    assignmentLanguage: "java",
    archiveBuffer,
  });

  assert.deepEqual(
    files.map((file) => file.relativePath),
    ["Real.java"],
  );
});

test("extractSourceFilesFromSubmissionArchive accepts mixed-case source extensions", () => {
  const archiveBuffer = Buffer.from(
    zipSync({
      "Main.JAVA": Buffer.from("class Main {}\n"),
      "nested/Solver.CPP": Buffer.from("int solve() { return 1; }\n"),
      "include/Util.H": Buffer.from("int util();\n"),
    }),
  );

  const javaFiles = extractSourceFilesFromSubmissionArchive({
    assignmentLanguage: "java",
    archiveBuffer,
  });
  const cppFiles = extractSourceFilesFromSubmissionArchive({
    assignmentLanguage: "cpp",
    archiveBuffer,
  });

  assert.deepEqual(
    javaFiles.map((file) => file.relativePath),
    ["Main.JAVA"],
  );
  assert.deepEqual(
    cppFiles.map((file) => file.relativePath),
    ["include/Util.H", "nested/Solver.CPP"],
  );
});
