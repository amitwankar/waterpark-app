import { createHash, randomBytes, timingSafeEqual } from "crypto";

import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { hashPassword } from "@/lib/password";

const RESET_EXPIRY_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function createPasswordReset(email: string): Promise<void> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return;

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  await db.verification.create({
    data: {
      identifier: `password-reset:${user.id}`,
      value: tokenHash,
      expiresAt: new Date(Date.now() + RESET_EXPIRY_MS),
    },
  });

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
  await sendPasswordResetEmail({
    email,
    resetUrl,
  });
}

export async function consumePasswordResetToken(token: string, nextPassword: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const records = await db.verification.findMany({
    where: {
      identifier: {
        startsWith: "password-reset:",
      },
      expiresAt: {
        gte: now,
      },
    },
  });

  const matching = records.find((row) => safeEqualHex(row.value, tokenHash));
  if (!matching) return false;

  const userId = matching.identifier.replace("password-reset:", "");
  const passwordHash = await hashPassword(nextPassword);

  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash } }),
    db.account.updateMany({
      where: {
        userId,
        providerId: "credential",
      },
      data: {
        password: passwordHash,
      },
    }),
    db.session.deleteMany({ where: { userId } }),
    db.verification.deleteMany({ where: { identifier: `password-reset:${userId}` } }),
  ]);

  return true;
}
