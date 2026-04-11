import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyCaptcha } from "@/lib/captcha";
import { sendMagicLink } from "@/lib/magic-link";

const schema = z
  .object({
    email: z.string().email(),
    callbackURL: z.string().url().optional(),
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

  await sendMagicLink(parsed.data.email.toLowerCase(), parsed.data.callbackURL);

  return NextResponse.json({
    success: true,
    message: "If your email exists, a login link has been sent.",
  });
}
