import crypto from "node:crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not configured");
  }
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 characters");
  }
  return Buffer.from(key, "utf8");
}

export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]).toString("base64");
  return `${iv.toString("base64")}:${encrypted}`;
}

export function decrypt(payload: string): string {
  const [ivBase64, cipherBase64] = payload.split(":");
  if (!ivBase64 || !cipherBase64) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = Buffer.from(ivBase64, "base64");
  const encrypted = Buffer.from(cipherBase64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString("utf8");
}

export function maskIdProof(encryptedValue: string): string {
  const plain = decrypt(encryptedValue);
  const visible = plain.slice(-4);
  const maskedLength = Math.max(plain.length - 4, 0);
  return `${"•".repeat(maskedLength)}${visible}`;
}

export function maskUpiRef(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const plain = decrypt(value).replace(/\s+/g, "");
    const visible = plain.slice(-4);
    const maskedLength = Math.max(plain.length - 4, 0);
    return `${"•".repeat(maskedLength)}${visible}`;
  } catch {
    const normalized = value.replace(/\s+/g, "");
    const visible = normalized.slice(-4);
    const maskedLength = Math.max(normalized.length - 4, 0);
    return `${"•".repeat(maskedLength)}${visible}`;
  }
}

// Backward-compatible aliases for existing imports.
export const encryptText = encrypt;
export const decryptText = decrypt;
