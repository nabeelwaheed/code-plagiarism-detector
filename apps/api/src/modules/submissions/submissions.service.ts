import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { UploadPurpose } from "@prisma/client";
import { createObjectKey, writeObjectBuffer } from "@similarity/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { QueueService } from "../queue/queue.service.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CreateUploadBatchDto } from "./dto/create-upload-batch.dto.js";
import { CreateStudentSubmissionDto } from "./dto/create-student-submission.dto.js";

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async createUploadBatch(payload: CreateUploadBatchDto, user: AuthenticatedUser) {
    await this.assertProfessorOwnsAssignment(payload.assignmentId, user.id);

    const uploadBatch = await this.prisma.uploadBatch.create({
      data: {
        assignmentId: payload.assignmentId,
        uploaderId: user.id,
        purpose: payload.purpose.toUpperCase() as UploadPurpose,
        originalObjectKey: payload.objectKey,
      },
    });

    const assignment = await this.prisma.assignment.findUniqueOrThrow({
      where: { id: payload.assignmentId },
      select: { language: true },
    });

    await this.queueService.enqueueUploadPreparation({
      assignmentId: payload.assignmentId,
      assignmentLanguage: assignment.language.toLowerCase(),
      uploadBatchId: uploadBatch.id,
      kind: mapUploadPurposeToPreparationKind(payload.purpose),
    });

    return uploadBatch;
  }

  async createProfessorArchiveUpload(payload: {
    assignmentId: string;
    purpose: CreateUploadBatchDto["purpose"];
    fileName: string;
    archiveBuffer: Buffer;
    user: AuthenticatedUser;
  }) {
    ensureZipFileName(payload.fileName);
    ensureSupportedUploadPurpose(payload.purpose);
    ensureProfessorUploadPurpose(payload.purpose);
    await this.assertProfessorOwnsAssignment(payload.assignmentId, payload.user.id);

    const assignment = await this.prisma.assignment.findUniqueOrThrow({
      where: { id: payload.assignmentId },
      select: { language: true },
    });

    const objectKey = createObjectKey(
      `raw/${payload.assignmentId}/${payload.purpose}`,
      payload.fileName,
    );

    await writeObjectBuffer(objectKey, payload.archiveBuffer);

    const uploadBatch = await this.prisma.uploadBatch.create({
      data: {
        assignmentId: payload.assignmentId,
        uploaderId: payload.user.id,
        purpose: payload.purpose.toUpperCase() as UploadPurpose,
        originalObjectKey: objectKey,
      },
    });

    await this.queueService.enqueueUploadPreparation({
      assignmentId: payload.assignmentId,
      assignmentLanguage: assignment.language.toLowerCase(),
      uploadBatchId: uploadBatch.id,
      kind: mapUploadPurposeToPreparationKind(payload.purpose),
    });

    return uploadBatch;
  }

  async createStudentSubmission(payload: CreateStudentSubmissionDto, user: AuthenticatedUser) {
    const assignmentKey = await this.prisma.assignmentKey.findFirstOrThrow({
      where: {
        publicKey: payload.assignmentKey,
        isActive: true,
      },
      include: {
        assignment: {
          select: {
            id: true,
            language: true,
          },
        },
      },
    });

    const uploadBatch = await this.prisma.uploadBatch.create({
      data: {
        assignmentId: assignmentKey.assignment.id,
        uploaderId: user.id,
        purpose: UploadPurpose.STUDENT_SUBMISSION,
        originalObjectKey: payload.objectKey,
      },
    });

    await this.queueService.enqueueUploadPreparation({
      assignmentId: assignmentKey.assignment.id,
      assignmentLanguage: assignmentKey.assignment.language.toLowerCase(),
      uploadBatchId: uploadBatch.id,
      kind: "current",
    });

    return {
      assignmentId: assignmentKey.assignment.id,
      assignmentLanguage: assignmentKey.assignment.language.toLowerCase(),
      uploadBatchId: uploadBatch.id,
    };
  }

  async createStudentSubmissionFromArchive(payload: {
    assignmentKey: string;
    fileName: string;
    archiveBuffer: Buffer;
    user: AuthenticatedUser;
  }) {
    ensureZipFileName(payload.fileName);

    const assignmentKey = await this.prisma.assignmentKey.findFirstOrThrow({
      where: {
        publicKey: payload.assignmentKey,
        isActive: true,
      },
      include: {
        assignment: {
          select: {
            id: true,
            language: true,
          },
        },
      },
    });

    const objectKey = createObjectKey(
      `raw/${assignmentKey.assignment.id}/student_submission`,
      payload.fileName,
    );

    await writeObjectBuffer(objectKey, payload.archiveBuffer);

    const uploadBatch = await this.prisma.uploadBatch.create({
      data: {
        assignmentId: assignmentKey.assignment.id,
        uploaderId: payload.user.id,
        purpose: UploadPurpose.STUDENT_SUBMISSION,
        originalObjectKey: objectKey,
      },
    });

    await this.queueService.enqueueUploadPreparation({
      assignmentId: assignmentKey.assignment.id,
      assignmentLanguage: assignmentKey.assignment.language.toLowerCase(),
      uploadBatchId: uploadBatch.id,
      kind: "current",
    });

    return {
      assignmentId: assignmentKey.assignment.id,
      assignmentLanguage: assignmentKey.assignment.language.toLowerCase(),
      uploadBatchId: uploadBatch.id,
    };
  }

  async getUploadBatch(uploadBatchId: string, user: AuthenticatedUser) {
    const uploadBatch = await this.prisma.uploadBatch.findUnique({
      where: { id: uploadBatchId },
      include: {
        assignment: {
          select: {
            professorId: true,
          },
        },
        submissions: {
          select: {
            id: true,
            displayName: true,
            kind: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        templateVersions: {
          select: {
            id: true,
            versionNumber: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { versionNumber: "desc" },
        },
      },
    });

    if (!uploadBatch) {
      return null;
    }

    const canAccess =
      (user.role === "student" && uploadBatch.uploaderId === user.id) ||
      (user.role === "professor" && uploadBatch.assignment.professorId === user.id);

    if (!canAccess) {
      throw new ForbiddenException("You do not have access to this upload batch");
    }

    return {
      id: uploadBatch.id,
      assignmentId: uploadBatch.assignmentId,
      uploaderId: uploadBatch.uploaderId,
      purpose: uploadBatch.purpose.toLowerCase(),
      status: uploadBatch.status.toLowerCase(),
      errorMessage: uploadBatch.errorMessage,
      createdAt: uploadBatch.createdAt,
      updatedAt: uploadBatch.updatedAt,
      submissions: uploadBatch.submissions.map((submission) => ({
        id: submission.id,
        displayName: submission.displayName,
        kind: submission.kind.toLowerCase(),
        createdAt: submission.createdAt,
      })),
      templateVersions: uploadBatch.templateVersions.map((template) => ({
        id: template.id,
        versionNumber: template.versionNumber,
        isActive: template.isActive,
        createdAt: template.createdAt,
      })),
    };
  }

  private async assertProfessorOwnsAssignment(assignmentId: string, professorId: string) {
    const assignment = await this.prisma.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      select: { professorId: true },
    });

    if (assignment.professorId !== professorId) {
      throw new ForbiddenException("You do not have access to this assignment");
    }
  }
}

function mapUploadPurposeToPreparationKind(purpose: CreateUploadBatchDto["purpose"]) {
  switch (purpose) {
    case "student_submission":
      return "current";
    case "historical_submission":
      return "historical";
    case "template_upload":
      return "template";
  }
}

function ensureZipFileName(fileName: string) {
  if (!fileName.toLowerCase().endsWith(".zip")) {
    throw new BadRequestException("uploaded archive must be a zip file");
  }
}

function ensureSupportedUploadPurpose(purpose: string): asserts purpose is CreateUploadBatchDto["purpose"] {
  if (
    purpose !== "student_submission" &&
    purpose !== "historical_submission" &&
    purpose !== "template_upload"
  ) {
    throw new BadRequestException("unsupported upload purpose");
  }
}

function ensureProfessorUploadPurpose(
  purpose: CreateUploadBatchDto["purpose"],
): asserts purpose is "historical_submission" | "template_upload" {
  if (purpose === "student_submission") {
    throw new BadRequestException("professor archive uploads must be historical or template");
  }
}
