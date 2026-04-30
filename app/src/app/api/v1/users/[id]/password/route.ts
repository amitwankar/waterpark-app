import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { requireAdmin } from "@/lib/session";

const passwordSchema = z.string().trim().min(8, "Password must be at least 8 characters");

const schema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().trim().min(8, "Confirm password must be at least 8 characters"),
}).refine((v) => v.password === v.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(", ");
    return NextResponse.json(
      { error: message || "Validation failed" },
      { status: 422 },
    );
  }

  const { id } = await params;

  const user = await db.user.findFirst({
    where: {
      id,
      role: { in: ["ADMIN", "EMPLOYEE"] },
      isDeleted: false,
    },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const existingAccount = await db.account.findFirst({
    where: {
      userId: user.id,
      providerId: "credential",
    },
    select: { id: true },
  });

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    existingAccount
      ? db.account.update({
          where: { id: existingAccount.id },
          data: { password: passwordHash },
        })
      : db.account.create({
          data: {
            userId: user.id,
            providerId: "credential",
            accountId: user.id,
            password: passwordHash,
          },
        }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ success: true });
}
