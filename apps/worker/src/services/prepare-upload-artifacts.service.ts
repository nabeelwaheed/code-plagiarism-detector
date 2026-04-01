import path from "node:path";
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
  kind: "current" | "historical" | "template";
}) {
  const uploadBatch = await prisma.uploadBatch.findUniqueOrThrow({
    where: { id: input.uploadBatchId },
    select: {
      id: true,
      assignmentId: true,
      uploaderId: true,
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

  return {
    submissions: [
      await prepareSingleSubmissionArtifacts({
        assignmentId: input.assignmentId,
        assignmentLanguage: input.assignmentLanguage,
        uploadBatchId: input.uploadBatchId,
        archiveBuffer,
        displayName: stripZipExtension(getObjectFileName(uploadBatch.originalObjectKey)),
        kind: "current",
        ownerId: uploadBatch.uploaderId,
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
