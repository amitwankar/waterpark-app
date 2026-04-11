import pino, { type Logger, type LoggerOptions } from "pino";

import { env } from "@/lib/env";

export interface LogContext {
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  durationMs?: number;
  [key: string]: unknown;
}

const redactedKeys = [
  "password",
  "passwordHash",
  "otp",
  "razorpayKeySecret",
  "razorpayKeyId",
  "upiRef",
  "rawUpiRef",
  "smtpPass",
  "msg91AuthKey",
];

const options: LoggerOptions = {
  level: env.NODE_ENV === "production" ? "info" : "debug",
  base: undefined,
  redact: {
    paths: redactedKeys,
    remove: true,
  },
  transport:
    env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
};

const root = pino(options);

export const logger: Logger = root;

export function withRequestContext(context: LogContext): Logger {
  return logger.child({
    requestId: context.requestId,
    userId: context.userId,
    method: context.method,
    path: context.path,
    durationMs: context.durationMs,
  });
}

export function logSlowQuery(context: LogContext): void {
  if (typeof context.durationMs === "number" && context.durationMs > 500) {
    logger.warn({
      requestId: context.requestId,
      userId: context.userId,
      method: context.method,
      path: context.path,
      durationMs: context.durationMs,
    }, "Slow query detected");
  }
}
