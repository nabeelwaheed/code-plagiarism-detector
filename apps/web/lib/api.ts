"use client";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL
  ?? (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3001");

if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is required in production");
}

export interface LoginResponse {
  userId: string;
  email: string;
  role: "professor" | "student";
  expiresAt: string;
}

export interface AssignmentSummary {
  id: string;
  title: string;
  language: "java" | "c" | "cpp";
  professorId: string;
  createdAt: string;
  activeKey: string | null;
  submissionCounts: {
    current: number;
    historical: number;
  };
  latestComparisonRun: {
    id: string;
    status: string;
    createdAt: string;
    pairCount: number;
  } | null;
}

export interface AssignmentDetail {
  id: string;
  title: string;
  language: "java" | "c" | "cpp";
  professorId: string;
  createdAt: string;
  updatedAt: string;
  keys: Array<{
    id: string;
    publicKey: string;
    isActive: boolean;
    createdAt: string;
  }>;
  uploadBatches: Array<{
    id: string;
    purpose: string;
    status: string;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  submissions: Array<{
    id: string;
    displayName: string;
    kind: "current" | "historical";
    ownerId: string | null;
    createdAt: string;
    fileCount: number;
    sourceMap: Array<{
      filePath: string;
      byteStart: number;
      byteEnd: number;
    }>;
  }>;
  activeTemplate: {
    id: string;
    versionNumber: number;
    isActive: boolean;
    createdAt: string;
    fileCount: number;
  } | null;
  comparisonRuns: Array<{
    id: string;
    status: string;
    engineVersion: string;
    createdAt: string;
    completedAt: string | null;
    errorMessage: string | null;
    pairResults: Array<{
      id: string;
      similarityScore: number;
      commentScore: number | null;
      matchedTokenCount: number;
      leftSubmission: {
        id: string;
        displayName: string;
        kind: "current" | "historical";
      };
      rightSubmission: {
        id: string;
        displayName: string;
        kind: "current" | "historical";
      };
      matchCount: number;
    }>;
  }>;
}

export interface UploadBatchDetail {
  id: string;
  assignmentId: string;
  uploaderId: string;
  purpose: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  submissions: Array<{
    id: string;
    displayName: string;
    kind: string;
    createdAt: string;
  }>;
  templateVersions: Array<{
    id: string;
    versionNumber: number;
    isActive: boolean;
    createdAt: string;
  }>;
}

export interface PairDetailResponse {
  id: string;
  comparisonRunId: string;
  assignment: {
    id: string;
    title: string;
    language: "java" | "c" | "cpp";
  };
  similarityScore: number;
  commentScore: number | null;
  matchedTokenCount: number;
  leftSubmission: {
    id: string;
    displayName: string;
    kind: "current" | "historical";
    concatenatedSource: string;
    sourceMap: Array<{
      filePath: string;
      byteStart: number;
      byteEnd: number;
    }>;
    files: Array<{
      id: string;
      relativePath: string;
      canonicalOrder: number;
      byteStart: number;
      byteEnd: number;
      archivePath?: string;
    }>;
  };
  rightSubmission: PairDetailResponse["leftSubmission"];
  matches: Array<{
    matchId: string;
    kind: "code" | "comment";
    matchedTokenCount: number;
    left: {
      byteStart: number;
      byteEnd: number;
    };
    right: {
      byteStart: number;
      byteEnd: number;
    };
  }>;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function login(email: string, password: string) {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function listAssignments() {
  return apiFetch<AssignmentSummary[]>("/assignments");
}

export function createAssignment(input: {
  title: string;
  language: "java" | "c" | "cpp";
}) {
  return apiFetch<{
    id: string;
    title: string;
    language: "java" | "c" | "cpp";
    professorId: string;
    keys: Array<{ publicKey: string }>;
  }>("/assignments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getAssignment(assignmentId: string) {
  return apiFetch<AssignmentDetail>(`/assignments/${assignmentId}`);
}

export function createComparisonRun(assignmentId: string) {
  return apiFetch<{ id: string }>("/comparison-runs", {
    method: "POST",
    body: JSON.stringify({ assignmentId }),
  });
}

export function getPairResult(pairResultId: string) {
  return apiFetch<PairDetailResponse>(`/comparison-runs/pair/${pairResultId}`);
}

export function getUploadBatch(uploadBatchId: string) {
  return apiFetch<UploadBatchDetail>(`/uploads/${uploadBatchId}`);
}

export async function uploadProfessorArchive(input: {
  assignmentId: string;
  purpose: "historical_submission" | "template_upload";
  file: File;
}) {
  const body = new FormData();
  body.append("assignmentId", input.assignmentId);
  body.append("purpose", input.purpose);
  body.append("file", input.file);

  return apiFetch<{ id: string; status: string }>("/uploads/archive", {
    method: "POST",
    body,
  });
}

export async function uploadStudentArchive(input: {
  assignmentKey: string;
  file: File;
}) {
  const body = new FormData();
  body.append("assignmentKey", input.assignmentKey);
  body.append("file", input.file);

  return apiFetch<{
    assignmentId: string;
    assignmentLanguage: "java" | "c" | "cpp";
    uploadBatchId: string;
  }>("/uploads/student/archive", {
    method: "POST",
    body,
  });
}

export function getCurrentUser() {
  return apiFetch<{
    userId: string;
    email: string;
    role: "professor" | "student";
  }>("/auth/me");
}

export function logout() {
  return apiFetch<{ ok: boolean }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
