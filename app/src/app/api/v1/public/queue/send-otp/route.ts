import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requestQueueOtp } from "@/lib/queue-otp";
import {
  needsEmailVerification,
  needsSmsVerification,
  normalizeQueueEmail,
  normalizeQueueMobile,
  normalizeQueueVerificationMode,
} from "@/lib/queue-verification";

const schema = z
  .object({
    channel: z.enum(["email", "sms"]),
    email: z.string().trim().optional(),
    mobile: z.string().trim().optional(),
  })
  .strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const config = await db.parkConfig.findFirst({
    select: { queueVerificationMode: true },
  });
  const mode = normalizeQueueVerificationMode(config?.queueVerificationMode);

  const channel = parsed.data.channel;
  if (channel === "email" && !needsEmailVerification(mode)) {
    return NextResponse.json({ message: "Email verification is disabled" }, { status: 400 });
  }
  if (channel === "sms" && !needsSmsVerification(mode)) {
    return NextResponse.json({ message: "SMS verification is disabled" }, { status: 400 });
  }

  if (channel === "email") {
    const email = normalizeQueueEmail(parsed.data.email);
    if (!email) {
      return NextResponse.json({ message: "Enter a valid email" }, { status: 400 });
    }
    const sent = await requestQueueOtp({ channel: "email", value: email });
    if (!sent.ok) {
      return NextResponse.json(
        { message: sent.message, remaining: sent.remaining, retryAfter: sent.retryAfter },
        { status: 429 },
      );
    }
    return NextResponse.json({
      success: true,
      channel: "email",
      expiresIn: sent.expiresIn,
      remaining: sent.remaining,
    });
  }

  const mobile = normalizeQueueMobile(parsed.data.mobile);
  if (!mobile) {
    return NextResponse.json({ message: "Enter a valid mobile number" }, { status: 400 });
  }
  const sent = await requestQueueOtp({ channel: "sms", value: mobile });
  if (!sent.ok) {
    return NextResponse.json(
      { message: sent.message, remaining: sent.remaining, retryAfter: sent.retryAfter },
      { status: 429 },
    );
  }
  return NextResponse.json({
    success: true,
    channel: "sms",
    expiresIn: sent.expiresIn,
    remaining: sent.remaining,
  });
}
