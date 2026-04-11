import { createHash, randomBytes } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendInviteEmail } from "@/lib/mailer";

const schema = z
  .object({
    email: z.string().email(),
    name: z.string().min(2).max(100),
    mobile: z.string().regex(/^[6-9]\d{9}$/),
    role: z.enum(["ADMIN", "EMPLOYEE", "USER"]).default("EMPLOYEE"),
    subRole: z.string().optional(),
  })
  .strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "VALIDATION_ERROR" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ success: false, error: "EMAIL_ALREADY_EXISTS" }, { status: 409 });
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await db.verification.create({
    data: {
      identifier: `invite:${parsed.data.email.toLowerCase()}`,
      value: tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await db.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      mobile: parsed.data.mobile,
      role: parsed.data.role,
      subRole: parsed.data.subRole as never,
      isActive: true,
      emailVerified: false,
    },
  });

  const setPasswordUrl = `${process.env.NEXT_PUBLIC_APP_URL}/set-password?token=${token}&email=${encodeURIComponent(parsed.data.email.toLowerCase())}`;
  await sendInviteEmail({
    email: parsed.data.email.toLowerCase(),
    name: parsed.data.name,
    setPasswordUrl,
  });

  return NextResponse.json({ success: true });
}
