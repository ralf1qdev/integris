import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * AES-256-GCM envelope for credentials stored at rest (OAuth tokens).
 * Format: v1.<iv>.<tag>.<ciphertext> (base64url). Associated data binds a
 * ciphertext to its owner so it cannot be swapped between rows.
 */
const VERSION = "v1";

function key(keyB64: string): Buffer {
  const k = Buffer.from(keyB64, "base64");
  if (k.length !== 32) throw new Error("ENCRYPTION_KEY must decode to 32 bytes");
  return k;
}

export function encryptSecret(plaintext: string, keyB64: string, associatedData: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(keyB64), iv);
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, keyB64: string, associatedData: string): string {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== VERSION || !iv || !tag || ct === undefined) throw new Error("Unsupported ciphertext format");
  const decipher = createDecipheriv("aes-256-gcm", key(keyB64), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(associatedData, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
