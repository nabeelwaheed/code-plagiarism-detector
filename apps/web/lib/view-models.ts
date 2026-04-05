"use client";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "brand";

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export function formatLanguageLabel(language: "java" | "c" | "cpp") {
  if (language === "cpp") {
    return "C++";
  }

  return language.toUpperCase();
}

export function formatUploadPurpose(purpose: string) {
  if (purpose === "historical_submission") {
    return "Historical submissions";
  }

  if (purpose === "template_upload") {
    return "Template code";
  }

  return capitalizeLabel(purpose.replace(/[_-]+/g, " "));
}

export function formatStatusLabel(status: string) {
  return capitalizeLabel(status.replace(/[_-]+/g, " "));
}

export function getStatusTone(status?: string | null): StatusTone {
  const normalized = status?.toLowerCase() ?? "";

  if (!normalized) {
    return "neutral";
  }

  if (
    normalized.includes("ready")
    || normalized.includes("completed")
    || normalized.includes("active")
  ) {
    return "success";
  }

  if (normalized.includes("failed")) {
    return "danger";
  }

  if (
    normalized.includes("running")
    || normalized.includes("processing")
    || normalized.includes("queued")
  ) {
    return "warning";
  }

  return "neutral";
}

export function getUploadSummary(status: string, errorMessage: string | null) {
  if (errorMessage) {
    return summarizeMessage(errorMessage, "There was a problem with this upload.");
  }

  const normalized = status.toLowerCase();

  if (normalized === "ready" || normalized === "completed") {
    return "This upload finished successfully.";
  }

  if (normalized === "failed") {
    return "This upload did not finish successfully.";
  }

  if (normalized === "queued") {
    return "This upload is waiting to be processed.";
  }

  if (normalized === "processing" || normalized === "running") {
    return "This upload is still being processed.";
  }

  return "Status updated.";
}

export function formatSimilarityPercent(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return `${(value * 100).toFixed(1)}%`;
}

export function getRiskLabel(value: number | null) {
  if (value === null) {
    return "No comment score";
  }

  if (value >= 0.75) {
    return "High review priority";
  }

  if (value >= 0.5) {
    return "Needs review";
  }

  if (value >= 0.25) {
    return "Moderate overlap";
  }

  return "Low overlap";
}

export function getRiskTone(value: number | null): StatusTone {
  if (value === null) {
    return "neutral";
  }

  if (value >= 0.75) {
    return "danger";
  }

  if (value >= 0.5) {
    return "warning";
  }

  if (value >= 0.25) {
    return "brand";
  }

  return "success";
}

export function summarizeMessage(message: string, fallback: string) {
  const trimmed = message.trim();
  if (!trimmed) {
    return fallback;
  }

  if (!shouldCollapseMessage(trimmed)) {
    return trimmed;
  }

  const firstLine = trimmed.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (firstLine && firstLine.length <= 120 && !looksTechnical(firstLine)) {
    return firstLine;
  }

  return fallback;
}

export function shouldCollapseMessage(message: string) {
  const trimmed = message.trim();
  return trimmed.length > 120 || /[\r\n]/.test(trimmed) || looksTechnical(trimmed);
}

export function looksTechnical(message: string) {
  return /(exception|traceback|stack|invalid byte sequence|prisma|postgres|errno| at |\\|\/|0x[0-9a-f]+)/i.test(
    message,
  );
}

export function isLikelyJunkFile(relativePath: string, archivePath?: string) {
  const candidate = `${relativePath} ${archivePath ?? ""}`;
  return /(^|[\\/])__macosx([\\/]|$)|(^|[\\/])\._|(^|[\\/])\.ds_store$|thumbs\.db$/i.test(candidate);
}

export function countMatchesForSpan(
  spans: Array<{ byteStart: number; byteEnd: number }>,
  matchSpans: Array<{ byteStart: number; byteEnd: number }>,
) {
  return matchSpans.reduce((count, matchSpan) => {
    const hasOverlap = spans.some((fileSpan) => spansOverlap(fileSpan, matchSpan));
    return count + (hasOverlap ? 1 : 0);
  }, 0);
}

export function spansOverlap(
  left: { byteStart: number; byteEnd: number },
  right: { byteStart: number; byteEnd: number },
) {
  return left.byteStart < right.byteEnd && right.byteStart < left.byteEnd;
}

export function capitalizeLabel(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
