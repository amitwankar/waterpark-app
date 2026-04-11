import { createHash, timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

const schema = z
  .object({
    token: z.string().min(10),
    email: z.string().email(),
    password: passwordSchema,
    confirmPassword: z.string().min(8),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function safeEqual(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "VALIDATION_ERROR" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");

  const inviteRows = await db.verification.findMany({
    where: {
      identifier: `invite:${email}`,
      expiresAt: { gte: new Date() },
    },
  });

  const matched = inviteRows.find((row) => safeEqual(row.value, tokenHash));
  if (!matched) {
    return NextResponse.json({ success: false, error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ success: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const existingAccount = await db.account.findFirst({
    where: {
      userId: user.id,
      providerId: "credential",
    },
    select: { id: true },
  });

  if (existingAccount) {
    await db.account.update({
      where: { id: existingAccount.id },
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

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerified: true,
      },
    }),
    db.verification.deleteMany({ where: { identifier: `invite:${email}` } }),
  ]);

  return NextResponse.json({ success: true });
}
