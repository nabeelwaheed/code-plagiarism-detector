import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, SubmissionKind, UploadPurpose } from "@prisma/client";
import { zipSync } from "fflate";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  createObjectKey,
  deleteObject,
  promoteStagedObject,
  readObjectBuffer,
  writeObjectBuffer,
} from "@similarity/shared";
import { apiRuntimeConfig } from "../../config/runtime-config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { QueueService } from "../queue/queue.service.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CreateUploadBatchDto } from "./dto/create-upload-batch.dto.js";
import { CreateStudentSubmissionDto } from "./dto/create-student-submission.dto.js";
import {
  decryptSubmissionIdentity,
  getSubmissionIdentityPublicKey,
  validateEncryptedIdentityString,
} from "./submission-identity.crypto.js";
import {
  assertAssignmentHasNoActiveJobs,
  assertProfessorOwnsAssignment,
  bumpAssignmentComparisonInputVersion,
  clearAssignmentComparisonData,
  promoteNewestRemainingTemplate,
} from "../assignments/assignment-maintenance.js";

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

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: payload.assignmentId },
      select: { language: true },
    });

    if (!assignment) {
      throw new NotFoundException("That assignment no longer exists");
    }

    await this.queueService.enqueueUploadPreparation({
      assignmentId: payload.assignmentId,
      assignmentLanguage: assignment.language.toLowerCase(),
      uploadBatchId: uploadBatch.id,
      kind: mapUploadPurposeToPreparationKind(payload.purpose),
    });

    return uploadBatch;
  }

  getPublicSubmissionIdentityKey() {
    return getSubmissionIdentityPublicKey();
  }

  async createProfessorArchiveUpload(payload: {
    assignmentId: string;
    purpose: CreateUploadBatchDto["purpose"];
    fileName: string;
    stagedObjectKey: string;
    user: AuthenticatedUser;
  }) {
    try {
      ensureZipFileName(payload.fileName);
      ensureSupportedUploadPurpose(payload.purpose);
      ensureProfessorUploadPurpose(payload.purpose);
      await this.assertProfessorOwnsAssignment(payload.assignmentId, payload.user.id);

      const assignment = await this.prisma.assignment.findUnique({
        where: { id: payload.assignmentId },
        select: { language: true },
      });

      if (!assignment) {
        throw new NotFoundException("That assignment no longer exists");
      }

      return this.finalizeArchiveUpload({
        stagedObjectKey: payload.stagedObjectKey,
        finalObjectPrefix: `raw/${payload.assignmentId}/${payload.purpose}`,
        finalFileName: payload.fileName,
        uploadBatchData: {
          assignmentId: payload.assignmentId,
          uploaderId: payload.user.id,
          purpose: payload.purpose.toUpperCase() as UploadPurpose,
        },
        queueJob: {
          assignmentId: payload.assignmentId,
          assignmentLanguage: assignment.language.toLowerCase(),
          kind: mapUploadPurposeToPreparationKind(payload.purpose),
        },
      });
    } catch (error) {
      await deleteObjectKeysBestEffort([payload.stagedObjectKey]);
      throw error;
    }
  }

  async createStudentSubmission(payload: CreateStudentSubmissionDto, user: AuthenticatedUser) {
    const assignmentKey = await this.findActiveAssignmentKey(payload.assignmentKey);

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
    stagedObjectKey: string;
    user: AuthenticatedUser;
  }) {
    try {
      ensureZipFileName(payload.fileName);
      const assignmentKey = await this.findActiveAssignmentKey(payload.assignmentKey);

      const uploadBatch = await this.finalizeArchiveUpload({
        stagedObjectKey: payload.stagedObjectKey,
        finalObjectPrefix: `raw/${assignmentKey.assignment.id}/student_submission`,
        finalFileName: payload.fileName,
        uploadBatchData: {
          assignmentId: assignmentKey.assignment.id,
          uploaderId: payload.user.id,
          purpose: UploadPurpose.STUDENT_SUBMISSION,
        },
        queueJob: {
          assignmentId: assignmentKey.assignment.id,
          assignmentLanguage: assignmentKey.assignment.language.toLowerCase(),
          kind: "current",
        },
      });

      return {
        assignmentId: assignmentKey.assignment.id,
        assignmentLanguage: assignmentKey.assignment.language.toLowerCase(),
        uploadBatchId: uploadBatch.id,
      };
    } catch (error) {
      await deleteObjectKeysBestEffort([payload.stagedObjectKey]);
      throw error;
    }
  }

  async createPublicStudentSubmissionFromArchive(payload: {
    assignmentKey: string;
    encryptedIdentity: string;
    fileName: string;
    stagedObjectKey: string;
  }) {
    try {
      ensureZipFileName(payload.fileName);
      const assignmentKey = await this.findActiveAssignmentKey(payload.assignmentKey);
      const encryptedIdentity = validateEncryptedIdentityString(payload.encryptedIdentity);

      const uploadBatch = await this.finalizeArchiveUpload({
        stagedObjectKey: payload.stagedObjectKey,
        finalObjectPrefix: `raw/${assignmentKey.assignment.id}/student_submission`,
        finalFileName: "submission.zip",
        uploadBatchData: {
          assignmentId: assignmentKey.assignment.id,
          uploaderId: null,
          encryptedIdentity,
          purpose: UploadPurpose.STUDENT_SUBMISSION,
        },
        queueJob: {
          assignmentId: assignmentKey.assignment.id,
          assignmentLanguage: assignmentKey.assignment.language.toLowerCase(),
          kind: "current",
        },
      });

      return {
        assignmentId: assignmentKey.assignment.id,
        assignmentLanguage: assignmentKey.assignment.language.toLowerCase(),
        uploadBatchId: uploadBatch.id,
        statusToken: this.createPublicStatusToken(uploadBatch.id),
      };
    } catch (error) {
      await deleteObjectKeysBestEffort([payload.stagedObjectKey]);
      throw error;
    }
  }

  async createPublicBulkStudentSubmissionArchive(payload: {
    assignmentKey: string;
    fileName: string;
    stagedObjectKey: string;
  }) {
    try {
      ensureZipFileName(payload.fileName);
      const assignmentKey = await this.findActiveAssignmentKey(payload.assignmentKey);

      const uploadBatch = await this.finalizeArchiveUpload({
        stagedObjectKey: payload.stagedObjectKey,
        finalObjectPrefix: `raw/${assignmentKey.assignment.id}/bulk_student_submission`,
        finalFileName: "bulk-current-submissions.zip",
        uploadBatchData: {
          assignmentId: assignmentKey.assignment.id,
          uploaderId: null,
          encryptedIdentity: null,
          purpose: UploadPurpose.STUDENT_SUBMISSION,
        },
        queueJob: {
          assignmentId: assignmentKey.assignment.id,
          assignmentLanguage: assignmentKey.assignment.language.toLowerCase(),
          kind: "bulk_current",
        },
      });

      return {
        assignmentId: assignmentKey.assignment.id,
        assignmentLanguage: assignmentKey.assignment.language.toLowerCase(),
        uploadBatchId: uploadBatch.id,
        statusToken: this.createPublicStatusToken(uploadBatch.id),
      };
    } catch (error) {
      await deleteObjectKeysBestEffort([payload.stagedObjectKey]);
      throw error;
    }
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

  async getPublicUploadBatch(uploadBatchId: string, token: string | undefined) {
    if (!token || !this.isValidPublicStatusToken(uploadBatchId, token)) {
      throw new ForbiddenException("You do not have access to this upload batch");
    }

    const uploadBatch = await this.prisma.uploadBatch.findUnique({
      where: { id: uploadBatchId },
      include: {
        submissions: {
          select: {
            id: true,
            displayName: true,
            kind: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!uploadBatch) {
      return null;
    }

    if (!isPublicAnonymousStudentUploadBatch(uploadBatch)) {
      throw new ForbiddenException("You do not have access to this upload batch");
    }

    return {
      id: uploadBatch.id,
      assignmentId: uploadBatch.assignmentId,
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
    };
  }

  async getSubmissionDetail(
    assignmentId: string,
    submissionId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertProfessorOwnsAssignment(assignmentId, user.id);

    const submission = await this.prisma.submission.findFirst({
      where: {
        id: submissionId,
        assignmentId,
      },
      include: {
        uploadBatch: {
          select: {
            encryptedIdentity: true,
            purpose: true,
            uploaderId: true,
          },
        },
        files: {
          orderBy: { canonicalOrder: "asc" },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException("That submission no longer exists");
    }

    return {
      id: submission.id,
      displayName: submission.displayName,
      kind: submission.kind.toLowerCase(),
      createdAt: submission.createdAt,
      hasEncryptedIdentity: Boolean(submission.uploadBatch.encryptedIdentity),
      identityRevealMode: getSubmissionIdentityRevealMode(submission.uploadBatch),
      fileCount: submission.files.length,
      concatenatedSource: submission.concatenatedSource,
      sourceMap: submission.sourceMapJson,
      files: await Promise.all(
        submission.files.map(async (file) => ({
          id: file.id,
          relativePath: file.relativePath,
          archivePath: file.archivePath,
          contents: (await readObjectBuffer(file.storageObjectKey)).toString("utf8"),
        })),
      ),
    };
  }

  async revealSubmissionIdentity(
    assignmentId: string,
    submissionId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertProfessorOwnsAssignment(assignmentId, user.id);

    const submission = await this.prisma.submission.findFirst({
      where: {
        id: submissionId,
        assignmentId,
      },
      include: {
        uploadBatch: {
          select: {
            encryptedIdentity: true,
            purpose: true,
            uploaderId: true,
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException("That submission no longer exists");
    }

    if (submission.uploadBatch.encryptedIdentity) {
      const identity = decryptSubmissionIdentity(submission.uploadBatch.encryptedIdentity);
      const assignmentKey = await this.prisma.assignmentKey.findFirst({
        where: {
          assignmentId,
          publicKey: identity.assignmentKey,
        },
        select: {
          id: true,
        },
      });

      if (!assignmentKey) {
        throw new BadRequestException("This submission identity could not be verified for this assignment");
      }

      return {
        studentName: identity.studentName,
        studentNumber: identity.studentNumber,
        studentEmail: identity.studentEmail ?? null,
        assignmentKey: identity.assignmentKey,
      };
    }

    if (isBulkPublicUploadBatch(submission.uploadBatch)) {
      return {
        studentName: submission.displayName,
        studentNumber: null,
        studentEmail: null,
        assignmentKey: null,
      };
    }

    if (!submission.uploadBatch.encryptedIdentity) {
      throw new NotFoundException("That submission does not have a revealable identity");
    }
  }

  async getTemplateDetail(
    assignmentId: string,
    templateId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertProfessorOwnsAssignment(assignmentId, user.id);

    const template = await this.prisma.assignmentTemplate.findFirst({
      where: {
        id: templateId,
        assignmentId,
      },
      include: {
        files: {
          orderBy: { canonicalOrder: "asc" },
        },
      },
    });

    if (!template) {
      throw new NotFoundException("That template no longer exists");
    }

    return {
      id: template.id,
      displayName: `Template v${template.versionNumber}`,
      kind: "template",
      versionNumber: template.versionNumber,
      createdAt: template.createdAt,
      fileCount: template.files.length,
      concatenatedSource: template.concatenatedSource,
      sourceMap: template.sourceMapJson,
      files: await Promise.all(
        template.files.map(async (file) => ({
          id: file.id,
          relativePath: file.relativePath,
          archivePath: file.archivePath,
          contents: (await readObjectBuffer(file.storageObjectKey)).toString("utf8"),
        })),
      ),
    };
  }

  async downloadSubmissionArchive(
    assignmentId: string,
    submissionId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertProfessorOwnsAssignment(assignmentId, user.id);

    const submission = await this.prisma.submission.findFirst({
      where: {
        id: submissionId,
        assignmentId,
      },
      include: {
        files: {
          orderBy: { canonicalOrder: "asc" },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException("That submission no longer exists");
    }

    return {
      fileName: `${sanitizeDownloadName(submission.displayName)}.zip`,
      buffer: Buffer.from(
        zipSync(await createZipEntries(`${sanitizeArchiveSegment(submission.displayName)}`, submission.files)),
      ),
    };
  }

  async downloadTemplateArchive(
    assignmentId: string,
    templateId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertProfessorOwnsAssignment(assignmentId, user.id);

    const template = await this.prisma.assignmentTemplate.findFirst({
      where: {
        id: templateId,
        assignmentId,
      },
      include: {
        files: {
          orderBy: { canonicalOrder: "asc" },
        },
      },
    });

    if (!template) {
      throw new NotFoundException("That template no longer exists");
    }

    const folderName = `template-v${template.versionNumber}`;

    return {
      fileName: `${sanitizeDownloadName(folderName)}.zip`,
      buffer: Buffer.from(
        zipSync(await createZipEntries(sanitizeArchiveSegment(folderName), template.files)),
      ),
    };
  }

  async downloadAllAssignmentSubmissionsArchive(
    assignmentId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertProfessorOwnsAssignment(assignmentId, user.id);

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        submissions: {
          include: {
            files: {
              orderBy: { canonicalOrder: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException("That assignment no longer exists");
    }

    const currentSubmissions = assignment.submissions.filter(
      (submission) => submission.kind === "CURRENT",
    );

    if (currentSubmissions.length === 0) {
      throw new BadRequestException("There are no current submissions available to download.");
    }

    const entries: Record<string, Uint8Array> = {};
    const folderCounts = new Map<string, number>();

    for (const submission of currentSubmissions) {
      const baseFolder = sanitizeArchiveSegment(submission.displayName);
      const usageCount = (folderCounts.get(baseFolder) ?? 0) + 1;
      folderCounts.set(baseFolder, usageCount);
      const uniqueFolder = usageCount > 1 ? `${baseFolder}-${usageCount}` : baseFolder;

      Object.assign(entries, await createZipEntries(uniqueFolder, submission.files));
    }

    return {
      fileName: `${sanitizeDownloadName(assignment.title)}-submissions.zip`,
      buffer: Buffer.from(zipSync(entries)),
    };
  }

  async deleteSubmission(
    assignmentId: string,
    submissionId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertProfessorOwnsAssignment(assignmentId, user.id);
    await assertAssignmentHasNoActiveJobs(this.prisma, assignmentId);

    const submission = await this.prisma.submission.findFirst({
      where: {
        id: submissionId,
        assignmentId,
      },
      include: {
        files: {
          select: {
            storageObjectKey: true,
          },
        },
        uploadBatch: {
          select: {
            id: true,
            originalObjectKey: true,
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException("That submission no longer exists");
    }

    if (submission.kind !== SubmissionKind.HISTORICAL) {
      throw new BadRequestException(
        "Only historical submissions can be deleted individually right now.",
      );
    }

    const objectKeys = new Set<string>(submission.files.map((file) => file.storageObjectKey));

    await this.prisma.$transaction(async (tx) => {
      await clearAssignmentComparisonData(tx, assignmentId);

      await tx.submissionFile.deleteMany({
        where: { submissionId: submission.id },
      });

      await tx.submission.delete({
        where: { id: submission.id },
      });

      const removedUploadBatchKey = await this.deleteUploadBatchIfEmpty(tx, submission.uploadBatch.id);
      if (removedUploadBatchKey) {
        objectKeys.add(removedUploadBatchKey);
      }

      await bumpAssignmentComparisonInputVersion(tx, assignmentId);
    });

    await deleteObjectKeysBestEffort(objectKeys);

    return { ok: true, deletedCount: 1, category: "historical" };
  }

  async deleteTemplate(
    assignmentId: string,
    templateId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertProfessorOwnsAssignment(assignmentId, user.id);
    await assertAssignmentHasNoActiveJobs(this.prisma, assignmentId);

    const template = await this.prisma.assignmentTemplate.findFirst({
      where: {
        id: templateId,
        assignmentId,
      },
      include: {
        files: {
          select: {
            storageObjectKey: true,
          },
        },
        uploadBatch: {
          select: {
            id: true,
            originalObjectKey: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException("That template no longer exists");
    }

    const objectKeys = new Set<string>(template.files.map((file) => file.storageObjectKey));

    await this.prisma.$transaction(async (tx) => {
      await clearAssignmentComparisonData(tx, assignmentId);

      await tx.templateFile.deleteMany({
        where: { assignmentTemplateId: template.id },
      });

      await tx.assignmentTemplate.delete({
        where: { id: template.id },
      });

      if (template.isActive) {
        await promoteNewestRemainingTemplate(tx, assignmentId);
      }

      const removedUploadBatchKey = await this.deleteUploadBatchIfEmpty(tx, template.uploadBatch.id);
      if (removedUploadBatchKey) {
        objectKeys.add(removedUploadBatchKey);
      }

      await bumpAssignmentComparisonInputVersion(tx, assignmentId);
    });

    await deleteObjectKeysBestEffort(objectKeys);

    return { ok: true, deletedCount: 1, category: "template" };
  }

  async deleteAssignmentCategory(
    assignmentId: string,
    category: string,
    user: AuthenticatedUser,
  ) {
    await this.assertProfessorOwnsAssignment(assignmentId, user.id);
    await assertAssignmentHasNoActiveJobs(this.prisma, assignmentId);

    if (category === "current" || category === "historical") {
      const submissionKind =
        category === "current" ? SubmissionKind.CURRENT : SubmissionKind.HISTORICAL;
      const submissions = await this.prisma.submission.findMany({
        where: {
          assignmentId,
          kind: submissionKind,
        },
        include: {
          files: {
            select: {
              storageObjectKey: true,
            },
          },
          uploadBatch: {
            select: {
              id: true,
              originalObjectKey: true,
            },
          },
        },
      });

      if (submissions.length === 0) {
        return { ok: true, deletedCount: 0, category };
      }

      const objectKeys = new Set<string>();
      const uploadBatchIds = new Set<string>();

      for (const submission of submissions) {
        uploadBatchIds.add(submission.uploadBatch.id);
        for (const file of submission.files) {
          objectKeys.add(file.storageObjectKey);
        }
      }

      await this.prisma.$transaction(async (tx) => {
        await clearAssignmentComparisonData(tx, assignmentId);

        await tx.submissionFile.deleteMany({
          where: {
            submission: {
              assignmentId,
              kind: submissionKind,
            },
          },
        });

        await tx.submission.deleteMany({
          where: {
            assignmentId,
            kind: submissionKind,
          },
        });

        for (const uploadBatchId of uploadBatchIds) {
          const removedUploadBatchKey = await this.deleteUploadBatchIfEmpty(tx, uploadBatchId);
          if (removedUploadBatchKey) {
            objectKeys.add(removedUploadBatchKey);
          }
        }

        await bumpAssignmentComparisonInputVersion(tx, assignmentId);
      });

      await deleteObjectKeysBestEffort(objectKeys);

      return { ok: true, deletedCount: submissions.length, category };
    }

    if (category === "template") {
      const templates = await this.prisma.assignmentTemplate.findMany({
        where: {
          assignmentId,
        },
        include: {
          files: {
            select: {
              storageObjectKey: true,
            },
          },
          uploadBatch: {
            select: {
              id: true,
              originalObjectKey: true,
            },
          },
        },
      });

      if (templates.length === 0) {
        return { ok: true, deletedCount: 0, category };
      }

      const objectKeys = new Set<string>();
      const uploadBatchIds = new Set<string>();

      for (const template of templates) {
        uploadBatchIds.add(template.uploadBatch.id);
        for (const file of template.files) {
          objectKeys.add(file.storageObjectKey);
        }
      }

      await this.prisma.$transaction(async (tx) => {
        await clearAssignmentComparisonData(tx, assignmentId);

        await tx.templateFile.deleteMany({
          where: {
            assignmentTemplate: {
              assignmentId,
            },
          },
        });

        await tx.assignmentTemplate.deleteMany({
          where: { assignmentId },
        });

        for (const uploadBatchId of uploadBatchIds) {
          const removedUploadBatchKey = await this.deleteUploadBatchIfEmpty(tx, uploadBatchId);
          if (removedUploadBatchKey) {
            objectKeys.add(removedUploadBatchKey);
          }
        }

        await bumpAssignmentComparisonInputVersion(tx, assignmentId);
      });

      await deleteObjectKeysBestEffort(objectKeys);

      return { ok: true, deletedCount: templates.length, category };
    }

    throw new BadRequestException("Unsupported deletion category");
  }

  private async assertProfessorOwnsAssignment(assignmentId: string, professorId: string) {
    await assertProfessorOwnsAssignment(this.prisma, assignmentId, professorId);
  }

  private async deleteUploadBatchIfEmpty(
    tx: Prisma.TransactionClient,
    uploadBatchId: string,
  ) {
    const uploadBatch = await tx.uploadBatch.findUnique({
      where: { id: uploadBatchId },
      select: {
        id: true,
        originalObjectKey: true,
        _count: {
          select: {
            submissions: true,
            templateVersions: true,
          },
        },
      },
    });

    if (!uploadBatch) {
      return null;
    }

    if (uploadBatch._count.submissions > 0 || uploadBatch._count.templateVersions > 0) {
      return null;
    }

    await tx.uploadBatch.delete({
      where: { id: uploadBatchId },
    });

    return uploadBatch.originalObjectKey;
  }

  private async findActiveAssignmentKey(rawAssignmentKey: string) {
    const publicKey = normalizeAssignmentKey(rawAssignmentKey);

    if (!publicKey) {
      throw new BadRequestException("That assignment key is invalid or inactive");
    }

    const assignmentKey = await this.prisma.assignmentKey.findFirst({
      where: {
        publicKey,
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

    if (!assignmentKey) {
      throw new BadRequestException("That assignment key is invalid or inactive");
    }

    return assignmentKey;
  }

  private createPublicStatusToken(uploadBatchId: string) {
    return createHmac("sha256", apiRuntimeConfig.publicUploads.statusTokenSecret)
      .update(uploadBatchId)
      .digest("base64url");
  }

  private isValidPublicStatusToken(uploadBatchId: string, token: string) {
    const expected = this.createPublicStatusToken(uploadBatchId);
    const providedBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(expected);

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
  }

  private async finalizeArchiveUpload(input: {
    stagedObjectKey: string;
    finalObjectPrefix: string;
    finalFileName: string;
    uploadBatchData: {
      assignmentId: string;
      uploaderId: string | null;
      encryptedIdentity?: string | null;
      purpose: UploadPurpose;
    };
    queueJob: {
      assignmentId: string;
      assignmentLanguage: string;
      kind: "current" | "historical" | "template" | "bulk_current";
    };
  }) {
    const finalObjectKey = createObjectKey(input.finalObjectPrefix, input.finalFileName);
    let promotedToFinal = false;
    let uploadBatch: { id: string } | null = null;
    let queued = false;

    try {
      await promoteStagedObject(input.stagedObjectKey, finalObjectKey);
      promotedToFinal = true;

      uploadBatch = await this.prisma.uploadBatch.create({
        data: {
          ...input.uploadBatchData,
          originalObjectKey: finalObjectKey,
        },
      });

      await this.queueService.enqueueUploadPreparation({
        ...input.queueJob,
        uploadBatchId: uploadBatch.id,
      });
      queued = true;

      return uploadBatch;
    } catch (error) {
      if (!promotedToFinal) {
        await deleteObjectKeysBestEffort([input.stagedObjectKey]);
      } else if (!uploadBatch) {
        await deleteObjectKeysBestEffort([finalObjectKey]);
      } else if (!queued) {
        const queueFailureMessage = "We couldn't start processing that upload. Please try again.";
        await Promise.allSettled([
          deleteObject(finalObjectKey),
          this.prisma.uploadBatch.update({
            where: { id: uploadBatch.id },
            data: {
              status: "FAILED",
              errorMessage: queueFailureMessage,
            },
          }),
        ]);
      }

      throw error;
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

function getSubmissionIdentityRevealMode(input: {
  encryptedIdentity: string | null;
  purpose: UploadPurpose;
  uploaderId: string | null;
}) {
  if (input.encryptedIdentity) {
    return "encrypted" as const;
  }

  if (isBulkPublicUploadBatch(input)) {
    return "display_name" as const;
  }

  return null;
}

function isPublicAnonymousStudentUploadBatch(input: {
  purpose: UploadPurpose;
  uploaderId: string | null;
}) {
  return input.purpose === UploadPurpose.STUDENT_SUBMISSION && input.uploaderId === null;
}

function isBulkPublicUploadBatch(input: {
  encryptedIdentity: string | null;
  purpose: UploadPurpose;
  uploaderId: string | null;
}) {
  return isPublicAnonymousStudentUploadBatch(input) && input.encryptedIdentity === null;
}

function normalizeAssignmentKey(value: string) {
  return value.trim().toLowerCase();
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

async function createZipEntries(
  rootFolder: string,
  files: Array<{
    relativePath: string;
    storageObjectKey: string;
  }>,
) {
  const entries: Record<string, Uint8Array> = {};

  for (const file of files) {
    entries[`${rootFolder}/${normalizeArchiveRelativePath(file.relativePath)}`] =
      await readObjectBuffer(file.storageObjectKey);
  }

  return entries;
}

function normalizeArchiveRelativePath(relativePath: string) {
  return relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
}

function sanitizeArchiveSegment(value: string) {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "artifact";
}

function sanitizeDownloadName(value: string) {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "download";
}

async function deleteObjectKeysBestEffort(objectKeys: Iterable<string>) {
  const results = await Promise.allSettled(
    [...new Set(objectKeys)].map((objectKey) => deleteObject(objectKey)),
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.warn("failed to delete object storage artifact", result.reason);
    }
  });
}
