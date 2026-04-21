import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeterministicConcatenation,
  matchesLanguageSourceSuffix,
  selectRelevantSourceFiles,
} from "./concat.service.ts";

test("matchesLanguageSourceSuffix and concatenation treat source suffixes case-insensitively", () => {
  assert.equal(matchesLanguageSourceSuffix("java", "Main.JAVA"), true);
  assert.equal(matchesLanguageSourceSuffix("cpp", "solver.CPP"), true);
  assert.equal(matchesLanguageSourceSuffix("cpp", "util.H"), true);
  assert.equal(matchesLanguageSourceSuffix("c", "main.C"), true);

  const javaFiles = selectRelevantSourceFiles("java", [
    { relativePath: "Main.JAVA", contents: "class Main {}\n" },
  ]);
  const cppFiles = selectRelevantSourceFiles("cpp", [
    { relativePath: "solver.CPP", contents: "int solve() { return 1; }\n" },
    { relativePath: "util.H", contents: "int util();\n" },
  ]);

  assert.deepEqual(javaFiles.map((file) => file.relativePath), ["Main.JAVA"]);
  assert.deepEqual(cppFiles.map((file) => file.relativePath), ["solver.CPP", "util.H"]);

  const javaConcatenation = buildDeterministicConcatenation("java", [
    { relativePath: "Main.JAVA", contents: "class Main {}\n" },
  ]);
  const cppConcatenation = buildDeterministicConcatenation("cpp", [
    { relativePath: "solver.CPP", contents: "int solve() { return 1; }\n" },
    { relativePath: "util.H", contents: "int util();\n" },
  ]);

  assert.equal(javaConcatenation.source.includes("class Main"), true);
  assert.deepEqual(
    cppConcatenation.sourceMap.map((entry) => entry.filePath),
    ["solver.CPP", "util.H"],
  );
});
