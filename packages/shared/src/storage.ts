import crypto from "node:crypto";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

const DEFAULT_OBJECT_STORAGE_ROOT = path.resolve(process.cwd(), "var", "object-storage");
const STAGED_UPLOAD_PREFIX = "_staging/uploads";

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

export function createStagedObjectKey(fileName: string) {
  return createObjectKey(STAGED_UPLOAD_PREFIX, fileName);
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

export async function writeObjectStream(objectKey: string, contents: Readable) {
  const targetPath = resolveObjectStoragePath(objectKey);
  await mkdir(path.dirname(targetPath), { recursive: true });

  try {
    await pipeline(contents, createWriteStream(targetPath));
  } catch (error) {
    await rm(targetPath, { force: true });
    await removeEmptyParentDirectories(targetPath);
    throw error;
  }

  return objectKey;
}

export async function readObjectBuffer(objectKey: string) {
  return readFile(resolveObjectStoragePath(objectKey));
}

export async function deleteObject(objectKey: string) {
  const targetPath = resolveObjectStoragePath(objectKey);
  await rm(targetPath, { force: true });
  await removeEmptyParentDirectories(targetPath);
}

export async function promoteStagedObject(stagedObjectKey: string, finalObjectKey: string) {
  const normalizedStagedKey = normalizeObjectKey(stagedObjectKey);
  if (!normalizedStagedKey.startsWith(`${STAGED_UPLOAD_PREFIX}/`)) {
    throw new Error(`cannot promote non-staged object key: ${stagedObjectKey}`);
  }

  const sourcePath = resolveObjectStoragePath(normalizedStagedKey);
  const targetPath = resolveObjectStoragePath(finalObjectKey);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await rename(sourcePath, targetPath);
  await removeEmptyParentDirectories(sourcePath);
  return finalObjectKey;
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

async function removeEmptyParentDirectories(targetPath: string) {
  const rootPath = getObjectStorageRoot();
  let currentPath = path.dirname(targetPath);

  while (isDescendantPath(rootPath, currentPath)) {
    try {
      await rmdir(currentPath);
    } catch {
      break;
    }

    currentPath = path.dirname(currentPath);
  }
}

function isDescendantPath(rootPath: string, candidatePath: string) {
  if (candidatePath === rootPath) {
    return false;
  }

  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath.length > 0 && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}
