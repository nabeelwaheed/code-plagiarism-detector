import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { deleteObject } from "@similarity/shared";
import {
  ComparisonRunStatus,
  Prisma,
  UploadBatchStatus,
} from "@prisma/client";

export const ACTIVE_ASSIGNMENT_DELETE_BLOCK_MESSAGE =
  "This assignment has uploads or comparison runs in progress. Please wait for them to finish before deleting anything.";
export const ACTIVE_ACCOUNT_DELETE_BLOCK_MESSAGE =
  "One or more of your assignments has uploads or comparison runs in progress. Please wait for them to finish before deleting your account.";

type AssignmentAccessClient = Pick<
  Prisma.TransactionClient,
  | "assignment"
  | "assignmentKey"
  | "uploadBatch"
  | "comparisonRun"
  | "pairMatch"
  | "pairResult"
  | "assignmentTemplate"
  | "submission"
  | "submissionFile"
  | "templateFile"
>;

type AssignmentArtifactSnapshot = {
  uploadBatches: Array<{ originalObjectKey: string }>;
  submissions: Array<{ files: Array<{ storageObjectKey: string }> }>;
  templateVersions: Array<{ files: Array<{ storageObjectKey: string }> }>;
};

export async function assertProfessorOwnsAssignment(
  prisma: AssignmentAccessClient,
  assignmentId: string,
  professorId: string,
) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { professorId: true },
  });

  if (!assignment) {
    throw new NotFoundException("That assignment no longer exists");
  }

  if (assignment.professorId !== professorId) {
    throw new ForbiddenException("You do not have access to this assignment");
  }
}

export async function assertAssignmentHasNoActiveJobs(
  prisma: AssignmentAccessClient,
  assignmentId: string,
) {
  const [activeUploadCount, activeComparisonCount] = await Promise.all([
    prisma.uploadBatch.count({
      where: {
        assignmentId,
        status: {
          in: [UploadBatchStatus.RECEIVED, UploadBatchStatus.PROCESSING],
        },
      },
    }),
    prisma.comparisonRun.count({
      where: {
        assignmentId,
        status: {
          in: [ComparisonRunStatus.QUEUED, ComparisonRunStatus.RUNNING],
        },
      },
    }),
  ]);

  if (hasActiveAssignmentJobs(activeUploadCount, activeComparisonCount)) {
    throw new BadRequestException(ACTIVE_ASSIGNMENT_DELETE_BLOCK_MESSAGE);
  }
}

export async function assertProfessorHasNoActiveAssignmentJobs(
  prisma: AssignmentAccessClient,
  professorId: string,
) {
  const [activeUploadCount, activeComparisonCount] = await Promise.all([
    prisma.uploadBatch.count({
      where: {
        assignment: { professorId },
        status: {
          in: [UploadBatchStatus.RECEIVED, UploadBatchStatus.PROCESSING],
        },
      },
    }),
    prisma.comparisonRun.count({
      where: {
        assignment: { professorId },
        status: {
          in: [ComparisonRunStatus.QUEUED, ComparisonRunStatus.RUNNING],
        },
      },
    }),
  ]);

  if (hasActiveAssignmentJobs(activeUploadCount, activeComparisonCount)) {
    throw new BadRequestException(ACTIVE_ACCOUNT_DELETE_BLOCK_MESSAGE);
  }
}

export function hasActiveAssignmentJobs(
  activeUploadCount: number,
  activeComparisonCount: number,
) {
  return activeUploadCount > 0 || activeComparisonCount > 0;
}

export function collectAssignmentObjectKeys(
  assignments: AssignmentArtifactSnapshot | AssignmentArtifactSnapshot[],
) {
  const snapshots = Array.isArray(assignments) ? assignments : [assignments];
  const objectKeys = new Set<string>();

  for (const assignment of snapshots) {
    for (const uploadBatch of assignment.uploadBatches) {
      objectKeys.add(uploadBatch.originalObjectKey);
    }

    for (const submission of assignment.submissions) {
      for (const file of submission.files) {
        objectKeys.add(file.storageObjectKey);
      }
    }

    for (const template of assignment.templateVersions) {
      for (const file of template.files) {
        objectKeys.add(file.storageObjectKey);
      }
    }
  }

  return objectKeys;
}

export async function clearAssignmentComparisonData(
  tx: AssignmentAccessClient,
  assignmentId: string,
) {
  await tx.pairMatch.deleteMany({
    where: {
      pairResult: {
        comparisonRun: {
          assignmentId,
        },
      },
    },
  });

  await tx.pairResult.deleteMany({
    where: {
      comparisonRun: {
        assignmentId,
      },
    },
  });

  await tx.comparisonRun.deleteMany({
    where: { assignmentId },
  });
}

export async function deleteAssignmentOwnedData(
  tx: AssignmentAccessClient,
  assignmentId: string,
) {
  await clearAssignmentComparisonData(tx, assignmentId);

  await tx.submissionFile.deleteMany({
    where: {
      submission: {
        assignmentId,
      },
    },
  });

  await tx.templateFile.deleteMany({
    where: {
      assignmentTemplate: {
        assignmentId,
      },
    },
  });

  await tx.submission.deleteMany({
    where: { assignmentId },
  });

  await tx.assignmentTemplate.deleteMany({
    where: { assignmentId },
  });

  await tx.uploadBatch.deleteMany({
    where: { assignmentId },
  });

  await tx.assignmentKey.deleteMany({
    where: { assignmentId },
  });

  await tx.assignment.deleteMany({
    where: { id: assignmentId },
  });
}

export function selectPromotedTemplateId(
  templates: Array<{ id: string; versionNumber: number; createdAt: Date }>,
) {
  const nextTemplate = [...templates].sort((left, right) => {
    if (right.versionNumber !== left.versionNumber) {
      return right.versionNumber - left.versionNumber;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  })[0];

  return nextTemplate?.id ?? null;
}

export async function promoteNewestRemainingTemplate(
  tx: AssignmentAccessClient,
  assignmentId: string,
) {
  const remainingTemplates = await tx.assignmentTemplate.findMany({
    where: { assignmentId },
    select: {
      id: true,
      versionNumber: true,
      createdAt: true,
    },
  });
  const promotedTemplateId = selectPromotedTemplateId(remainingTemplates);

  await tx.assignmentTemplate.updateMany({
    where: { assignmentId },
    data: { isActive: false },
  });

  if (promotedTemplateId) {
    await tx.assignmentTemplate.update({
      where: { id: promotedTemplateId },
      data: { isActive: true },
    });
  }
}

export async function deleteObjectKeysBestEffort(objectKeys: Iterable<string>) {
  const results = await Promise.allSettled(
    [...new Set(objectKeys)].map((objectKey) => deleteObject(objectKey)),
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.warn("failed to delete object storage artifact", result.reason);
    }
  });
}
