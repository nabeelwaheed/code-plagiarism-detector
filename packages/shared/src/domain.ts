export type UserRole = "professor" | "student";

export type AssignmentLanguage = "java" | "c" | "cpp";

export type UploadPurpose =
  | "student_submission"
  | "historical_submission"
  | "template_upload";

export type SubmissionKind = "current" | "historical";

export type MatchKind = "code" | "comment";

export interface SourceMapEntry {
  filePath: string;
  byteStart: number;
  byteEnd: number;
}

export interface PreparedSubmissionRecord {
  submissionId: string;
  kind: SubmissionKind;
  displayName: string;
  concatenatedSource: string;
  sourceMap: SourceMapEntry[];
}

export interface PairGenerationCandidate {
  submissionId: string;
  kind: SubmissionKind;
}

