import { resolve } from "node:path";

export interface WorkerRuntimeConfig {
  nodeEnv: string;
  isProduction: boolean;
  redisUrl: string;
  databaseUrl: string;
  objectStorageMode: "filesystem";
  objectStorageRoot: string;
  engineBinaryPath: string;
  engineVersion: string;
  uploadPreparationConcurrency: number;
  comparisonRunConcurrency: number;
  archiveMaxDepth: number;
  archiveMaxSourceFiles: number;
  archiveMaxExpandedBytes: number;
  gstMinMatchLength: number;
  minimumCommentLength: number;
}

export const workerRuntimeConfig = loadWorkerRuntimeConfig();

function loadWorkerRuntimeConfig(): WorkerRuntimeConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  return {
    nodeEnv,
    isProduction,
    redisUrl: getRequiredOrDevDefault("REDIS_URL", "redis://localhost:6379", isProduction),
    databaseUrl: getRequiredEnv("DATABASE_URL"),
    objectStorageMode: getObjectStorageMode(),
    objectStorageRoot: getObjectStorageRoot(isProduction),
    engineBinaryPath: getEngineBinaryPath(isProduction),
    engineVersion: process.env.ENGINE_VERSION?.trim() || "0.1.0",
    uploadPreparationConcurrency: getPositiveInteger("WORKER_UPLOAD_CONCURRENCY", 2),
    comparisonRunConcurrency: getPositiveInteger("WORKER_COMPARISON_CONCURRENCY", 1),
    archiveMaxDepth: getPositiveInteger("ARCHIVE_MAX_DEPTH", 8),
    archiveMaxSourceFiles: getPositiveInteger("ARCHIVE_MAX_SOURCE_FILES", 2000),
    archiveMaxExpandedBytes: getPositiveInteger("ARCHIVE_MAX_EXPANDED_BYTES", 50 * 1024 * 1024),
    gstMinMatchLength: getPositiveInteger("ENGINE_GST_MIN_MATCH_LENGTH", 8),
    minimumCommentLength: getPositiveInteger("ENGINE_MINIMUM_COMMENT_LENGTH", 12),
  };
}

function getObjectStorageRoot(isProduction: boolean) {
  const configuredPath = process.env.OBJECT_STORAGE_ROOT?.trim();
  if (configuredPath) {
    return resolve(configuredPath);
  }

  if (isProduction) {
    throw new Error("OBJECT_STORAGE_ROOT is required in production");
  }

  return resolve(process.cwd(), "var", "object-storage");
}

function getEngineBinaryPath(isProduction: boolean) {
  const configuredPath = process.env.ENGINE_BINARY_PATH?.trim();
  if (configuredPath) {
    return configuredPath;
  }

  if (isProduction) {
    throw new Error("ENGINE_BINARY_PATH is required in production");
  }

  return resolve(process.cwd(), "..", "..", "engine", "target", "debug", "engine-cli.exe");
}

function getObjectStorageMode(): "filesystem" {
  const rawValue = process.env.OBJECT_STORAGE_MODE?.trim();
  if (!rawValue || rawValue === "filesystem") {
    return "filesystem";
  }

  throw new Error("Only OBJECT_STORAGE_MODE=filesystem is currently supported");
}

function getRequiredOrDevDefault(name: string, devDefault: string, strict: boolean) {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  if (strict) {
    throw new Error(`${name} is required in production`);
  }

  return devDefault;
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  throw new Error(`${name} is required`);
}

function getPositiveInteger(name: string, defaultValue: number) {
  const rawValue = process.env[name];
  if (!rawValue) {
    return defaultValue;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}
