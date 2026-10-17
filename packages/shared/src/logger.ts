import pino, { type Logger } from "pino";
import { redactObject, redactSecrets } from "./redact";

/**
 * Structured JSON logger. Known secret paths are removed by pino; anything
 * else that looks like a token or webhook URL is scrubbed by the formatter.
 */
export function createLogger(service: string, level = process.env.LOG_LEVEL ?? "info"): Logger {
  return pino({
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "token",
        "*.token",
        "accessToken",
        "refreshToken",
        "*.accessToken",
        "*.refreshToken",
        "headers.authorization",
        "*.headers.authorization",
        "req.headers.cookie",
      ],
      censor: "[REDACTED]",
    },
    formatters: {
      log: (obj) => redactObject(obj),
    },
    hooks: {
      logMethod(args, method) {
        const scrubbed = args.map((a) => (typeof a === "string" ? redactSecrets(a) : a));
        return method.apply(this, scrubbed as Parameters<typeof method>);
      },
    },
    serializers: {
      err: (err: unknown) => {
        const s = pino.stdSerializers.err(err as Error);
        return { ...s, message: redactSecrets(s.message ?? ""), stack: s.stack ? redactSecrets(s.stack) : undefined };
      },
    },
  });
}

export type { Logger };
