import crypto from "node:crypto";

import { sendOtpEmail } from "@/lib/mailer";
import { REDIS_TTL, incrementWithWindow, redis } from "@/lib/redis";
import { sendOtpViaMsg91 } from "@/lib/otp";

type QueueOtpChannel = "email" | "sms";

type QueueOtpPayload = {
  otpHash: string;
  channel: QueueOtpChannel;
  value: string;
};

const QUEUE_OTP_TTL_SECONDS = REDIS_TTL.otp;
const QUEUE_VERIFY_PROOF_TTL_SECONDS = 15 * 60;
const QUEUE_OTP_REQUEST_WINDOW_SECONDS = REDIS_TTL.otpRateLimit;
const QUEUE_OTP_MAX_REQUESTS_PER_WINDOW = 3;

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function createOtp(): string {
  return String(crypto.randomInt(100_000, 999_999));
}

function queueOtpKey(channel: QueueOtpChannel, value: string): string {
  return `queue:otp:${channel}:${value}`;
}

function queueOtpRateKey(channel: QueueOtpChannel, value: string): string {
  return `queue:otp:rate:${channel}:${value}`;
}

function queueOtpProofKey(token: string): string {
  return `queue:otp:proof:${token}`;
}

export async function requestQueueOtp(input: { channel: QueueOtpChannel; value: string }): Promise<
  | { ok: true; expiresIn: number; remaining: number }
  | { ok: false; message: string; retryAfter: number; remaining: number }
> {
  const { count, ttl } = await incrementWithWindow(
    queueOtpRateKey(input.channel, input.value),
    QUEUE_OTP_REQUEST_WINDOW_SECONDS,
  );

  if (count > QUEUE_OTP_MAX_REQUESTS_PER_WINDOW) {
    return {
      ok: false,
      message: "Too many OTP requests. Try again later.",
      retryAfter: ttl,
      remaining: 0,
    };
  }

  const otp = createOtp();
  const payload: QueueOtpPayload = {
    otpHash: hashOtp(otp),
    channel: input.channel,
    value: input.value,
  };

  await redis.set(queueOtpKey(input.channel, input.value), JSON.stringify(payload), "EX", QUEUE_OTP_TTL_SECONDS);

  if (input.channel === "email") {
    await sendOtpEmail({
      email: input.value,
      otp,
    });
  } else {
    await sendOtpViaMsg91(input.value, otp);
  }

  return {
    ok: true,
    expiresIn: QUEUE_OTP_TTL_SECONDS,
    remaining: Math.max(0, QUEUE_OTP_MAX_REQUESTS_PER_WINDOW - count),
  };
}

export async function verifyQueueOtp(input: {
  channel: QueueOtpChannel;
  value: string;
  otp: string;
}): Promise<{ ok: true; proofToken: string } | { ok: false; message: string }> {
  const key = queueOtpKey(input.channel, input.value);
  const stored = await redis.get(key);
  if (!stored) {
    return { ok: false, message: "OTP expired or not found" };
  }

  let payload: QueueOtpPayload;
  try {
    payload = JSON.parse(stored) as QueueOtpPayload;
  } catch {
    await redis.del(key);
    return { ok: false, message: "Invalid OTP payload" };
  }

  if (payload.channel !== input.channel || payload.value !== input.value) {
    return { ok: false, message: "OTP payload mismatch" };
  }

  if (hashOtp(input.otp) !== payload.otpHash) {
    return { ok: false, message: "Incorrect OTP" };
  }

  await redis.del(key);

  const proofToken = crypto.randomUUID();
  await redis.set(
    queueOtpProofKey(proofToken),
    JSON.stringify({ channel: input.channel, value: input.value }),
    "EX",
    QUEUE_VERIFY_PROOF_TTL_SECONDS,
  );

  return { ok: true, proofToken };
}

export async function consumeQueueOtpProof(input: {
  channel: QueueOtpChannel;
  value: string;
  proofToken: string;
}): Promise<boolean> {
  const key = queueOtpProofKey(input.proofToken);
  const stored = await redis.get(key);
  if (!stored) return false;

  try {
    const parsed = JSON.parse(stored) as { channel?: QueueOtpChannel; value?: string };
    if (parsed.channel !== input.channel || parsed.value !== input.value) {
      return false;
    }
    await redis.del(key);
    return true;
  } catch {
    await redis.del(key);
    return false;
  }
}
