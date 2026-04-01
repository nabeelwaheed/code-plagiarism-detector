import type { AssignmentLanguage, ExtractedSourceFile, PreparedConcatenation } from "@similarity/shared";

export const LANGUAGE_SUFFIXES: Record<AssignmentLanguage, string[]> = {
  java: [".java"],
  c: [".c", ".h"],
  cpp: [".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx", ".h"],
};

export function selectRelevantSourceFiles(
  language: AssignmentLanguage,
  files: ExtractedSourceFile[],
): ExtractedSourceFile[] {
  const allowedSuffixes = LANGUAGE_SUFFIXES[language];
  return files
    .filter((file) => allowedSuffixes.some((suffix) => file.relativePath.endsWith(suffix)))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function buildDeterministicConcatenation(
  language: AssignmentLanguage,
  files: ExtractedSourceFile[],
): PreparedConcatenation {
  const relevantFiles = selectRelevantSourceFiles(language, files);

  if (relevantFiles.length === 0) {
    throw new Error(`no relevant ${language} source files found after extraction`);
  }

  let source = "";
  const sourceMap: PreparedConcatenation["sourceMap"] = [];

  for (const file of relevantFiles) {
    const byteStart = Buffer.byteLength(source, "utf8");
    const contents = file.contents.endsWith("\n") ? file.contents : `${file.contents}\n`;
    source += contents;
    const byteEnd = Buffer.byteLength(source, "utf8");
    sourceMap.push({
      filePath: file.relativePath,
      byteStart,
      byteEnd,
    });
  }

  return { source, sourceMap };
}
