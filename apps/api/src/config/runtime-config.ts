import { generateKeyPairSync } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnvFromKnownLocations();

const DEFAULT_DEV_CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

export interface ApiRuntimeConfig {
  nodeEnv: string;
  isProduction: boolean;
  host: string;
  port: number;
  redisUrl: string;
  databaseUrl: string;
  corsAllowedOrigins: string[];
  uploadMaxFileSizeBytes: number;
  session: {
    cookieName: string;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
    domain?: string;
    ttlMs: number;
  };
  publicUploads: {
    statusTokenSecret: string;
  };
  submissionIdentity: {
    keyId: string;
    publicKeyPem: string;
    privateKeyPem: string;
  };
  engine: {
    version: string;
    gstMinMatchLength: number;
    minimumCommentLength: number;
  };
}

export const apiRuntimeConfig = loadApiRuntimeConfig();

function loadApiRuntimeConfig(): ApiRuntimeConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  const databaseUrl = getRequiredEnv("DATABASE_URL");
  const redisUrl = getEnvValue("REDIS_URL", isProduction ? undefined : "redis://localhost:6379");
  const corsAllowedOrigins = getCorsAllowedOrigins(isProduction);
  const devIdentityKeyPair = !isProduction ? createDevSubmissionIdentityKeyPair() : null;

  return {
    nodeEnv,
    isProduction,
    host: getEnvValue("API_HOST", "0.0.0.0"),
    port: getIntegerEnv("API_PORT", 3001),
    redisUrl,
    databaseUrl,
    corsAllowedOrigins,
    uploadMaxFileSizeBytes: getIntegerEnv("UPLOAD_MAX_FILE_SIZE_MB", 250) * 1024 * 1024,
    session: {
      cookieName: getEnvValue("AUTH_SESSION_COOKIE_NAME", "similarity_session"),
      secure: getBooleanEnv("AUTH_COOKIE_SECURE", isProduction),
      sameSite: getSameSiteEnv("AUTH_COOKIE_SAME_SITE", isProduction ? "lax" : "lax"),
      domain: process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
      ttlMs: getIntegerEnv("AUTH_SESSION_TTL_HOURS", 24 * 7) * 60 * 60 * 1000,
    },
    publicUploads: {
      statusTokenSecret: getEnvValue(
        "PUBLIC_UPLOAD_STATUS_TOKEN_SECRET",
        isProduction ? undefined : "dev-public-upload-status-secret",
      ),
    },
    submissionIdentity: {
      keyId: getEnvValue(
        "SUBMISSION_IDENTITY_KEY_ID",
        isProduction ? undefined : "dev-submission-identity-key",
      ),
      publicKeyPem: getPemEnvValue(
        "SUBMISSION_IDENTITY_PUBLIC_KEY_PEM_BASE64",
        devIdentityKeyPair?.publicKeyPem,
      ),
      privateKeyPem: getPemEnvValue(
        "SUBMISSION_IDENTITY_PRIVATE_KEY_PEM_BASE64",
        devIdentityKeyPair?.privateKeyPem,
      ),
    },
    engine: {
      version: getEnvValue("ENGINE_VERSION", "0.1.0"),
      gstMinMatchLength: getIntegerEnv("ENGINE_GST_MIN_MATCH_LENGTH", 6),
      minimumCommentLength: getIntegerEnv("ENGINE_MINIMUM_COMMENT_LENGTH", 12),
    },
  };
}

function getCorsAllowedOrigins(isProduction: boolean) {
  const rawValue = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (!rawValue) {
    if (isProduction) {
      throw new Error("CORS_ALLOWED_ORIGINS is required in production");
    }
    return DEFAULT_DEV_CORS_ORIGINS;
  }

  return rawValue.split(",").map((value) => value.trim()).filter(Boolean);
}

function loadEnvFromKnownLocations() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", "..", ".env"),
    resolve(currentDir, "../../../../.env"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      process.loadEnvFile?.(candidate);
      return;
    }
  }
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  throw new Error(`${name} is required`);
}

function getEnvValue(name: string, defaultValue?: string) {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  if (defaultValue !== undefined) {
    return defaultValue;
  }

  throw new Error(`${name} is required`);
}

function getPemEnvValue(name: string, defaultValue?: string) {
  const value = process.env[name]?.trim();
  if (value) {
    return decodePemEnvValue(name, value);
  }

  if (defaultValue !== undefined) {
    return defaultValue;
  }

  throw new Error(`${name} is required`);
}

function getIntegerEnv(name: string, defaultValue: number) {
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

function getBooleanEnv(name: string, defaultValue: boolean) {
  const rawValue = process.env[name];
  if (!rawValue) {
    return defaultValue;
  }

  if (rawValue === "true") {
    return true;
  }

  if (rawValue === "false") {
    return false;
  }

  throw new Error(`${name} must be "true" or "false"`);
}

function getSameSiteEnv(
  name: string,
  defaultValue: "lax" | "strict" | "none",
): "lax" | "strict" | "none" {
  const rawValue = process.env[name]?.trim().toLowerCase();
  if (!rawValue) {
    return defaultValue;
  }

  if (rawValue === "lax" || rawValue === "strict" || rawValue === "none") {
    return rawValue;
  }

  throw new Error(`${name} must be one of: lax, strict, none`);
}

function decodePemEnvValue(name: string, value: string) {
  if (value.startsWith("-----BEGIN")) {
    return value;
  }

  try {
    const decodedValue = Buffer.from(value, "base64").toString("utf8").trim();
    if (!decodedValue.startsWith("-----BEGIN")) {
      throw new Error("decoded value is not PEM");
    }
    return decodedValue;
  } catch {
    throw new Error(`${name} must be a PEM string or base64-encoded PEM`);
  }
}

function createDevSubmissionIdentityKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  return {
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
  };
}
