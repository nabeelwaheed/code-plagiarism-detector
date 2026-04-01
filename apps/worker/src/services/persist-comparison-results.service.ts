import { MatchKind, Prisma, PrismaClient } from "@prisma/client";
import type { EngineRunResponse } from "@similarity/shared";

const prisma = new PrismaClient();

export async function markComparisonRunRunning(comparisonRunId: string) {
  await prisma.comparisonRun.update({
    where: { id: comparisonRunId },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      errorMessage: null,
    },
  });
}

export async function persistComparisonResults(
  comparisonRunId: string,
  response: EngineRunResponse,
) {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.pairMatch.deleteMany({
      where: {
        pairResult: {
          comparisonRunId,
        },
      },
    });

    await tx.pairResult.deleteMany({
      where: { comparisonRunId },
    });

    for (const [index, pairResult] of response.pairResults.entries()) {
      const createdPair = await tx.pairResult.create({
        data: {
          comparisonRunId,
          leftSubmissionId: pairResult.leftSubmissionId,
          rightSubmissionId: pairResult.rightSubmissionId,
          similarityScore: pairResult.similarityScore,
          commentScore: pairResult.commentScore,
          matchedTokenCount: pairResult.matchedTokenCount,
          sortOrder: index,
        },
      });

      if (pairResult.matches.length > 0) {
        await tx.pairMatch.createMany({
          data: pairResult.matches.map((match) => ({
            pairResultId: createdPair.id,
            matchKey: match.matchId,
            kind: match.kind === "comment" ? MatchKind.COMMENT : MatchKind.CODE,
            leftByteStart: match.left.byteStart,
            leftByteEnd: match.left.byteEnd,
            rightByteStart: match.right.byteStart,
            rightByteEnd: match.right.byteEnd,
            leftLineStart: match.left.position?.lineStart,
            leftLineEnd: match.left.position?.lineEnd,
            rightLineStart: match.right.position?.lineStart,
            rightLineEnd: match.right.position?.lineEnd,
            leftTokenStart: match.left.tokens?.tokenStart,
            leftTokenEnd: match.left.tokens?.tokenEnd,
            rightTokenStart: match.right.tokens?.tokenStart,
            rightTokenEnd: match.right.tokens?.tokenEnd,
          })),
        });
      }
    }

    await tx.comparisonRun.update({
      where: { id: comparisonRunId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
  });
}

export async function markComparisonRunFailed(comparisonRunId: string, errorMessage: string) {
  await prisma.comparisonRun.update({
    where: { id: comparisonRunId },
    data: {
      status: "FAILED",
      errorMessage,
      completedAt: new Date(),
    },
  });
}
