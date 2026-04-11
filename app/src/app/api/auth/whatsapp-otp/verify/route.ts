import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { verifyWhatsAppOtp } from "@/lib/whatsapp-otp";

const mobileRegex = /^[6-9]\d{9}$/;

const schema = z
  .object({
    mobile: z.string().regex(mobileRegex),
    otp: z.string().regex(/^\d{6}$/),
    returnUrl: z.string().optional(),
  })
  .strict();

function otpLoginPassword(): string {
  const fallback = process.env.BETTER_AUTH_SECRET ?? "AquaWorld@Otp1!";
  return `${fallback}Aa1!`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "VALIDATION_ERROR" }, { status: 400 });
  }

  const verify = await verifyWhatsAppOtp(parsed.data.mobile, parsed.data.otp);
  if (!verify.valid) {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_OTP",
        retryAfterSec: verify.retryAfterSec,
      },
      { status: 400 },
    );
  }

  const email = `${parsed.data.mobile}@guest.aquaworld.local`;
  const password = otpLoginPassword();
  const passwordHash = await hashPassword(password);

  const existing = await db.user.findUnique({ where: { mobile: parsed.data.mobile } });

  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: {
          email: existing.email ?? email,
          mobileVerified: true,
          isActive: true,
        },
      })
    : await db.user.create({
        data: {
          name: `Guest ${parsed.data.mobile.slice(-4)}`,
          mobile: parsed.data.mobile,
          email,
          mobileVerified: true,
          emailVerified: true,
          role: "USER",
          isActive: true,
          passwordHash,
        },
      });

  const credentialAccount = await db.account.findFirst({
    where: {
      userId: user.id,
      providerId: "credential",
    },
    select: { id: true },
  });

  if (credentialAccount) {
    await db.account.update({
      where: { id: credentialAccount.id },
      data: { password: passwordHash },
    });
  } else {
    await db.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: passwordHash,
      },
    });
  }

  const signInResponse = await auth.api.signInEmail({
    body: {
      email: user.email ?? email,
      password,
      rememberMe: false,
      callbackURL: parsed.data.returnUrl,
    },
    headers: request.headers,
  });

  return NextResponse.json({ success: true, data: signInResponse, returnUrl: parsed.data.returnUrl });
}
