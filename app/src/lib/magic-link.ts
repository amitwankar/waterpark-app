import { randomBytes } from "crypto";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const EXPIRY_MINUTES = Number(process.env.MAGIC_LINK_EXPIRY_MINUTES ?? "15");

export function generatePublicMagicToken(): string {
  return randomBytes(32).toString("hex");
}

export async function sendMagicLink(email: string, callbackURL?: string): Promise<void> {
  await auth.api.signInMagicLink({
    body: {
      email,
      callbackURL,
    },
    headers: new Headers(),
  });
}

export async function ensureGuestByEmail(email: string, name?: string): Promise<void> {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return;

  await db.user.create({
    data: {
      email,
      name: name ?? email.split("@")[0] ?? "Guest",
      mobile: `9${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, "0")}`,
      role: "USER",
      emailVerified: true,
      isActive: true,
    },
  });
}

export async function verifyMagicLinkToken(token: string, callbackURL?: string): Promise<void> {
  await auth.api.magicLinkVerify({
    query: {
      token,
      callbackURL,
    },
    headers: new Headers(),
  });
}
