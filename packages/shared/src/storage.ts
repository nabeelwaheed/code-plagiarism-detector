import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const DEFAULT_OBJECT_STORAGE_ROOT = path.resolve(process.cwd(), "var", "object-storage");

export function getObjectStorageRoot() {
  const configuredRoot = process.env.OBJECT_STORAGE_ROOT?.trim();
  if (configuredRoot) {
    return path.resolve(configuredRoot);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("OBJECT_STORAGE_ROOT is required in production");
  }

  return path.resolve(DEFAULT_OBJECT_STORAGE_ROOT);
}

export function createObjectKey(prefix: string, fileName: string) {
  const normalizedPrefix = normalizeObjectKeyPrefix(prefix);
  const safeFileName = sanitizeFileName(fileName);
  return `${normalizedPrefix}/${crypto.randomUUID()}/${safeFileName}`;
}

export function getObjectFileName(objectKey: string) {
  return path.posix.basename(normalizeObjectKey(objectKey));
}

export async function writeObjectBuffer(
  objectKey: string,
  contents: Buffer | Uint8Array | string,
) {
  const targetPath = resolveObjectStoragePath(objectKey);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, contents);
  return objectKey;
}

export async function readObjectBuffer(objectKey: string) {
  return readFile(resolveObjectStoragePath(objectKey));
}

export function resolveObjectStoragePath(objectKey: string) {
  const normalizedKey = normalizeObjectKey(objectKey);
  return path.join(getObjectStorageRoot(), ...normalizedKey.split("/"));
}

function normalizeObjectKeyPrefix(prefix: string) {
  return prefix
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => sanitizePathSegment(segment))
    .filter(Boolean)
    .join("/");
}

function normalizeObjectKey(objectKey: string) {
  const normalized = objectKey.replace(/\\/g, "/").replace(/^\/+/, "");

  if (
    normalized.length === 0 ||
    normalized.startsWith("..") ||
    normalized.split("/").some((segment) => segment === ".." || segment.length === 0)
  ) {
    throw new Error(`invalid object key: ${objectKey}`);
  }

  return normalized;
}

function sanitizeFileName(fileName: string) {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);
  const safeBaseName = sanitizePathSegment(baseName);
  const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();
  return `${safeBaseName}${safeExtension}`;
}

function sanitizePathSegment(value: string) {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "file";
}
