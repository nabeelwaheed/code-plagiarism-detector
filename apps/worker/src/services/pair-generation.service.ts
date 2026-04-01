import type { EnginePairPayload, EngineSubmissionPayload } from "@similarity/shared";

export function generateAllowedPairs(
  submissions: EngineSubmissionPayload[],
): EnginePairPayload[] {
  const current = submissions.filter((submission) => submission.submissionKind === "current");
  const historical = submissions.filter(
    (submission) => submission.submissionKind === "historical",
  );

  const pairs: EnginePairPayload[] = [];

  for (let leftIndex = 0; leftIndex < current.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < current.length; rightIndex += 1) {
      const left = current[leftIndex]!;
      const right = current[rightIndex]!;
      pairs.push({
        pairId: `${left.submissionId}__${right.submissionId}`,
        leftSubmissionId: left.submissionId,
        rightSubmissionId: right.submissionId,
      });
    }
  }

  for (const left of current) {
    for (const right of historical) {
      pairs.push({
        pairId: `${left.submissionId}__${right.submissionId}`,
        leftSubmissionId: left.submissionId,
        rightSubmissionId: right.submissionId,
      });
    }
  }

  return pairs;
}

