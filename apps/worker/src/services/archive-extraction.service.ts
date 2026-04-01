import { Buffer } from "node:buffer";
import { unzipSync } from "fflate";
import type {
  ArchiveEntryDescriptor,
  AssignmentLanguage,
  ExtractedSourceFile,
} from "@similarity/shared";
import { workerRuntimeConfig } from "../config/runtime-config.js";
import { LANGUAGE_SUFFIXES } from "./concat.service.js";

interface ExtractionState {
  sourceFileCount: number;
  totalExtractedBytes: number;
}

export function listArchiveEntries(archiveBuffer: Buffer): ArchiveEntryDescriptor[] {
  const archive = unzipArchive(archiveBuffer);

  return Object.keys(archive)
    .sort((left, right) => left.localeCompare(right))
    .map((entryPath) => ({
      relativePath: normalizeArchiveEntryPath(entryPath),
      isDirectory: entryPath.endsWith("/"),
    }));
}

export function readArchiveEntryBuffer(archiveBuffer: Buffer, relativePath: string) {
  const archive = unzipArchive(archiveBuffer);
  const normalizedRelativePath = normalizeArchiveEntryPath(relativePath);

  for (const [entryPath, entryBuffer] of Object.entries(archive)) {
    if (entryPath.endsWith("/")) {
      continue;
    }

    if (normalizeArchiveEntryPath(entryPath) === normalizedRelativePath) {
      return Buffer.from(entryBuffer);
    }
  }

  throw new Error(`archive entry not found: ${relativePath}`);
}

export function extractSourceFilesFromSubmissionArchive(input: {
  assignmentLanguage: AssignmentLanguage;
  archiveBuffer: Buffer;
  boundaryArchivePath?: string;
}): ExtractedSourceFile[] {
  const state: ExtractionState = {
    sourceFileCount: 0,
    totalExtractedBytes: 0,
  };

  const files: ExtractedSourceFile[] = [];

  visitArchive({
    assignmentLanguage: input.assignmentLanguage,
    archiveBuffer: input.archiveBuffer,
    boundaryArchivePath: input.boundaryArchivePath,
    nestedArchiveChain: [],
    depth: 0,
    files,
    state,
  });

  if (files.length === 0) {
    throw new Error(
      `no relevant ${input.assignmentLanguage} source files found in uploaded archive`,
    );
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function visitArchive(input: {
  assignmentLanguage: AssignmentLanguage;
  archiveBuffer: Buffer;
  boundaryArchivePath?: string;
  nestedArchiveChain: string[];
  depth: number;
  files: ExtractedSourceFile[];
  state: ExtractionState;
}) {
  if (input.depth > workerRuntimeConfig.archiveMaxDepth) {
    throw new Error("archive nesting depth limit exceeded");
  }

  const archive = unzipArchive(input.archiveBuffer);
  const entryPaths = Object.keys(archive).sort((left, right) => left.localeCompare(right));

  for (const rawEntryPath of entryPaths) {
    if (rawEntryPath.endsWith("/")) {
      continue;
    }

    const normalizedEntryPath = normalizeArchiveEntryPath(rawEntryPath);
    const entryBuffer = Buffer.from(archive[rawEntryPath] ?? []);

    input.state.totalExtractedBytes += entryBuffer.byteLength;
    if (input.state.totalExtractedBytes > workerRuntimeConfig.archiveMaxExpandedBytes) {
      throw new Error("archive expanded beyond the allowed extraction size");
    }

    if (isZipFile(normalizedEntryPath)) {
      visitArchive({
        assignmentLanguage: input.assignmentLanguage,
        archiveBuffer: entryBuffer,
        boundaryArchivePath: input.boundaryArchivePath,
        nestedArchiveChain: [...input.nestedArchiveChain, normalizedEntryPath],
        depth: input.depth + 1,
        files: input.files,
        state: input.state,
      });
      continue;
    }

    if (!isRelevantSourceFile(input.assignmentLanguage, normalizedEntryPath)) {
      continue;
    }

    input.state.sourceFileCount += 1;
    if (input.state.sourceFileCount > workerRuntimeConfig.archiveMaxSourceFiles) {
      throw new Error("archive contained too many source files");
    }

    input.files.push({
      relativePath: formatRelativePath(input.nestedArchiveChain, normalizedEntryPath),
      archivePath: formatArchivePath(input.boundaryArchivePath, input.nestedArchiveChain),
      contents: normalizeSourceText(entryBuffer),
    });
  }
}

function unzipArchive(archiveBuffer: Buffer) {
  try {
    return unzipSync(new Uint8Array(archiveBuffer));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown zip extraction failure";
    throw new Error(`failed to read zip archive: ${message}`);
  }
}

function normalizeArchiveEntryPath(entryPath: string) {
  const normalized = entryPath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (
    normalized.length === 0 ||
    normalized.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new Error(`unsafe archive entry path: ${entryPath}`);
  }

  return normalized;
}

function isZipFile(entryPath: string) {
  return entryPath.toLowerCase().endsWith(".zip");
}

function isRelevantSourceFile(language: AssignmentLanguage, entryPath: string) {
  const lowerEntryPath = entryPath.toLowerCase();
  return LANGUAGE_SUFFIXES[language].some((suffix) => lowerEntryPath.endsWith(suffix));
}

function formatRelativePath(nestedArchiveChain: string[], entryPath: string) {
  if (nestedArchiveChain.length === 0) {
    return entryPath;
  }

  return `${nestedArchiveChain.join("!/")}!/${entryPath}`;
}

function formatArchivePath(boundaryArchivePath: string | undefined, nestedArchiveChain: string[]) {
  const parts = [boundaryArchivePath, ...nestedArchiveChain].filter(
    (value): value is string => Boolean(value),
  );

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join("!/");
}

function normalizeSourceText(sourceBuffer: Buffer) {
  return sourceBuffer
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}
