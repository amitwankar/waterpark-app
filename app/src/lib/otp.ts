import crypto from "node:crypto";

import { REDIS_KEYS, REDIS_TTL, incrementWithWindow, redis } from "@/lib/redis";
import {
  mobileSchema,
  otpPurposeSchema,
  otpSchema,
  sanitizeMobile,
} from "@/types/auth";

type OtpPayload = {
  otpHash: string;
  purpose: "guest_login" | "guest_register" | "reset_password";
  meta?: {
    name?: string;
    email?: string;
    password?: string;
  };
  createdAt: number;
};

type RequestOtpInput = {
  mobile: string;
  purpose: "guest_login" | "guest_register" | "reset_password";
  meta?: OtpPayload["meta"];
};

export type RequestOtpResult =
  | { ok: true; expiresIn: number; remaining: number }
  | { ok: false; message: string; remaining: number; retryAfter: number };

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateOtp(): string {
  return String(crypto.randomInt(100_000, 999_999));
}

export async function sendOtpViaMsg91(mobile: string, otp: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[MSG91:DEV] OTP for ${mobile}: ${otp}`);
    return;
  }

  console.log(`[MSG91:STUB] OTP dispatch requested for ${mobile}`);
}

export async function requestOtp(input: RequestOtpInput): Promise<RequestOtpResult> {
  const mobile = sanitizeMobile(input.mobile);
  const mobileValidation = mobileSchema.safeParse(mobile);
  if (!mobileValidation.success) {
    return {
      ok: false,
      message: mobileValidation.error.issues[0]?.message ?? "Invalid mobile",
      remaining: 0,
      retryAfter: REDIS_TTL.otpRateLimit,
    };
  }

  const purposeValidation = otpPurposeSchema.safeParse(input.purpose);
  if (!purposeValidation.success) {
    return {
      ok: false,
      message: "Invalid OTP purpose",
      remaining: 0,
      retryAfter: REDIS_TTL.otpRateLimit,
    };
  }

  const { count, ttl } = await incrementWithWindow(
    REDIS_KEYS.otpRequestLimit(mobile),
    REDIS_TTL.otpRateLimit,
  );

  if (count > 3) {
    return {
      ok: false,
      message: "Too many OTP requests. Try again later.",
      remaining: 0,
      retryAfter: ttl,
    };
  }

  const otp = generateOtp();
  const payload: OtpPayload = {
    otpHash: hashOtp(otp),
    purpose: input.purpose,
    meta: input.meta,
    createdAt: Date.now(),
  };

  await redis.set(
    REDIS_KEYS.otp(mobile),
    JSON.stringify(payload),
    "EX",
    REDIS_TTL.otp,
  );

  await sendOtpViaMsg91(mobile, otp);

  return {
    ok: true,
    expiresIn: REDIS_TTL.otp,
    remaining: Math.max(0, 3 - count),
  };
}

export async function verifyOtp(input: {
  mobile: string;
  otp: string;
  purpose: "guest_login" | "guest_register" | "reset_password";
}): Promise<{ ok: true; meta?: OtpPayload["meta"] } | { ok: false; message: string }> {
  const mobile = sanitizeMobile(input.mobile);

  const mobileValidation = mobileSchema.safeParse(mobile);
  if (!mobileValidation.success) {
    return { ok: false, message: mobileValidation.error.issues[0]?.message ?? "Invalid mobile" };
  }

  const otpValidation = otpSchema.safeParse(input.otp);
  if (!otpValidation.success) {
    return { ok: false, message: otpValidation.error.issues[0]?.message ?? "Invalid OTP" };
  }

  const purposeValidation = otpPurposeSchema.safeParse(input.purpose);
  if (!purposeValidation.success) {
    return { ok: false, message: "Invalid OTP purpose" };
  }

  const stored = await redis.get(REDIS_KEYS.otp(mobile));
  if (!stored) {
    return { ok: false, message: "OTP expired or not found" };
  }

  let payload: OtpPayload;
  try {
    payload = JSON.parse(stored) as OtpPayload;
  } catch {
    await redis.del(REDIS_KEYS.otp(mobile));
    return { ok: false, message: "Invalid OTP payload" };
  }

  if (payload.purpose !== input.purpose) {
    return { ok: false, message: "OTP purpose mismatch" };
  }

  if (hashOtp(input.otp) !== payload.otpHash) {
    return { ok: false, message: "Incorrect OTP" };
  }

  await redis.del(REDIS_KEYS.otp(mobile));

  return { ok: true, meta: payload.meta };
}