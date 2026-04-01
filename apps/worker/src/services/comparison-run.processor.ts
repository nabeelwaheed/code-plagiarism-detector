import type {
  AssignmentLanguage,
  EngineRunRequest,
  EngineSubmissionPayload,
  EngineTemplatePayload,
} from "@similarity/shared";
import { workerRuntimeConfig } from "../config/runtime-config.js";
import { generateAllowedPairs } from "./pair-generation.service.js";
import {
  markComparisonRunFailed,
  markComparisonRunRunning,
  persistComparisonResults,
} from "./persist-comparison-results.service.js";
import { runEngine } from "./engine-runner.service.js";
import { getUserFacingComparisonFailureMessage } from "./user-facing-error-messages.js";

export interface ComparisonRunJob {
  comparisonRunId: string;
  assignmentId: string;
  assignmentLanguage: AssignmentLanguage;
  submissions: EngineSubmissionPayload[];
  template?: EngineTemplatePayload;
}

export async function processComparisonRunJob(job: ComparisonRunJob) {
  try {
    await markComparisonRunRunning(job.comparisonRunId);

    const request: EngineRunRequest = {
      schemaVersion: "1.0",
      engineVersion: workerRuntimeConfig.engineVersion,
      language: job.assignmentLanguage,
      submissions: job.submissions,
      template: job.template,
      pairs: generateAllowedPairs(job.submissions),
      params: {
        gstMinMatchLength: workerRuntimeConfig.gstMinMatchLength,
        minimumCommentLength: workerRuntimeConfig.minimumCommentLength,
      },
    };

    const response = await runEngine(request);
    await persistComparisonResults(job.comparisonRunId, response);
    return response;
  } catch (error) {
    const message = getUserFacingComparisonFailureMessage();
    await markComparisonRunFailed(job.comparisonRunId, message);
    throw error;
  }
}
