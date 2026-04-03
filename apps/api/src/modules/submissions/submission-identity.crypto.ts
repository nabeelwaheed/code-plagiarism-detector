import {
  constants,
  createHash,
  privateDecrypt,
} from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import { apiRuntimeConfig } from "../../config/runtime-config.js";

export interface SubmissionIdentityPayload {
  v: number;
  studentName: string;
  studentNumber: string;
  assignmentKey: string;
  studentEmail?: string;
}

export function getSubmissionIdentityPublicKey() {
  return {
    keyId: apiRuntimeConfig.submissionIdentity.keyId,
    algorithm: "RSA-OAEP-256",
    publicKeyPem: apiRuntimeConfig.submissionIdentity.publicKeyPem,
  };
}

export function decryptSubmissionIdentity(encryptedIdentity: string) {
  const parsed = parseEncryptedIdentity(encryptedIdentity);

  if (parsed.keyId !== apiRuntimeConfig.submissionIdentity.keyId) {
    throw new BadRequestException("This submission identity cannot be decrypted with the current server key");
  }

  try {
    const decrypted = privateDecrypt(
      {
        key: apiRuntimeConfig.submissionIdentity.privateKeyPem,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(parsed.ciphertextBase64Url, "base64url"),
    ).toString("utf8");

    return validateSubmissionIdentityPayload(JSON.parse(decrypted) as SubmissionIdentityPayload);
  } catch {
    throw new BadRequestException("This submission identity could not be decrypted");
  }
}

export function createSubmissionAliasFromEncryptedIdentity(encryptedIdentity: string) {
  const digest = createHash("sha256").update(encryptedIdentity).digest("hex").slice(0, 10).toUpperCase();
  return `SUB-${digest}`;
}

export function validateEncryptedIdentityString(value: string) {
  parseEncryptedIdentity(value);
  return value.trim();
}

function parseEncryptedIdentity(value: string) {
  const normalized = value.trim();
  const match = /^sidenc:v1:([a-zA-Z0-9._-]+):([a-zA-Z0-9_-]+)$/.exec(normalized);

  if (!match) {
    throw new BadRequestException("The encrypted submission identity is invalid");
  }

  const [, keyId, ciphertextBase64Url] = match;
  if (!keyId || !ciphertextBase64Url) {
    throw new BadRequestException("The encrypted submission identity is invalid");
  }

  return {
    keyId,
    ciphertextBase64Url,
  };
}

function validateSubmissionIdentityPayload(payload: SubmissionIdentityPayload) {
  const studentName = payload.studentName?.trim();
  const studentNumber = payload.studentNumber?.trim();
  const assignmentKey = payload.assignmentKey?.trim().toLowerCase();
  const studentEmail = payload.studentEmail?.trim().toLowerCase();

  if (payload.v !== 1 || !studentName || !studentNumber || !assignmentKey) {
    throw new BadRequestException("This submission identity payload is invalid");
  }

  return {
    v: 1,
    studentName,
    studentNumber,
    assignmentKey,
    studentEmail: studentEmail || undefined,
  } satisfies SubmissionIdentityPayload;
}
