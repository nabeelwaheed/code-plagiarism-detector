import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MatchKind, Prisma, UploadPurpose, UploadBatchStatus, ComparisonRunStatus } from "@prisma/client";
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
    const [assignment, activeUploadCount, activeComparisonCount] = await Promise.all([
      this.prisma.assignment.findUnique({
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
      }),
      this.prisma.uploadBatch.count({
        where: {
          assignmentId: payload.assignmentId,
          status: {
            in: [UploadBatchStatus.RECEIVED, UploadBatchStatus.PROCESSING],
          },
        },
      }),
      this.prisma.comparisonRun.count({
        where: {
          assignmentId: payload.assignmentId,
          status: {
            in: [ComparisonRunStatus.QUEUED, ComparisonRunStatus.RUNNING],
          },
        },
      }),
    ]);

    if (!assignment) {
      throw new NotFoundException("That assignment no longer exists");
    }

    if (assignment.professorId !== user.id) {
      throw new ForbiddenException("You do not have access to this assignment");
    }

    if (activeUploadCount > 0) {
      throw new BadRequestException(
        "Uploads are still being prepared for this assignment. Please wait for them to finish before running comparisons.",
      );
    }

    if (activeComparisonCount > 0) {
      throw new BadRequestException(
        "A comparison run is already queued or running for this assignment.",
      );
    }

    const currentSubmissionCount = assignment.submissions.filter(
      (submission) => submission.kind === "CURRENT",
    ).length;
    const historicalSubmissionCount = assignment.submissions.filter(
      (submission) => submission.kind === "HISTORICAL",
    ).length;

    if (currentSubmissionCount === 0) {
      throw new BadRequestException("A comparison run requires at least one current submission.");
    }

    if (currentSubmissionCount + historicalSubmissionCount < 2) {
      throw new BadRequestException(
        "At least two non-template submissions are required to run a comparison.",
      );
    }

    let comparisonRun;
    try {
      comparisonRun = await this.prisma.comparisonRun.create({
        data: {
          assignmentId: assignment.id,
          templateVersionId: assignment.templateVersions[0]?.id,
          inputVersion: assignment.comparisonInputVersion,
          engineVersion: apiRuntimeConfig.engine.version,
          paramsJson: {
            gstMinMatchLength: apiRuntimeConfig.engine.gstMinMatchLength,
            minimumCommentLength: apiRuntimeConfig.engine.minimumCommentLength,
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException(
          "A comparison run is already queued or running for this assignment.",
        );
      }

      throw error;
    }

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
        },
        rightSubmission: {
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
      commentMatchCount: countCommentMatches(pairResult.matches),
      matchedTokenCount: pairResult.matchedTokenCount,
      leftSubmission: {
        id: pairResult.leftSubmission.id,
        displayName: pairResult.leftSubmission.displayName,
        kind: pairResult.leftSubmission.kind.toLowerCase(),
        identityRevealMode: getSubmissionIdentityRevealMode(pairResult.leftSubmission.uploadBatch),
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
        identityRevealMode: getSubmissionIdentityRevealMode(pairResult.rightSubmission.uploadBatch),
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

function countCommentMatches(matches: Array<{ kind: MatchKind }>) {
  return matches.filter((match) => match.kind === MatchKind.COMMENT).length;
}
