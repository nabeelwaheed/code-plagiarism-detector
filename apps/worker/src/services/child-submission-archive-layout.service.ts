import path from "node:path";
import type { ArchiveEntryDescriptor } from "@similarity/shared";

type ChildSubmissionArchiveKind = "historical" | "bulk_current";

export function resolveChildSubmissionZipPaths(input: {
  archiveKind: ChildSubmissionArchiveKind;
  entries: ArchiveEntryDescriptor[];
}) {
  const meaningfulEntries = input.entries.filter((entry) => !isIgnoredArchiveJunk(entry.relativePath));
  const rootFiles = meaningfulEntries.filter(
    (entry) => !entry.isDirectory && entry.relativePath.split("/").length === 1,
  );
  const rootFolderNames = Array.from(
    new Set(
      meaningfulEntries
        .filter((entry) => entry.relativePath.split("/").length > 1 || entry.isDirectory)
        .map((entry) => entry.relativePath.split("/")[0] ?? entry.relativePath)
        .filter((segment): segment is string => Boolean(segment)),
    ),
  ).sort((left, right) => left.localeCompare(right));

  if (rootFiles.length > 0 && rootFolderNames.length > 0) {
    throwInvalidArchiveShapeError(input.archiveKind);
  }

  if (rootFolderNames.length > 1) {
    throwInvalidArchiveShapeError(input.archiveKind);
  }

  if (rootFolderNames.length === 1) {
    const wrapperFolderName = rootFolderNames[0];
    if (!wrapperFolderName) {
      throwMissingChildZipError(input.archiveKind);
    }

    return resolveSingleWrapperFolderChildZipPaths({
      archiveKind: input.archiveKind,
      entries: meaningfulEntries,
      wrapperFolderName,
    });
  }

  return resolveDirectChildZipPaths({
    archiveKind: input.archiveKind,
    rootFiles,
  });
}

function resolveDirectChildZipPaths(input: {
  archiveKind: ChildSubmissionArchiveKind;
  rootFiles: ArchiveEntryDescriptor[];
}) {
  const childZipPaths = input.rootFiles
    .filter((entry) => isZipPath(entry.relativePath))
    .map((entry) => entry.relativePath)
    .sort((left, right) => left.localeCompare(right));
  const invalidRootFiles = input.rootFiles.filter((entry) => !isZipPath(entry.relativePath));

  if (invalidRootFiles.length > 0) {
    throwInvalidArchiveShapeError(input.archiveKind);
  }

  if (childZipPaths.length === 0) {
    throwMissingChildZipError(input.archiveKind);
  }

  return childZipPaths;
}

function resolveSingleWrapperFolderChildZipPaths(input: {
  archiveKind: ChildSubmissionArchiveKind;
  entries: ArchiveEntryDescriptor[];
  wrapperFolderName: string;
}) {
  const wrapperEntries = input.entries.filter((entry) => {
    const segments = entry.relativePath.split("/");
    return segments[0] === input.wrapperFolderName && segments.length > 1;
  });
  const deeperEntries = wrapperEntries.filter((entry) => entry.relativePath.split("/").length > 2);
  const nestedFolders = wrapperEntries.filter(
    (entry) => entry.isDirectory && entry.relativePath.split("/").length === 2,
  );
  const wrapperFiles = wrapperEntries.filter(
    (entry) => !entry.isDirectory && entry.relativePath.split("/").length === 2,
  );
  const childZipPaths = wrapperFiles
    .filter((entry) => isZipPath(entry.relativePath))
    .map((entry) => entry.relativePath)
    .sort((left, right) => left.localeCompare(right));
  const invalidWrapperFiles = wrapperFiles.filter((entry) => !isZipPath(entry.relativePath));

  if (deeperEntries.length > 0 || nestedFolders.length > 0 || invalidWrapperFiles.length > 0) {
    throwInvalidArchiveShapeError(input.archiveKind);
  }

  if (childZipPaths.length === 0) {
    throwMissingChildZipError(input.archiveKind);
  }

  return childZipPaths;
}

function isIgnoredArchiveJunk(relativePath: string) {
  const segments = relativePath.split("/");
  const baseName = path.posix.basename(relativePath);
  const lowerSegments = segments.map((segment) => segment.toLowerCase());
  const lowerBaseName = baseName.toLowerCase();

  return (
    lowerSegments.includes("__macosx")
    || lowerBaseName === ".ds_store"
    || lowerBaseName === "thumbs.db"
    || baseName.startsWith("._")
  );
}

function isZipPath(relativePath: string) {
  return relativePath.toLowerCase().endsWith(".zip");
}

function throwMissingChildZipError(archiveKind: ChildSubmissionArchiveKind): never {
  if (archiveKind === "historical") {
    throw new Error(
      "historical archive must contain child zip files directly at the top level or inside one top-level folder",
    );
  }

  throw new Error(
    "bulk current archive must contain child zip files directly at the top level or inside one top-level folder",
  );
}

function throwInvalidArchiveShapeError(archiveKind: ChildSubmissionArchiveKind): never {
  if (archiveKind === "historical") {
    throw new Error(
      "historical archive may only contain direct child zip files or one top-level folder containing child zip files",
    );
  }

  throw new Error(
    "bulk current archive may only contain direct child zip files or one top-level folder containing child zip files",
  );
}
