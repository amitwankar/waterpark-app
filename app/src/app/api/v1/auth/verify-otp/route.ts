import crypto from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { verifyOtp } from "@/lib/otp";
import {
  AuthRole,
  mobileSchema,
  otpSchema,
  passwordSchema,
  sanitizeMobile,
  sanitizeOptionalEmail,
  sanitizeText,
} from "@/types/auth";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SESSION_COOKIE = "wp.session_token";

async function createSessionForUser(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.session.create({
    data: {
      id: crypto.randomUUID(),
      token,
      userId,
      expiresAt,
      ipAddress: null,
      userAgent: null,
    },
  });

  return { token, expiresAt };
}

async function ensureCredentialPassword(userId: string, plainPassword: string): Promise<void> {
  const passwordHash = await hashPassword(plainPassword);

  const account = await db.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true },
  });

  if (account) {
    await db.account.update({
      where: { id: account.id },
      data: { password: passwordHash },
    });
  } else {
    await db.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
      },
    });
  }

  await db.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

async function resolveOrCreateGuest(args: {
  mobile: string;
  registerName?: string;
  registerEmail?: string;
  registerPassword?: string;
}): Promise<{ id: string; role: AuthRole }> {
  const existing = await db.user.findUnique({
    where: { mobile: args.mobile },
    select: { id: true, role: true },
  });

  if (existing) {
    if (existing.role !== "USER") {
      throw new Error("Only guest accounts are allowed in OTP guest flow");
    }

    if (args.registerPassword) {
      await ensureCredentialPassword(existing.id, args.registerPassword);
    }

    return { id: existing.id, role: existing.role as AuthRole };
  }

  const name = args.registerName ? sanitizeText(args.registerName, 100) : `Guest ${args.mobile.slice(-4)}`;
  const email =
    sanitizeOptionalEmail(args.registerEmail) ?? `${args.mobile}.${crypto.randomInt(10_000, 99_999)}@guest.local`;

  const created = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      name,
      email,
      emailVerified: false,
      mobile: args.mobile,
      mobileVerified: true,
      role: "USER",
      isActive: true,
      isDeleted: false,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (args.registerPassword) {
    await ensureCredentialPassword(created.id, args.registerPassword);
  }

  return { id: created.id, role: created.role as AuthRole };
}

function withSessionCookie(response: NextResponse, token: string, expiresAt: Date): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as
    | {
        purpose?: "guest_login" | "guest_register" | "reset_password";
        mobile?: string;
        otp?: string;
        newPassword?: string;
      }
    | null;

  const purpose = body?.purpose;
  const mobile = sanitizeMobile(body?.mobile ?? "");
  const otp = sanitizeText(body?.otp ?? "", 6);

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

  const otpValidation = otpSchema.safeParse(otp);
  if (!otpValidation.success) {
    return NextResponse.json(
      { message: otpValidation.error.issues[0]?.message ?? "Invalid OTP" },
      { status: 400 },
    );
  }

  const otpResult = await verifyOtp({ mobile, otp, purpose });
  if (!otpResult.ok) {
    return NextResponse.json({ message: otpResult.message }, { status: 401 });
  }

  if (purpose === "reset_password") {
    const newPassword = sanitizeText(body?.newPassword ?? "", 128);
    const passwordValidation = passwordSchema.safeParse(newPassword);
    if (!passwordValidation.success) {
      return NextResponse.json(
        { message: passwordValidation.error.issues[0]?.message ?? "Invalid password" },
        { status: 400 },
      );
    }

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

    await ensureCredentialPassword(user.id, newPassword);
    await db.session.deleteMany({ where: { userId: user.id } });

    return NextResponse.json({ success: true, message: "Password reset successful" });
  }

  const guest = await resolveOrCreateGuest({
    mobile,
    registerName: otpResult.meta?.name,
    registerEmail: otpResult.meta?.email,
    registerPassword: otpResult.meta?.password,
  });

  const session = await createSessionForUser(guest.id);

  return withSessionCookie(
    NextResponse.json({
      success: true,
      redirectTo: "/guest/my-account",
    }),
    session.token,
    session.expiresAt,
  );
}