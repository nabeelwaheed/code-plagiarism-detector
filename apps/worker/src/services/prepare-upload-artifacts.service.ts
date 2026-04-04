import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  createObjectKey,
  getObjectFileName,
  readObjectBuffer,
  writeObjectBuffer,
  type AssignmentLanguage,
} from "@similarity/shared";
import { buildDeterministicConcatenation, selectRelevantSourceFiles } from "./concat.service.js";
import {
  extractSourceFilesFromSubmissionArchive,
  listArchiveEntries,
  readArchiveEntryBuffer,
} from "./archive-extraction.service.js";
import { detectHistoricalSubmissionBoundaries } from "./historical-boundary.service.js";
import type {
  PreparedSubmissionPersistenceInput,
  PreparedTemplatePersistenceInput,
} from "./persist-prepared-upload.service.js";

const prisma = new PrismaClient();

export async function prepareUploadArtifacts(input: {
  assignmentId: string;
  assignmentLanguage: AssignmentLanguage;
  uploadBatchId: string;
  kind: "current" | "historical" | "template" | "bulk_current";
}) {
  const uploadBatch = await prisma.uploadBatch.findUniqueOrThrow({
    where: { id: input.uploadBatchId },
    select: {
      id: true,
      assignmentId: true,
      uploaderId: true,
      encryptedIdentity: true,
      originalObjectKey: true,
    },
  });

  if (uploadBatch.assignmentId !== input.assignmentId) {
    throw new Error("upload batch assignment mismatch during preparation");
  }

  const archiveBuffer = await readObjectBuffer(uploadBatch.originalObjectKey);

  if (input.kind === "template") {
    return {
      template: await prepareTemplateArtifacts({
        assignmentId: input.assignmentId,
        assignmentLanguage: input.assignmentLanguage,
        uploadBatchId: input.uploadBatchId,
        archiveBuffer,
      }),
    };
  }

  if (input.kind === "historical") {
    return {
      submissions: await prepareHistoricalSubmissionArtifacts({
        assignmentId: input.assignmentId,
        assignmentLanguage: input.assignmentLanguage,
        uploadBatchId: input.uploadBatchId,
        archiveBuffer,
      }),
    };
  }

  if (input.kind === "bulk_current") {
    return {
      submissions: await prepareBulkCurrentSubmissionArtifacts({
        assignmentId: input.assignmentId,
        assignmentLanguage: input.assignmentLanguage,
        uploadBatchId: input.uploadBatchId,
        archiveBuffer,
      }),
    };
  }

  return {
    submissions: [
      await prepareSingleSubmissionArtifacts({
        assignmentId: input.assignmentId,
        assignmentLanguage: input.assignmentLanguage,
        uploadBatchId: input.uploadBatchId,
        archiveBuffer,
        displayName:
          uploadBatch.encryptedIdentity
          ? createSubmissionAlias(uploadBatch.encryptedIdentity)
          : stripZipExtension(getObjectFileName(uploadBatch.originalObjectKey)),
        kind: "current",
        ownerId: uploadBatch.uploaderId ?? undefined,
      }),
    ],
  };
}

async function prepareHistoricalSubmissionArtifacts(input: {
  assignmentId: string;
  assignmentLanguage: AssignmentLanguage;
  uploadBatchId: string;
  archiveBuffer: Buffer;
}) {
  const boundaries = detectHistoricalSubmissionBoundaries(
    listArchiveEntries(input.archiveBuffer),
  );

  const submissions: PreparedSubmissionPersistenceInput[] = [];

  for (const boundary of boundaries) {
    const childArchiveBuffer = readArchiveEntryBuffer(input.archiveBuffer, boundary.childZipPath);

    submissions.push(
      await prepareSingleSubmissionArtifacts({
        assignmentId: input.assignmentId,
        assignmentLanguage: input.assignmentLanguage,
        uploadBatchId: input.uploadBatchId,
        archiveBuffer: childArchiveBuffer,
        displayName: stripZipExtension(path.posix.basename(boundary.childZipPath)),
        kind: "historical",
        boundaryArchivePath: boundary.childZipPath,
      }),
    );
  }

  return submissions;
}

async function prepareBulkCurrentSubmissionArtifacts(input: {
  assignmentId: string;
  assignmentLanguage: AssignmentLanguage;
  uploadBatchId: string;
  archiveBuffer: Buffer;
}) {
  const childZipPaths = listBulkCurrentChildZipPaths(input.archiveBuffer);
  const sanitizedNames = new Set<string>();
  const submissions: PreparedSubmissionPersistenceInput[] = [];

  for (const childZipPath of childZipPaths) {
    const displayName = sanitizeBulkSubmissionDisplayName(childZipPath);

    if (sanitizedNames.has(displayName)) {
      throw new Error("bulk current archive contains duplicate submission names after sanitization");
    }

    sanitizedNames.add(displayName);

    const childArchiveBuffer = readArchiveEntryBuffer(input.archiveBuffer, childZipPath);
    submissions.push(
      await prepareSingleSubmissionArtifacts({
        assignmentId: input.assignmentId,
        assignmentLanguage: input.assignmentLanguage,
        uploadBatchId: input.uploadBatchId,
        archiveBuffer: childArchiveBuffer,
        displayName,
        kind: "current",
      }),
    );
  }

  return submissions;
}

