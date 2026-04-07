export type AssignmentComparisonStatus =
  | "not_ready"
  | "preparing"
  | "ready"
  | "running"
  | "current"
  | "stale"
  | "failed";

type ComparisonRunLike = {
  status: string;
  inputVersion: number;
};

export function hasRunnableComparisonInputs(input: {
  currentSubmissionCount: number;
  historicalSubmissionCount: number;
}) {
  return (
    input.currentSubmissionCount >= 1
    && input.currentSubmissionCount + input.historicalSubmissionCount >= 2
  );
}

export function deriveAssignmentComparisonState(input: {
  hasActiveUploads: boolean;
  hasActiveComparisonRuns: boolean;
  currentSubmissionCount: number;
  historicalSubmissionCount: number;
  comparisonInputVersion: number;
  comparisonRuns: ComparisonRunLike[];
}) {
  if (input.hasActiveUploads) {
    return {
      status: "preparing" as const,
      canRunComparison: false,
      isStale: false,
    };
  }

  if (input.hasActiveComparisonRuns) {
    return {
      status: "running" as const,
      canRunComparison: false,
      isStale: false,
    };
  }

  if (
    !hasRunnableComparisonInputs({
      currentSubmissionCount: input.currentSubmissionCount,
      historicalSubmissionCount: input.historicalSubmissionCount,
    })
  ) {
    return {
      status: "not_ready" as const,
      canRunComparison: false,
      isStale: false,
    };
  }

  const currentCompletedRun = input.comparisonRuns.find(
    (run) =>
      run.inputVersion === input.comparisonInputVersion
      && run.status.toUpperCase() === "COMPLETED",
  );

  if (currentCompletedRun) {
    return {
      status: "current" as const,
      canRunComparison: true,
      isStale: false,
    };
  }

  const latestCurrentVersionRun = input.comparisonRuns.find(
    (run) => run.inputVersion === input.comparisonInputVersion,
  );

  if (latestCurrentVersionRun?.status?.toUpperCase() === "FAILED") {
    return {
      status: "failed" as const,
      canRunComparison: true,
      isStale: false,
    };
  }

  const hasCompletedStaleRun = input.comparisonRuns.some(
    (run) =>
      run.inputVersion < input.comparisonInputVersion
      && run.status.toUpperCase() === "COMPLETED",
  );

  if (hasCompletedStaleRun) {
    return {
      status: "stale" as const,
      canRunComparison: true,
      isStale: true,
    };
  }

  return {
    status: "ready" as const,
    canRunComparison: true,
    isStale: false,
  };
}
