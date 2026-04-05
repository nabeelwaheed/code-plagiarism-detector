"use client";

import type { SubmissionIdentityPublicKeyResponse } from "./submission-identity";

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
  uploaderId: string | null;
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

export interface PublicUploadBatchDetail {
  id: string;
  assignmentId: string;
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
    identityRevealMode?: "encrypted" | "display_name" | null;
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

export interface AssignmentArtifactDetail {
  id: string;
  displayName: string;
  kind: "current" | "historical" | "template";
  versionNumber?: number;
  createdAt: string;
  hasEncryptedIdentity?: boolean;
  identityRevealMode?: "encrypted" | "display_name" | null;
  fileCount: number;
  concatenatedSource: string;
  sourceMap: Array<{
    filePath: string;
    byteStart: number;
    byteEnd: number;
  }>;
  files: Array<{
    id: string;
    relativePath: string;
    archivePath?: string;
    contents: string;
  }>;
}

export interface SubmissionIdentityRevealResponse {
  studentName: string;
  studentNumber: string | null;
  studentEmail: string | null;
  assignmentKey: string | null;
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
    throw new Error(await getUserFacingApiErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function getUserFacingApiErrorMessage(response: Response) {
  const fallbackMessage = getFallbackApiErrorMessage(response.status);

  if (response.status >= 500) {
    return fallbackMessage;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const text = (await response.text()).trim();
    return text || fallbackMessage;
  }

  try {
    const body = (await response.json()) as { message?: unknown };
    const message = normalizeApiErrorMessage(body.message);
    return message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function normalizeApiErrorMessage(message: unknown) {
  if (typeof message === "string") {
    return message.trim() || null;
  }

  if (Array.isArray(message)) {
    const firstMessage = message.find((value): value is string => typeof value === "string");
    return firstMessage?.trim() || null;
  }

  return null;
}

function getFallbackApiErrorMessage(status: number) {
  if (status === 400) {
    return "We couldn't complete that request. Please check your input and try again.";
  }

  if (status === 401) {
    return "Please sign in and try again.";
  }

  if (status === 403) {
    return "You do not have permission to do that.";
  }

  if (status === 404) {
    return "The requested item could not be found.";
  }

  return "Something went wrong on the server. Please try again.";
}

export function login(email: string, password: string) {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function signupProfessor(email: string, password: string) {
  return apiFetch<LoginResponse>("/auth/professor-signup", {
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

export async function uploadPublicStudentArchive(input: {
  assignmentKey: string;
  encryptedIdentity: string;
  file: File;
}) {
  const body = new FormData();
  body.append("assignmentKey", input.assignmentKey.trim());
  body.append("encryptedIdentity", input.encryptedIdentity);
  body.append("file", input.file, "submission.zip");

  return apiFetch<{
    assignmentId: string;
    assignmentLanguage: "java" | "c" | "cpp";
    uploadBatchId: string;
    statusToken: string;
  }>("/uploads/public/student/archive", {
    method: "POST",
    body,
  });
}

export async function uploadPublicBulkStudentArchive(input: {
  assignmentKey: string;
  file: File;
}) {
  const body = new FormData();
  body.append("assignmentKey", input.assignmentKey.trim());
  body.append("file", input.file, "bulk-current-submissions.zip");

  return apiFetch<{
    assignmentId: string;
    assignmentLanguage: "java" | "c" | "cpp";
    uploadBatchId: string;
    statusToken: string;
  }>("/uploads/public/student/bulk-archive", {
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

export function getSubmissionIdentityPublicKey() {
  return apiFetch<SubmissionIdentityPublicKeyResponse>("/uploads/public/identity-key");
}

export function getPublicUploadBatch(uploadBatchId: string, token: string) {
  const query = new URLSearchParams({ token });
  return apiFetch<PublicUploadBatchDetail>(`/uploads/public/${uploadBatchId}?${query.toString()}`);
}

export function logout() {
  return apiFetch<{ ok: boolean }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getAssignmentSubmissionDetail(assignmentId: string, submissionId: string) {
  return apiFetch<AssignmentArtifactDetail>(
    `/uploads/assignment/${assignmentId}/submissions/${submissionId}`,
  );
}

export function revealAssignmentSubmissionIdentity(assignmentId: string, submissionId: string) {
  return apiFetch<SubmissionIdentityRevealResponse>(
    `/uploads/assignment/${assignmentId}/submissions/${submissionId}/identity`,
  );
}

export function getAssignmentTemplateDetail(assignmentId: string, templateId: string) {
  return apiFetch<AssignmentArtifactDetail>(
    `/uploads/assignment/${assignmentId}/templates/${templateId}`,
  );
}

export function downloadAssignmentSubmission(assignmentId: string, submissionId: string) {
  return downloadApiFile(
    `/uploads/assignment/${assignmentId}/submissions/${submissionId}/download`,
    `${submissionId}.zip`,
  );
}

export function downloadAssignmentTemplate(assignmentId: string, templateId: string) {
  return downloadApiFile(
    `/uploads/assignment/${assignmentId}/templates/${templateId}/download`,
    `${templateId}.zip`,
  );
}

export function downloadAllAssignmentSubmissions(assignmentId: string) {
  return downloadApiFile(`/uploads/assignment/${assignmentId}/download`, `${assignmentId}-submissions.zip`);
}

async function downloadApiFile(path: string, fallbackFileName: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await getUserFacingApiErrorMessage(response));
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = getDownloadFileName(response.headers.get("content-disposition"), fallbackFileName);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

function getDownloadFileName(contentDisposition: string | null, fallbackFileName: string) {
  if (!contentDisposition) {
    return fallbackFileName;
  }

  const match = /filename="([^"]+)"/i.exec(contentDisposition);
  if (!match?.[1]) {
    return fallbackFileName;
  }

  return match[1];
}
