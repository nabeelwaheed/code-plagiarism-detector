import path from "node:path";
import type {
  ArchiveEntryDescriptor,
  HistoricalSubmissionBoundary,
} from "@similarity/shared";

export function detectHistoricalSubmissionBoundaries(
  entries: ArchiveEntryDescriptor[],
): HistoricalSubmissionBoundary[] {
  const firstLayerChildZips = entries
    .filter((entry) => !entry.isDirectory)
    .filter((entry) => {
      const normalized = normalizePath(entry.relativePath);
      return normalized.split("/").length === 1 && normalized.toLowerCase().endsWith(".zip");
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  if (firstLayerChildZips.length === 0) {
    throw new Error(
      "historical archive must contain first-layer child zip files that define submission boundaries",
    );
  }

  return firstLayerChildZips.map((entry, index) => ({
    childZipPath: normalizePath(entry.relativePath),
    submissionKey: `historical-${index + 1}-${path.basename(entry.relativePath, ".zip")}`,
  }));
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\.?\//, "");
}
