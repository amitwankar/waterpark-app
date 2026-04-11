import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(16).optional(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional().default(""),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  REDIS_URL: z.string().min(1),
  REDIS_BULL_URL: z.string().optional(),

  ENCRYPTION_KEY: z.string().min(32).max(32).optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),

  PARK_UPI_ID: z.string().optional(),

  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_SENDER_ID: z.string().optional(),
  MSG91_WHATSAPP_NUMBER: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().optional(),
  SMTP_FROM_NAME: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== "development") {
    if (!value.BETTER_AUTH_SECRET || value.BETTER_AUTH_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BETTER_AUTH_SECRET"],
        message: "BETTER_AUTH_SECRET must be at least 32 characters outside development",
      });
    }

    const obvious = ["changeme", "secret", "password", "admin", "123456", "test", "dev"];
    const normalized = (value.BETTER_AUTH_SECRET ?? "").toLowerCase();
    if (obvious.some((token) => normalized.includes(token))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BETTER_AUTH_SECRET"],
        message: "BETTER_AUTH_SECRET appears weak; use a random high-entropy value",
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment variables: ${message}`);
}

const trustedOrigins = parsed.data.BETTER_AUTH_TRUSTED_ORIGINS
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  ...parsed.data,
  BETTER_AUTH_TRUSTED_ORIGINS: trustedOrigins,
};

export type Env = typeof env;
