import {
  Prisma,
  PrismaClient,
  SubmissionKind as PrismaSubmissionKind,
} from "@prisma/client";
import type { SourceMapEntry, SubmissionKind } from "@similarity/shared";

const prisma = new PrismaClient();

export interface PreparedSubmissionPersistenceInput {
  displayName: string;
  kind: SubmissionKind;
  ownerId?: string;
  source: string;
  sourceMap: SourceMapEntry[];
  files: Array<{
    relativePath: string;
    storageObjectKey: string;
    canonicalOrder: number;
    byteStart: number;
    byteEnd: number;
    archivePath?: string;
  }>;
}

export interface PreparedTemplatePersistenceInput {
  source: string;
  sourceMap: SourceMapEntry[];
  files: Array<{
    relativePath: string;
    storageObjectKey: string;
    canonicalOrder: number;
    byteStart: number;
    byteEnd: number;
    archivePath?: string;
  }>;
}

export async function persistPreparedSubmissions(
  assignmentId: string,
  uploadBatchId: string,
  submissions: PreparedSubmissionPersistenceInput[],
) {
  await prisma.$transaction(async (tx) => {
    for (const submission of submissions) {
      const createdSubmission = await tx.submission.create({
        data: {
          assignmentId,
          uploadBatchId,
          ownerId: submission.ownerId,
          displayName: submission.displayName,
          kind:
            submission.kind === "historical"
              ? PrismaSubmissionKind.HISTORICAL
              : PrismaSubmissionKind.CURRENT,
          concatenatedSource: submission.source,
          sourceMapJson: submission.sourceMap as unknown as Prisma.InputJsonValue,
        },
      });

      if (submission.files.length > 0) {
        await tx.submissionFile.createMany({
          data: submission.files.map((file) => ({
            submissionId: createdSubmission.id,
            relativePath: file.relativePath,
            storageObjectKey: file.storageObjectKey,
            canonicalOrder: file.canonicalOrder,
            byteStart: file.byteStart,
            byteEnd: file.byteEnd,
            archivePath: file.archivePath,
          })),
        });
      }
    }

    await tx.uploadBatch.update({
      where: { id: uploadBatchId },
      data: { status: "READY" },
    });
  });
}

export async function persistPreparedTemplate(
  assignmentId: string,
  uploadBatchId: string,
  template: PreparedTemplatePersistenceInput,
) {
  await prisma.$transaction(async (tx) => {
    await tx.assignmentTemplate.updateMany({
      where: { assignmentId },
      data: { isActive: false },
    });

    const previousTemplate = await tx.assignmentTemplate.findFirst({
      where: { assignmentId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    const createdTemplate = await tx.assignmentTemplate.create({
      data: {
        assignmentId,
        uploadBatchId,
        versionNumber: (previousTemplate?.versionNumber ?? 0) + 1,
        isActive: true,
        concatenatedSource: template.source,
        sourceMapJson: template.sourceMap as unknown as Prisma.InputJsonValue,
      },
    });

    if (template.files.length > 0) {
      await tx.templateFile.createMany({
        data: template.files.map((file) => ({
          assignmentTemplateId: createdTemplate.id,
          relativePath: file.relativePath,
          storageObjectKey: file.storageObjectKey,
          canonicalOrder: file.canonicalOrder,
          byteStart: file.byteStart,
          byteEnd: file.byteEnd,
          archivePath: file.archivePath,
        })),
      });
    }

    await tx.uploadBatch.update({
      where: { id: uploadBatchId },
      data: { status: "READY" },
    });
  });
}

export async function markUploadBatchProcessing(uploadBatchId: string) {
  await prisma.uploadBatch.update({
    where: { id: uploadBatchId },
    data: {
      status: "PROCESSING",
      errorMessage: null,
    },
  });
}

export async function markUploadBatchFailed(uploadBatchId: string, message: string) {
  await prisma.uploadBatch.update({
    where: { id: uploadBatchId },
    data: {
      status: "FAILED",
      errorMessage: message,
    },
  });
}
