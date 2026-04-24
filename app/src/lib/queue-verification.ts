import { sanitizeMobile, sanitizeOptionalEmail } from "@/types/auth";

export const QUEUE_VERIFICATION_MODES = ["DISABLED", "EMAIL", "SMS", "BOTH"] as const;

export type QueueVerificationMode = (typeof QUEUE_VERIFICATION_MODES)[number];

export function normalizeQueueVerificationMode(value: unknown): QueueVerificationMode {
  if (typeof value !== "string") return "DISABLED";
  const upper = value.trim().toUpperCase();
  if (QUEUE_VERIFICATION_MODES.includes(upper as QueueVerificationMode)) {
    return upper as QueueVerificationMode;
  }
  return "DISABLED";
}

export function needsEmailVerification(mode: QueueVerificationMode): boolean {
  return mode === "EMAIL" || mode === "BOTH";
}

export function needsSmsVerification(mode: QueueVerificationMode): boolean {
  return mode === "SMS" || mode === "BOTH";
}

export function normalizeQueueEmail(value: unknown): string | null {
  const email = sanitizeOptionalEmail(typeof value === "string" ? value : undefined);
  return email ?? null;
}

export function normalizeQueueMobile(value: unknown): string | null {
  const mobile = sanitizeMobile(typeof value === "string" ? value : "");
  return mobile.length > 0 ? mobile : null;
}