async function prepareTemplateArtifacts(input: {
  assignmentId: string;
  assignmentLanguage: AssignmentLanguage;
  uploadBatchId: string;
  archiveBuffer: Buffer;
}): Promise<PreparedTemplatePersistenceInput> {
  const extractedFiles = extractSourceFilesFromSubmissionArchive({
    assignmentLanguage: input.assignmentLanguage,
    archiveBuffer: input.archiveBuffer,
  });

  const relevantFiles = selectRelevantSourceFiles(input.assignmentLanguage, extractedFiles);
  const concatenation = buildDeterministicConcatenation(input.assignmentLanguage, relevantFiles);

  return {
    source: concatenation.source,
    sourceMap: concatenation.sourceMap,
    files: await persistPreparedSourceFiles({
      assignmentId: input.assignmentId,
      uploadBatchId: input.uploadBatchId,
      artifactSlug: "template",
      files: relevantFiles,
      sourceMap: concatenation.sourceMap,
    }),
  };
}

async function prepareSingleSubmissionArtifacts(input: {
  assignmentId: string;
  assignmentLanguage: AssignmentLanguage;
  uploadBatchId: string;
  archiveBuffer: Buffer;
  displayName: string;
  kind: "current" | "historical";
  ownerId?: string;
  boundaryArchivePath?: string;
}): Promise<PreparedSubmissionPersistenceInput> {
  const extractedFiles = extractSourceFilesFromSubmissionArchive({
    assignmentLanguage: input.assignmentLanguage,
    archiveBuffer: input.archiveBuffer,
    boundaryArchivePath: input.boundaryArchivePath,
  });

  const relevantFiles = selectRelevantSourceFiles(input.assignmentLanguage, extractedFiles);
  const concatenation = buildDeterministicConcatenation(input.assignmentLanguage, relevantFiles);

  return {
    displayName: input.displayName,
    kind: input.kind,
    ownerId: input.ownerId,
    source: concatenation.source,
    sourceMap: concatenation.sourceMap,
    files: await persistPreparedSourceFiles({
      assignmentId: input.assignmentId,
      uploadBatchId: input.uploadBatchId,
      artifactSlug: slugifyArtifactName(input.displayName),
      files: relevantFiles,
      sourceMap: concatenation.sourceMap,
    }),
  };
}

async function persistPreparedSourceFiles(input: {
  assignmentId: string;
  uploadBatchId: string;
  artifactSlug: string;
  files: Array<{
    relativePath: string;
    archivePath?: string;
    contents: string;
  }>;
  sourceMap: Array<{
    filePath: string;
    byteStart: number;
    byteEnd: number;
  }>;
}) {
  const persistedFiles: Array<{
    relativePath: string;
    storageObjectKey: string;
    canonicalOrder: number;
    byteStart: number;
    byteEnd: number;
    archivePath?: string;
  }> = [];

  for (const [index, file] of input.files.entries()) {
    const mapEntry = input.sourceMap[index];
    if (!mapEntry) {
      throw new Error(`missing source-map entry for prepared file ${file.relativePath}`);
    }

    const storageObjectKey = createObjectKey(
      `prepared/${input.assignmentId}/${input.uploadBatchId}/${input.artifactSlug}/${String(
        index + 1,
      ).padStart(4, "0")}`,
      path.posix.basename(file.relativePath),
    );

    await writeObjectBuffer(storageObjectKey, Buffer.from(file.contents, "utf8"));

    persistedFiles.push({
      relativePath: file.relativePath,
      storageObjectKey,
      canonicalOrder: index,
      byteStart: mapEntry.byteStart,
      byteEnd: mapEntry.byteEnd,
      archivePath: file.archivePath,
    });
  }

  return persistedFiles;
}

function stripZipExtension(fileName: string) {
  return fileName.replace(/\.zip$/i, "");
}

function slugifyArtifactName(value: string) {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "artifact";
}

function createSubmissionAlias(encryptedIdentity: string) {
  const digest = createHash("sha256").update(encryptedIdentity).digest("hex").slice(0, 10).toUpperCase();
  return `SUB-${digest}`;
}

function listBulkCurrentChildZipPaths(archiveBuffer: Buffer) {
  const firstLayerFiles = listArchiveEntries(archiveBuffer)
    .filter((entry) => !entry.isDirectory)
    .filter((entry) => entry.relativePath.split("/").length === 1);

  const meaningfulFirstLayerFiles = firstLayerFiles.filter(
    (entry) => !isIgnoredBulkRootEntry(entry.relativePath),
  );
  const childZipPaths = meaningfulFirstLayerFiles
    .filter((entry) => entry.relativePath.toLowerCase().endsWith(".zip"))
    .map((entry) => entry.relativePath)
    .sort((left, right) => left.localeCompare(right));
  const invalidFirstLayerFiles = meaningfulFirstLayerFiles.filter(
    (entry) => !entry.relativePath.toLowerCase().endsWith(".zip"),
  );

  if (childZipPaths.length === 0) {
    throw new Error("bulk current archive must contain first-layer child zip files");
  }

  if (invalidFirstLayerFiles.length > 0) {
    throw new Error("bulk current archive may only contain first-layer child zip files");
  }

  return childZipPaths;
}

function isIgnoredBulkRootEntry(relativePath: string) {
  const baseName = path.posix.basename(relativePath);
  return (
    relativePath.startsWith("__MACOSX/")
    || baseName === ".DS_Store"
    || baseName === "Thumbs.db"
    || baseName.startsWith("._")
  );
}

function sanitizeBulkSubmissionDisplayName(childZipPath: string) {
  const baseName = path.posix.basename(childZipPath);
  const stem = stripZipExtension(baseName)
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sanitized = stem
    .replace(/[\\/]/g, "-")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[ ._-]+|[ ._-]+$/g, "");

  if (!sanitized) {
    throw new Error("bulk current archive contains a child zip with an invalid name");
  }

  return sanitized;
}
