import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { apiRuntimeConfig } from "../../config/runtime-config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { QueueService } from "../queue/queue.service.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CreateComparisonRunDto } from "./dto/create-comparison-run.dto.js";

@Injectable()
export class ComparisonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async createComparisonRun(payload: CreateComparisonRunDto, user: AuthenticatedUser) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: payload.assignmentId },
      include: {
        submissions: {
          orderBy: {
            createdAt: "asc",
          },
        },
        templateVersions: {
          where: { isActive: true },
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException("That assignment no longer exists");
    }

    if (assignment.professorId !== user.id) {
      throw new ForbiddenException("You do not have access to this assignment");
    }

    const comparisonRun = await this.prisma.comparisonRun.create({
      data: {
        assignmentId: assignment.id,
        templateVersionId: assignment.templateVersions[0]?.id,
        engineVersion: apiRuntimeConfig.engine.version,
        paramsJson: {
          gstMinMatchLength: apiRuntimeConfig.engine.gstMinMatchLength,
          minimumCommentLength: apiRuntimeConfig.engine.minimumCommentLength,
        },
      },
    });

    await this.queueService.enqueueComparisonRun({
      comparisonRunId: comparisonRun.id,
      assignmentId: assignment.id,
      assignmentLanguage: assignment.language.toLowerCase(),
      submissions: assignment.submissions.map((submission: typeof assignment.submissions[number]) => ({
        submissionId: submission.id,
        submissionKind: submission.kind.toLowerCase(),
        source: submission.concatenatedSource,
        sourceMap: submission.sourceMapJson as Array<{
          filePath: string;
          byteStart: number;
          byteEnd: number;
        }>,
      })),
      template: assignment.templateVersions[0]
        ? {
            source: assignment.templateVersions[0].concatenatedSource,
            sourceMap: assignment.templateVersions[0].sourceMapJson as Array<{
              filePath: string;
              byteStart: number;
              byteEnd: number;
            }>,
          }
        : undefined,
    });

    return comparisonRun;
  }

  async getComparisonRun(comparisonRunId: string, user: AuthenticatedUser) {
    const comparisonRun = await this.prisma.comparisonRun.findUnique({
      where: { id: comparisonRunId },
      include: {
        assignment: {
          select: {
            professorId: true,
          },
        },
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
    });

    if (!comparisonRun) {
      return null;
    }

    if (comparisonRun.assignment.professorId !== user.id) {
      throw new ForbiddenException("You do not have access to this comparison run");
    }

    return {
      id: comparisonRun.id,
      assignmentId: comparisonRun.assignmentId,
      templateVersionId: comparisonRun.templateVersionId,
      status: comparisonRun.status.toLowerCase(),
      engineVersion: comparisonRun.engineVersion,
      params: comparisonRun.paramsJson,
      createdAt: comparisonRun.createdAt,
      startedAt: comparisonRun.startedAt,
      completedAt: comparisonRun.completedAt,
      errorMessage: comparisonRun.errorMessage,
      pairResults: comparisonRun.pairResults.map((pairResult) => ({
        id: pairResult.id,
        similarityScore: pairResult.similarityScore,
        commentScore: pairResult.commentScore,
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
        matches: pairResult.matches.map((match) => ({
          matchId: match.matchKey,
          kind: match.kind.toLowerCase(),
          matchedTokenCount:
            (match.leftTokenEnd ?? match.leftTokenStart ?? 0)
            - (match.leftTokenStart ?? 0),
          left: {
            byteStart: match.leftByteStart,
            byteEnd: match.leftByteEnd,
            position:
              match.leftLineStart && match.leftLineEnd
                ? {
                    lineStart: match.leftLineStart,
                    columnStart: 1,
                    lineEnd: match.leftLineEnd,
                    columnEnd: 1,
                  }
                : undefined,
            tokens:
              match.leftTokenStart !== null && match.leftTokenEnd !== null
                ? {
                    tokenStart: match.leftTokenStart,
                    tokenEnd: match.leftTokenEnd,
                  }
                : undefined,
          },
          right: {
            byteStart: match.rightByteStart,
            byteEnd: match.rightByteEnd,
            position:
              match.rightLineStart && match.rightLineEnd
                ? {
                    lineStart: match.rightLineStart,
                    columnStart: 1,
                    lineEnd: match.rightLineEnd,
                    columnEnd: 1,
                  }
                : undefined,
            tokens:
              match.rightTokenStart !== null && match.rightTokenEnd !== null
                ? {
                    tokenStart: match.rightTokenStart,
                    tokenEnd: match.rightTokenEnd,
                  }
                : undefined,
          },
        })),
      })),
    };
  }

  async getPairResult(pairResultId: string, user: AuthenticatedUser) {
    const pairResult = await this.prisma.pairResult.findUnique({
      where: { id: pairResultId },
      include: {
        comparisonRun: {
          include: {
            assignment: {
              select: {
                id: true,
                language: true,
                title: true,
                professorId: true,
              },
            },
          },
        },
        leftSubmission: {
          include: {
            files: {
              orderBy: { canonicalOrder: "asc" },
            },
          },
        },
        rightSubmission: {
          include: {
            files: {
              orderBy: { canonicalOrder: "asc" },
            },
          },
        },
        matches: true,
      },
    });

    if (!pairResult) {
      return null;
    }

    if (pairResult.comparisonRun.assignment.professorId !== user.id) {
      throw new ForbiddenException("You do not have access to this pair result");
    }

    return {
      id: pairResult.id,
      comparisonRunId: pairResult.comparisonRunId,
      assignment: {
        id: pairResult.comparisonRun.assignment.id,
        title: pairResult.comparisonRun.assignment.title,
        language: pairResult.comparisonRun.assignment.language.toLowerCase(),
      },
      similarityScore: pairResult.similarityScore,
      commentScore: pairResult.commentScore,
      matchedTokenCount: pairResult.matchedTokenCount,
      leftSubmission: {
        id: pairResult.leftSubmission.id,
        displayName: pairResult.leftSubmission.displayName,
        kind: pairResult.leftSubmission.kind.toLowerCase(),
        concatenatedSource: pairResult.leftSubmission.concatenatedSource,
        sourceMap: pairResult.leftSubmission.sourceMapJson,
        files: pairResult.leftSubmission.files.map((file) => ({
          id: file.id,
          relativePath: file.relativePath,
          canonicalOrder: file.canonicalOrder,
          byteStart: file.byteStart,
          byteEnd: file.byteEnd,
          archivePath: file.archivePath,
        })),
      },
      rightSubmission: {
        id: pairResult.rightSubmission.id,
        displayName: pairResult.rightSubmission.displayName,
        kind: pairResult.rightSubmission.kind.toLowerCase(),
        concatenatedSource: pairResult.rightSubmission.concatenatedSource,
        sourceMap: pairResult.rightSubmission.sourceMapJson,
        files: pairResult.rightSubmission.files.map((file) => ({
          id: file.id,
          relativePath: file.relativePath,
          canonicalOrder: file.canonicalOrder,
          byteStart: file.byteStart,
          byteEnd: file.byteEnd,
          archivePath: file.archivePath,
        })),
      },
      matches: pairResult.matches.map((match) => ({
        matchId: match.matchKey,
        kind: match.kind.toLowerCase(),
        matchedTokenCount:
          (match.leftTokenEnd ?? match.leftTokenStart ?? 0) - (match.leftTokenStart ?? 0),
        left: {
          byteStart: match.leftByteStart,
          byteEnd: match.leftByteEnd,
          position:
            match.leftLineStart && match.leftLineEnd
              ? {
                  lineStart: match.leftLineStart,
                  columnStart: 1,
                  lineEnd: match.leftLineEnd,
                  columnEnd: 1,
                }
              : undefined,
          tokens:
            match.leftTokenStart !== null && match.leftTokenEnd !== null
              ? {
                  tokenStart: match.leftTokenStart,
                  tokenEnd: match.leftTokenEnd,
                }
              : undefined,
        },
        right: {
          byteStart: match.rightByteStart,
          byteEnd: match.rightByteEnd,
          position:
            match.rightLineStart && match.rightLineEnd
              ? {
                  lineStart: match.rightLineStart,
                  columnStart: 1,
                  lineEnd: match.rightLineEnd,
                  columnEnd: 1,
                }
              : undefined,
          tokens:
            match.rightTokenStart !== null && match.rightTokenEnd !== null
              ? {
                  tokenStart: match.rightTokenStart,
                  tokenEnd: match.rightTokenEnd,
                }
              : undefined,
        },
      })),
    };
  }
}
