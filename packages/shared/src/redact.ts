/**
 * Secret redaction for logs, alerts and API responses. Integris must never echo
 * webhook tokens, bot tokens or OAuth credentials, even by accident.
 */

const WEBHOOK_URL =
  /(https?:\/\/(?:[a-z0-9-]+\.)?(?:discord|discordapp)\.com\/api(?:\/v\d+)?\/webhooks\/\d+\/)[A-Za-z0-9._-]+/gi;
const BOT_TOKEN = /\b[A-Za-z\d_-]{23,28}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,40}\b/g;
const AUTH_HEADER = /\b(Bearer|Bot)\s+[A-Za-z0-9._~+/=-]{16,}/g;

export const REDACTED = "[REDACTED]";

const SENSITIVE_KEY = /token|secret|password|authorization|cookie|credential|^url$|webhook_?url/i;

export function redactSecrets(input: string): string {
  return input
    .replace(WEBHOOK_URL, `$1${REDACTED}`)
    .replace(AUTH_HEADER, `$1 ${REDACTED}`)
    .replace(BOT_TOKEN, REDACTED);
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

/** Deep-copies a value, redacting sensitive keys and secret-shaped strings. */
export function redactObject<T>(value: T, depth = 0, seen = new WeakSet<object>()): T {
  if (depth > 12) return "[Truncated]" as T;
  if (typeof value === "string") return redactSecrets(value) as T;
  if (typeof value === "bigint") return value.toString() as T;
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return "[Circular]" as T;
  seen.add(value as object);
  if (Array.isArray(value)) {
    return value.map((v) => redactObject(v, depth + 1, seen)) as T;
  }
  if (value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitiveKey(k) && v !== null && v !== undefined && typeof v !== "boolean"
      ? REDACTED
      : redactObject(v, depth + 1, seen);
  }
  return out as T;
}
