import assert from "node:assert/strict";
import test from "node:test";
import { deriveAssignmentComparisonState } from "./comparison-status.js";

test("deriveAssignmentComparisonState reports preparing when uploads are active", () => {
  const result = deriveAssignmentComparisonState({
    hasActiveUploads: true,
    hasActiveComparisonRuns: false,
    currentSubmissionCount: 1,
    historicalSubmissionCount: 1,
    comparisonInputVersion: 2,
    comparisonRuns: [],
  });

  assert.deepEqual(result, {
    status: "preparing",
    canRunComparison: false,
    isStale: false,
  });
});

test("deriveAssignmentComparisonState reports current when a completed run matches the current input version", () => {
  const result = deriveAssignmentComparisonState({
    hasActiveUploads: false,
    hasActiveComparisonRuns: false,
    currentSubmissionCount: 1,
    historicalSubmissionCount: 1,
    comparisonInputVersion: 3,
    comparisonRuns: [
      { status: "FAILED", inputVersion: 3 },
      { status: "COMPLETED", inputVersion: 3 },
      { status: "COMPLETED", inputVersion: 2 },
    ],
  });

  assert.deepEqual(result, {
    status: "current",
    canRunComparison: true,
    isStale: false,
  });
});

test("deriveAssignmentComparisonState reports stale when only older completed results exist", () => {
  const result = deriveAssignmentComparisonState({
    hasActiveUploads: false,
    hasActiveComparisonRuns: false,
    currentSubmissionCount: 2,
    historicalSubmissionCount: 0,
    comparisonInputVersion: 4,
    comparisonRuns: [
      { status: "COMPLETED", inputVersion: 3 },
      { status: "FAILED", inputVersion: 2 },
    ],
  });

  assert.deepEqual(result, {
    status: "stale",
    canRunComparison: true,
    isStale: true,
  });
});

test("deriveAssignmentComparisonState reports failed when the current input version has only failed runs", () => {
  const result = deriveAssignmentComparisonState({
    hasActiveUploads: false,
    hasActiveComparisonRuns: false,
    currentSubmissionCount: 1,
    historicalSubmissionCount: 1,
    comparisonInputVersion: 5,
    comparisonRuns: [
      { status: "FAILED", inputVersion: 5 },
      { status: "COMPLETED", inputVersion: 4 },
    ],
  });

  assert.deepEqual(result, {
    status: "failed",
    canRunComparison: true,
    isStale: false,
  });
});
