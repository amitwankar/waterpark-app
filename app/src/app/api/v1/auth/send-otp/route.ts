import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requestOtp } from "@/lib/otp";
import {
  emailSchema,
  mobileSchema,
  nameSchema,
  passwordSchema,
  sanitizeMobile,
  sanitizeOptionalEmail,
  sanitizeText,
} from "@/types/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as
    | {
        purpose?: "guest_login" | "guest_register" | "reset_password";
        mobile?: string;
        name?: string;
        email?: string;
        password?: string;
      }
    | null;

  const purpose = body?.purpose;
  const mobile = sanitizeMobile(body?.mobile ?? "");

  if (!purpose || !["guest_login", "guest_register", "reset_password"].includes(purpose)) {
    return NextResponse.json({ message: "Invalid OTP purpose" }, { status: 400 });
  }

  const mobileValidation = mobileSchema.safeParse(mobile);
  if (!mobileValidation.success) {
    return NextResponse.json(
      { message: mobileValidation.error.issues[0]?.message ?? "Invalid mobile" },
      { status: 400 },
    );
  }

  if (purpose === "guest_register") {
    const name = sanitizeText(body?.name ?? "", 100);
    const email = sanitizeOptionalEmail(body?.email);
    const password = sanitizeText(body?.password ?? "", 128);

    const nameValidation = nameSchema.safeParse(name);
    if (!nameValidation.success) {
      return NextResponse.json(
        { message: nameValidation.error.issues[0]?.message ?? "Invalid name" },
        { status: 400 },
      );
    }

    if (email) {
      const emailValidation = emailSchema.safeParse(email);
      if (!emailValidation.success) {
        return NextResponse.json(
          { message: emailValidation.error.issues[0]?.message ?? "Invalid email" },
          { status: 400 },
        );
      }
    }

    const passwordValidation = passwordSchema.safeParse(password);
    if (!passwordValidation.success) {
      return NextResponse.json(
        { message: passwordValidation.error.issues[0]?.message ?? "Invalid password" },
        { status: 400 },
      );
    }

    const existing = await db.user.findUnique({
      where: { mobile },
      select: { id: true, role: true },
    });

    if (existing && existing.role !== "USER") {
      return NextResponse.json(
        { message: "Mobile already belongs to a staff account" },
        { status: 409 },
      );
    }

    const otpResult = await requestOtp({
      mobile,
      purpose,
      meta: {
        name,
        email,
        password,
      },
    });

    if (!otpResult.ok) {
      return NextResponse.json(
        {
          message: otpResult.message,
          remaining: otpResult.remaining,
          retryAfter: otpResult.retryAfter,
        },
        { status: 429 },
      );
    }

    return NextResponse.json({
      success: true,
      expiresIn: otpResult.expiresIn,
      remaining: otpResult.remaining,
    });
  }

  if (purpose === "reset_password") {
    const user = await db.user.findUnique({
      where: { mobile },
      select: { id: true, role: true },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "EMPLOYEE")) {
      return NextResponse.json(
        { message: "Account not eligible for password reset" },
        { status: 404 },
      );
    }
  }

  const otpResult = await requestOtp({ mobile, purpose });

  if (!otpResult.ok) {
    return NextResponse.json(
      {
        message: otpResult.message,
        remaining: otpResult.remaining,
        retryAfter: otpResult.retryAfter,
      },
      { status: 429 },
    );
  }

  return NextResponse.json({
    success: true,
    expiresIn: otpResult.expiresIn,
    remaining: otpResult.remaining,
  });
}