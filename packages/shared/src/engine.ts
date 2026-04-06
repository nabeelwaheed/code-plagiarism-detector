import type {
  AssignmentLanguage,
  MatchKind,
  SourceMapEntry,
  SubmissionKind,
} from "./domain.js";

export interface EngineSubmissionPayload {
  submissionId: string;
  submissionKind: SubmissionKind;
  source: string;
  sourceMap: SourceMapEntry[];
}

export interface EngineTemplatePayload {
  source: string;
  sourceMap: SourceMapEntry[];
}

export interface EnginePairPayload {
  pairId: string;
  leftSubmissionId: string;
  rightSubmissionId: string;
}

export interface EngineRunRequest {
  schemaVersion: "1.0";
  engineVersion: string;
  language: AssignmentLanguage;
  submissions: EngineSubmissionPayload[];
  template?: EngineTemplatePayload;
  pairs: EnginePairPayload[];
  params: {
    gstMinMatchLength: number;
    minimumCommentLength: number;
  };
}

export interface CanonicalMatchSpan {
  byteStart: number;
  byteEnd: number;
  filePath?: string;
  position?: {
    lineStart: number;
    columnStart: number;
    lineEnd: number;
    columnEnd: number;
  };
  tokens?: {
    tokenStart: number;
    tokenEnd: number;
  };
}

export interface ViewerMatch {
  matchId: string;
  kind: MatchKind;
  left: CanonicalMatchSpan;
  right: CanonicalMatchSpan;
  matchedTokenCount: number;
}

export interface EnginePairResult {
  pairId: string;
  leftSubmissionId: string;
  rightSubmissionId: string;
  similarityScore: number;
  matchedTokenCount: number;
  matches: ViewerMatch[];
}

export interface EngineRunResponse {
  schemaVersion: "1.0";
  engineVersion: string;
  language: AssignmentLanguage;
  pairResults: EnginePairResult[];
}

