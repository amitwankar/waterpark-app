import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyCaptcha } from "@/lib/captcha";
import { sendWhatsAppOtp } from "@/lib/whatsapp-otp";

const mobileRegex = /^[6-9]\d{9}$/;

const schema = z
  .object({
    mobile: z.string().regex(mobileRegex),
    captchaToken: z.string().optional(),
  })
  .strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "VALIDATION_ERROR" }, { status: 400 });
  }

  const captchaOk = await verifyCaptcha(parsed.data.captchaToken);
  if (!captchaOk) {
    return NextResponse.json({ success: false, error: "CAPTCHA_FAILED" }, { status: 400 });
  }

  const result = await sendWhatsAppOtp(parsed.data.mobile);

  if (result.retryAfterSec) {
    return NextResponse.json(
      {
        success: false,
        error: "RATE_LIMITED",
        retryAfterSec: result.retryAfterSec,
      },
      { status: 429 },
    );
  }

  return NextResponse.json({ success: true, ttl: result.ttl });
}
