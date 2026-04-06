import { ForbiddenException, Injectable } from "@nestjs/common";
import { AssignmentLanguage } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { CreateAssignmentDto } from "./dto/create-assignment.dto.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import {
  assertAssignmentHasNoActiveJobs,
  assertProfessorOwnsAssignment,
  collectAssignmentObjectKeys,
  deleteAssignmentOwnedData,
  deleteObjectKeysBestEffort,
} from "./assignment-maintenance.js";

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAssignment(payload: CreateAssignmentDto, user: AuthenticatedUser) {
    const created = await this.prisma.assignment.create({
      data: {
        title: payload.title,
        language: payload.language.toUpperCase() as AssignmentLanguage,
        professorId: user.id,
        keys: {
          create: {
            publicKey: this.generateAssignmentKey(),
          },
        },
      },
      include: {
        keys: true,
      },
    });

    return {
      id: created.id,
      title: created.title,
      language: created.language.toLowerCase(),
      professorId: created.professorId,
      createdAt: created.createdAt,
      keys: created.keys.map((key) => ({
        id: key.id,
        publicKey: key.publicKey,
        isActive: key.isActive,
        createdAt: key.createdAt,
      })),
    };
  }

  async listAssignments(user: AuthenticatedUser) {
    const assignments = await this.prisma.assignment.findMany({
      where: { professorId: user.id },
      include: {
        keys: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        submissions: {
          select: {
            id: true,
            kind: true,
          },
        },
        comparisonRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            pairResults: {
              orderBy: { sortOrder: "asc" },
              take: 5,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return assignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      language: assignment.language.toLowerCase(),
      professorId: assignment.professorId,
      createdAt: assignment.createdAt,
      activeKey: assignment.keys[0]?.publicKey ?? null,
      submissionCounts: {
        current: assignment.submissions.filter((submission) => submission.kind === "CURRENT").length,
        historical: assignment.submissions.filter((submission) => submission.kind === "HISTORICAL").length,
      },
      latestComparisonRun: assignment.comparisonRuns[0]
        ? {
            id: assignment.comparisonRuns[0].id,
            status: assignment.comparisonRuns[0].status.toLowerCase(),
            createdAt: assignment.comparisonRuns[0].createdAt,
            pairCount: assignment.comparisonRuns[0].pairResults.length,
          }
        : null,
    }));
  }

  async getAssignment(assignmentId: string, user: AuthenticatedUser) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        keys: true,
        uploadBatches: {
          orderBy: {
            createdAt: "desc",
          },
        },
        submissions: {
          include: {
            files: {
              orderBy: { canonicalOrder: "asc" },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        templateVersions: {
          include: {
            files: {
              orderBy: { canonicalOrder: "asc" },
            },
          },
          orderBy: { versionNumber: "desc" },
        },
        comparisonRuns: {
          orderBy: { createdAt: "desc" },
          include: {
            pairResults: {
              orderBy: {
                sortOrder: "asc",
              },
              include: {
                matches: true,
                leftSubmission: {
                  select: {
                    id: true,
                    displayName: true,
                    kind: true,
                  },
                },
                rightSubmission: {
                  select: {
                    id: true,
                    displayName: true,
                    kind: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      return null;
    }

    if (assignment.professorId !== user.id) {
      throw new ForbiddenException("You do not have access to this assignment");
    }

    const activeTemplate = assignment.templateVersions.find((template) => template.isActive) ?? null;

    return {
      id: assignment.id,
      title: assignment.title,
      language: assignment.language.toLowerCase(),
      professorId: assignment.professorId,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      keys: assignment.keys.map((key) => ({
        id: key.id,
        publicKey: key.publicKey,
        isActive: key.isActive,
        createdAt: key.createdAt,
      })),
      uploadBatches: assignment.uploadBatches.map((batch) => ({
        id: batch.id,
        purpose: batch.purpose.toLowerCase(),
        status: batch.status.toLowerCase(),
        errorMessage: batch.errorMessage,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      })),
      submissions: assignment.submissions.map((submission) => ({
        id: submission.id,
        displayName: submission.displayName,
        kind: submission.kind.toLowerCase(),
        ownerId: submission.ownerId,
        createdAt: submission.createdAt,
        fileCount: submission.files.length,
        sourceMap: submission.sourceMapJson,
      })),
      activeTemplate: assignment.templateVersions.find((template) => template.isActive)
        ? {
            id: activeTemplate!.id,
            versionNumber: activeTemplate!.versionNumber,
            isActive: true,
            createdAt: activeTemplate!.createdAt,
            fileCount: activeTemplate!.files.length,
          }
        : null,
      templateVersions: assignment.templateVersions.map((template) => ({
        id: template.id,
        versionNumber: template.versionNumber,
        isActive: template.isActive,
        createdAt: template.createdAt,
        fileCount: template.files.length,
      })),
      comparisonRuns: assignment.comparisonRuns.map((run) => ({
        id: run.id,
        status: run.status.toLowerCase(),
        engineVersion: run.engineVersion,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        errorMessage: run.errorMessage,
        pairResults: run.pairResults.map((pairResult) => ({
          id: pairResult.id,
          similarityScore: pairResult.similarityScore,
          commentMatchCount: countCommentMatches(pairResult.matches),
          matchedTokenCount: pairResult.matchedTokenCount,
          leftSubmission: {
            id: pairResult.leftSubmission.id,
            displayName: pairResult.leftSubmission.displayName,
            kind: pairResult.leftSubmission.kind.toLowerCase(),
          },
          rightSubmission: {
            id: pairResult.rightSubmission.id,
            displayName: pairResult.rightSubmission.displayName,
            kind: pairResult.rightSubmission.kind.toLowerCase(),
          },
          matchCount: pairResult.matches.length,
        })),
      })),
    };
  }

  async deleteAssignment(assignmentId: string, user: AuthenticatedUser) {
    await assertProfessorOwnsAssignment(this.prisma, assignmentId, user.id);
    await assertAssignmentHasNoActiveJobs(this.prisma, assignmentId);

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        uploadBatches: {
          select: {
            originalObjectKey: true,
          },
        },
        submissions: {
          select: {
            files: {
              select: {
                storageObjectKey: true,
              },
            },
          },
        },
        templateVersions: {
          select: {
            files: {
              select: {
                storageObjectKey: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      return { ok: true };
    }

    const objectKeys = collectAssignmentObjectKeys(assignment);

    await this.prisma.$transaction(async (tx) => {
      await deleteAssignmentOwnedData(tx, assignmentId);
    });

    await deleteObjectKeysBestEffort(objectKeys);

    return { ok: true };
  }

  private generateAssignmentKey() {
    return randomBytes(8).toString("hex");
  }
}

function countCommentMatches(matches: Array<{ kind: "CODE" | "COMMENT" }>) {
  return matches.filter((match) => match.kind === "COMMENT").length;
}
