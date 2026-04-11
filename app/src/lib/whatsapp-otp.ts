import { createHash, timingSafeEqual } from "crypto";

import { redis } from "@/lib/redis";

const OTP_TTL_SECONDS = 5 * 60;
const SEND_WINDOW_SECONDS = 10 * 60;
const MAX_SENDS = 3;
const MAX_FAILURES = 5;
const FAILURE_WINDOW_SECONDS = 15 * 60;

function otpKey(mobile: string): string {
  return `whatsapp:otp:${mobile}`;
}

function attemptsKey(mobile: string): string {
  return `whatsapp:otp:attempts:${mobile}`;
}

function sendsKey(mobile: string): string {
  return `whatsapp:otp:sends:${mobile}`;
}

function lockKey(mobile: string): string {
  return `whatsapp:otp:lock:${mobile}`;
}

function hashOtp(otp: string): string {
  return createHash("sha256")
    .update(`${otp}:${process.env.BETTER_AUTH_SECRET ?? "aw-dev-secret"}`)
    .digest("hex");
}

function constantTimeHexEqual(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function generateOtp(): string {
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}

async function sendViaMsg91WhatsApp(mobile: string, otp: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log("[whatsapp-otp]", { mobile, otp });
    return;
  }

  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_WHATSAPP_OTP_TEMPLATE_ID;

  if (!authKey || !templateId) {
    throw new Error("MSG91 WhatsApp OTP credentials are not configured");
  }

  await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: authKey,
    },
    body: JSON.stringify({
      integrated_number: process.env.MSG91_WHATSAPP_NUMBER,
      content_type: "template",
      payload: [
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: `91${mobile}`,
          type: "template",
          template: {
            name: templateId,
            language: {
              code: "en",
              policy: "deterministic",
            },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: otp }],
              },
            ],
          },
        },
      ],
    }),
  });
}

export async function sendWhatsAppOtp(mobile: string): Promise<{ ttl: number; retryAfterSec?: number }> {
  const isLocked = await redis.ttl(lockKey(mobile));
  if (isLocked > 0) {
    return { ttl: OTP_TTL_SECONDS, retryAfterSec: isLocked };
  }

  const sendCount = await redis.incr(sendsKey(mobile));
  if (sendCount === 1) {
    await redis.expire(sendsKey(mobile), SEND_WINDOW_SECONDS);
  }

  if (sendCount > MAX_SENDS) {
    const ttl = await redis.ttl(sendsKey(mobile));
    return { ttl: OTP_TTL_SECONDS, retryAfterSec: Math.max(ttl, 1) };
  }

  const otp = generateOtp();
  const hashedOtp = hashOtp(otp);

  await redis.set(otpKey(mobile), hashedOtp, "EX", OTP_TTL_SECONDS);
  await sendViaMsg91WhatsApp(mobile, otp);

  return { ttl: OTP_TTL_SECONDS };
}

export async function verifyWhatsAppOtp(mobile: string, otp: string): Promise<{ valid: boolean; retryAfterSec?: number }> {
  const lockedTtl = await redis.ttl(lockKey(mobile));
  if (lockedTtl > 0) {
    return { valid: false, retryAfterSec: lockedTtl };
  }

  const stored = await redis.get(otpKey(mobile));
  if (!stored) {
    return { valid: false };
  }

  const incomingHash = hashOtp(otp);
  const isValid = constantTimeHexEqual(stored, incomingHash);

  if (!isValid) {
    const failures = await redis.incr(attemptsKey(mobile));
    if (failures === 1) {
      await redis.expire(attemptsKey(mobile), FAILURE_WINDOW_SECONDS);
    }

    if (failures >= MAX_FAILURES) {
      await redis.set(lockKey(mobile), "1", "EX", FAILURE_WINDOW_SECONDS);
      const ttl = await redis.ttl(lockKey(mobile));
      return { valid: false, retryAfterSec: ttl };
    }

    return { valid: false };
  }

  await redis.del(otpKey(mobile), attemptsKey(mobile), lockKey(mobile));
  return { valid: true };
}
