import type {
  AssignmentLanguage,
  EngineSubmissionPayload,
  SubmissionKind,
} from "@similarity/shared";
import { buildDeterministicConcatenation } from "./concat.service.js";
import { prepareUploadArtifacts } from "./prepare-upload-artifacts.service.js";
import {
  markUploadBatchFailed,
  markUploadBatchProcessing,
  persistPreparedSubmissions,
  persistPreparedTemplate,
  type PreparedSubmissionPersistenceInput,
  type PreparedTemplatePersistenceInput,
} from "./persist-prepared-upload.service.js";
import { getUserFacingUploadFailureMessage } from "./user-facing-error-messages.js";

export interface UploadPreparationJob {
  assignmentId: string;
  assignmentLanguage: AssignmentLanguage;
  uploadBatchId: string;
  kind: SubmissionKind | "template" | "bulk_current";
  preparedSubmissions?: PreparedSubmissionPersistenceInput[];
  preparedTemplate?: PreparedTemplatePersistenceInput;
}

export async function processUploadPreparationJob(job: UploadPreparationJob) {
  try {
    await markUploadBatchProcessing(job.uploadBatchId);

    if (job.kind === "template" && job.preparedTemplate) {
      await persistPreparedTemplate(job.assignmentId, job.uploadBatchId, job.preparedTemplate);
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
    const message = getUserFacingUploadFailureMessage(error);
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
