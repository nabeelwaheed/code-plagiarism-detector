import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { COMPARISON_RUN_QUEUE, UPLOAD_PREPARATION_QUEUE } from "@similarity/shared";
import { apiRuntimeConfig } from "../../config/runtime-config.js";

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection = new Redis(apiRuntimeConfig.redisUrl);

  private readonly uploadPreparationQueue = new Queue(UPLOAD_PREPARATION_QUEUE, {
    connection: this.connection,
  });

  private readonly comparisonRunQueue = new Queue(COMPARISON_RUN_QUEUE, {
    connection: this.connection,
  });

  async enqueueUploadPreparation(job: Record<string, unknown>) {
    return this.uploadPreparationQueue.add("prepare-upload", job);
  }

  async enqueueComparisonRun(job: Record<string, unknown>) {
    return this.comparisonRunQueue.add("run-comparison", job);
  }

  async onModuleDestroy() {
    await Promise.all([
      this.uploadPreparationQueue.close(),
      this.comparisonRunQueue.close(),
      this.connection.quit(),
    ]);
  }
}
