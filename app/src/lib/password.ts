import bcrypt from "bcryptjs";
import { hashPassword as betterHashPassword, verifyPassword as betterVerifyPassword } from "better-auth/crypto";

export async function hashPassword(plain: string): Promise<string> {
  return betterHashPassword(plain);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  try {
    const ok = await betterVerifyPassword({ password: plain, hash });
    if (ok) return true;
  } catch {
    // fall through to bcrypt compatibility check
  }

  // Backward compatibility for legacy bcrypt-hashed rows.
  return bcrypt.compare(plain, hash);
}
