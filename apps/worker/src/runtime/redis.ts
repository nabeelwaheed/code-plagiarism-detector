import { Redis } from "ioredis";
import { workerRuntimeConfig } from "../config/runtime-config.js";

export function createRedisConnection() {
  return new Redis(workerRuntimeConfig.redisUrl, {
    maxRetriesPerRequest: null,
  });
}
