import type {
  AssignmentLanguage,
  EngineSubmissionPayload,
  SubmissionKind,
} from "@similarity/shared";
import { buildDeterministicConcatenation } from "./concat.service.js";
import { prepareUploadArtifacts } from "./prepare-upload-artifacts.service.js";
import { enqueueComparisonRunForAssignment } from "./queue-comparison-run.service.js";
import {
  markUploadBatchFailed,
  markUploadBatchProcessing,
  persistPreparedSubmissions,
  persistPreparedTemplate,
  type PreparedSubmissionPersistenceInput,
  type PreparedTemplatePersistenceInput,
} from "./persist-prepared-upload.service.js";

export interface UploadPreparationJob {
  assignmentId: string;
  assignmentLanguage: AssignmentLanguage;
  uploadBatchId: string;
  kind: SubmissionKind | "template";
  preparedSubmissions?: PreparedSubmissionPersistenceInput[];
  preparedTemplate?: PreparedTemplatePersistenceInput;
}

export async function processUploadPreparationJob(job: UploadPreparationJob) {
  try {
    await markUploadBatchProcessing(job.uploadBatchId);

    if (job.kind === "template" && job.preparedTemplate) {
      await persistPreparedTemplate(job.assignmentId, job.uploadBatchId, job.preparedTemplate);
      await enqueueComparisonRunForAssignment(job.assignmentId);
      return {
        assignmentId: job.assignmentId,
        uploadBatchId: job.uploadBatchId,
        status: "prepared",
        preparedCount: 1,
      };
    }

    if (job.kind !== "template" && job.preparedSubmissions?.length) {
      await persistPreparedSubmissions(
        job.assignmentId,
        job.uploadBatchId,
        job.preparedSubmissions,
      );
      await enqueueComparisonRunForAssignment(job.assignmentId);
      return {
        assignmentId: job.assignmentId,
        uploadBatchId: job.uploadBatchId,
        status: "prepared",
        preparedCount: job.preparedSubmissions.length,
      };
    }

    const preparedArtifacts = await prepareUploadArtifacts({
      assignmentId: job.assignmentId,
      assignmentLanguage: job.assignmentLanguage,
      uploadBatchId: job.uploadBatchId,
      kind: job.kind,
    });

    if (job.kind === "template" && preparedArtifacts.template) {
      await persistPreparedTemplate(job.assignmentId, job.uploadBatchId, preparedArtifacts.template);
      await enqueueComparisonRunForAssignment(job.assignmentId);
      return {
        assignmentId: job.assignmentId,
        uploadBatchId: job.uploadBatchId,
        status: "prepared",
        preparedCount: 1,
      };
    }

    if (preparedArtifacts.submissions?.length) {
      await persistPreparedSubmissions(
        job.assignmentId,
        job.uploadBatchId,
        preparedArtifacts.submissions,
      );
      await enqueueComparisonRunForAssignment(job.assignmentId);
      return {
        assignmentId: job.assignmentId,
        uploadBatchId: job.uploadBatchId,
        status: "prepared",
        preparedCount: preparedArtifacts.submissions.length,
      };
    }

    return {
      assignmentId: job.assignmentId,
      uploadBatchId: job.uploadBatchId,
      status: "awaiting_artifacts",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "upload preparation failed";
    await markUploadBatchFailed(job.uploadBatchId, message);
    throw error;
  }
}

export function buildEngineSubmissionPayload(input: {
  submissionId: string;
  kind: SubmissionKind;
  assignmentLanguage: AssignmentLanguage;
  extractedFiles: Array<{ relativePath: string; contents: string }>;
}): EngineSubmissionPayload {
  const concatenation = buildDeterministicConcatenation(
    input.assignmentLanguage,
    input.extractedFiles,
  );

  return {
    submissionId: input.submissionId,
    submissionKind: input.kind,
    source: concatenation.source,
    sourceMap: concatenation.sourceMap,
  };
}
