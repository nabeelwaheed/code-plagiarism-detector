import type { Redis } from "ioredis";
import { type Job, Worker } from "bullmq";
import { COMPARISON_RUN_QUEUE, UPLOAD_PREPARATION_QUEUE } from "@similarity/shared";
import { workerRuntimeConfig } from "../config/runtime-config.js";
import {
  type ComparisonRunJob,
  processComparisonRunJob,
} from "../services/comparison-run.processor.js";
import {
  type UploadPreparationJob,
  processUploadPreparationJob,
} from "../services/upload-preparation.processor.js";

export async function registerWorkers(connection: Redis) {
  const uploadWorker = new Worker(
    UPLOAD_PREPARATION_QUEUE,
    (job: Job<UploadPreparationJob>) => processUploadPreparationJob(job.data),
    { connection, concurrency: workerRuntimeConfig.uploadPreparationConcurrency },
  );

  const comparisonWorker = new Worker(
    COMPARISON_RUN_QUEUE,
    (job: Job<ComparisonRunJob>) => processComparisonRunJob(job.data),
    { connection, concurrency: workerRuntimeConfig.comparisonRunConcurrency },
  );

  await Promise.all([uploadWorker.waitUntilReady(), comparisonWorker.waitUntilReady()]);
}
