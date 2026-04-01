import { mkdir } from "node:fs/promises";
import { workerRuntimeConfig } from "./config/runtime-config.js";
import { createRedisConnection } from "./runtime/redis.js";
import { registerWorkers } from "./runtime/workers.js";
import { ensureEngineBinaryReady } from "./services/engine-runner.service.js";

async function bootstrap() {
  await ensureEngineBinaryReady();
  await mkdir(workerRuntimeConfig.objectStorageRoot, { recursive: true });
  const connection = createRedisConnection();
  await registerWorkers(connection);
}

void bootstrap();
