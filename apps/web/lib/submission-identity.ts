const textEncoder = new TextEncoder();

export interface SubmissionIdentityPublicKeyResponse {
  keyId: string;
  algorithm: "RSA-OAEP-256";
  publicKeyPem: string;
}

export async function encryptSubmissionIdentity(
  input: {
    studentName: string;
    studentNumber: string;
    studentEmail?: string;
    assignmentKey: string;
  },
  key: SubmissionIdentityPublicKeyResponse,
) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser does not support secure submission encryption.");
  }

  const studentEmail = normalizeStudentEmail(input.studentEmail);
  const payload = {
    v: 1,
    studentName: normalizeStudentName(input.studentName),
    studentNumber: normalizeStudentNumber(input.studentNumber),
    assignmentKey: normalizeAssignmentKey(input.assignmentKey),
    ...(studentEmail ? { studentEmail } : {}),
  };

  const publicKey = await globalThis.crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(key.publicKeyPem),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["encrypt"],
  );

  const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    textEncoder.encode(JSON.stringify(payload)),
  );

  return `sidenc:v1:${key.keyId}:${toBase64Url(new Uint8Array(encryptedBuffer))}`;
}

export function normalizeAssignmentKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizeStudentName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeStudentNumber(value: string) {
  return value.trim().replace(/\s+/g, "");
}

function normalizeStudentEmail(value?: string) {
  return value?.trim().toLowerCase() || "";
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
