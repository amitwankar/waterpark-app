import { z } from "zod";

const providerSchema = z.enum(["none", "hcaptcha", "recaptcha"]);

export type CaptchaProvider = z.infer<typeof providerSchema>;

async function verifyHcaptcha(token: string): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET_KEY;
  if (!secret) return false;

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  const response = await fetch("https://hcaptcha.com/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) return false;
  const json = (await response.json()) as { success?: boolean };
  return Boolean(json.success);
}

async function verifyRecaptcha(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return false;

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) return false;
  const json = (await response.json()) as { success?: boolean; score?: number };
  return Boolean(json.success && (json.score ?? 0) >= 0.5);
}

export async function verifyCaptcha(token: string | undefined, provider?: string): Promise<boolean> {
  const parsedProvider = providerSchema.safeParse((provider ?? process.env.CAPTCHA_PROVIDER ?? "none").toLowerCase());
  const finalProvider: CaptchaProvider = parsedProvider.success ? parsedProvider.data : "none";

  if (finalProvider === "none") return true;
  if (!token || token.trim().length === 0) return false;

  if (finalProvider === "hcaptcha") {
    return verifyHcaptcha(token);
  }

  if (finalProvider === "recaptcha") {
    return verifyRecaptcha(token);
  }

  return false;
}
