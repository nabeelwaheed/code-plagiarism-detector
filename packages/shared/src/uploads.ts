import type { AssignmentLanguage, SubmissionKind } from "./domain.js";

export interface ArchiveEntryDescriptor {
  relativePath: string;
  isDirectory: boolean;
}

export interface ExtractedSourceFile {
  relativePath: string;
  archivePath?: string;
  contents: string;
}

export interface HistoricalSubmissionBoundary {
  childZipPath: string;
  submissionKey: string;
}

export interface PreparedConcatenation {
  source: string;
  sourceMap: Array<{
    filePath: string;
    byteStart: number;
    byteEnd: number;
  }>;
}

export interface SubmissionPreparationInput {
  assignmentLanguage: AssignmentLanguage;
  kind: SubmissionKind;
  extractedFiles: ExtractedSourceFile[];
}
