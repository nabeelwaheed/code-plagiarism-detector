import path from "node:path";
import type {
  ArchiveEntryDescriptor,
  HistoricalSubmissionBoundary,
} from "@similarity/shared";
import { resolveChildSubmissionZipPaths } from "./child-submission-archive-layout.service.js";

export function detectHistoricalSubmissionBoundaries(
  entries: ArchiveEntryDescriptor[],
): HistoricalSubmissionBoundary[] {
  const childZipPaths = resolveChildSubmissionZipPaths({
    archiveKind: "historical",
    entries,
  });

  return childZipPaths.map((childZipPath, index) => ({
    childZipPath: normalizePath(childZipPath),
    submissionKey: `historical-${index + 1}-${path.basename(childZipPath, ".zip")}`,
  }));
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\.?\//, "");
}
