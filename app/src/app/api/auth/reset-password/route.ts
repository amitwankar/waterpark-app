import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { consumePasswordResetToken } from "@/lib/password-reset";

const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, "Must include uppercase")
  .regex(/[a-z]/, "Must include lowercase")
  .regex(/[0-9]/, "Must include digit")
  .regex(/[^A-Za-z0-9]/, "Must include special character");

const schema = z
  .object({
    token: z.string().min(10),
    password: passwordSchema,
    confirmPassword: z.string().min(8),
  })
  .strict()
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
  }

  const consumed = await consumePasswordResetToken(parsed.data.token, parsed.data.password);
  if (!consumed) {
    return NextResponse.json({ success: false, error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
