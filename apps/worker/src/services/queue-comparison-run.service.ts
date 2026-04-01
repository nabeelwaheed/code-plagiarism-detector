import { Queue } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { COMPARISON_RUN_QUEUE } from "@similarity/shared";
import { workerRuntimeConfig } from "../config/runtime-config.js";
import { createRedisConnection } from "../runtime/redis.js";

const prisma = new PrismaClient();
const connection = createRedisConnection();
const comparisonRunQueue = new Queue(COMPARISON_RUN_QUEUE, { connection });

export async function enqueueComparisonRunForAssignment(assignmentId: string) {
  const assignment = await prisma.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      submissions: {
        orderBy: { createdAt: "asc" },
      },
      templateVersions: {
        where: { isActive: true },
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });

  const comparisonRun = await prisma.comparisonRun.create({
    data: {
      assignmentId,
      templateVersionId: assignment.templateVersions[0]?.id,
      engineVersion: workerRuntimeConfig.engineVersion,
      paramsJson: {
        gstMinMatchLength: workerRuntimeConfig.gstMinMatchLength,
        minimumCommentLength: workerRuntimeConfig.minimumCommentLength,
      },
    },
  });

  await comparisonRunQueue.add("run-comparison", {
    comparisonRunId: comparisonRun.id,
    assignmentId,
    assignmentLanguage: assignment.language.toLowerCase(),
    submissions: assignment.submissions.map((submission) => ({
      submissionId: submission.id,
      submissionKind: submission.kind.toLowerCase(),
      source: submission.concatenatedSource,
      sourceMap: submission.sourceMapJson,
    })),
    template: assignment.templateVersions[0]
      ? {
          source: assignment.templateVersions[0].concatenatedSource,
          sourceMap: assignment.templateVersions[0].sourceMapJson,
        }
      : undefined,
  });

  return comparisonRun.id;
}
