import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, magicLink, username } from "better-auth/plugins";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { MOBILE_REGEX } from "@/types/auth";

const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const magicLinkExpiryMinutes = Number(process.env.MAGIC_LINK_EXPIRY_MINUTES ?? "15");

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  advanced: {
    cookiePrefix: "aw",
    useSecureCookies: env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 72,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      scope: ["openid", "email", "profile"],
    },
  },
  user: {
    additionalFields: {
      mobile: {
        type: "string",
        required: false,
        fieldName: "mobile",
      },
      mobileVerified: {
        type: "boolean",
        required: false,
        defaultValue: false,
        fieldName: "mobileVerified",
      },
      role: {
        type: "string",
        required: true,
        defaultValue: "USER",
        fieldName: "role",
      },
      subRole: {
        type: "string",
        required: false,
        fieldName: "subRole",
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        fieldName: "isActive",
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24,
    updateAge: 60 * 60,
  },
  plugins: [
    username({
      minUsernameLength: 10,
      maxUsernameLength: 10,
      usernameNormalization: false,
      displayUsernameNormalization: false,
      usernameValidator: (value) => MOBILE_REGEX.test(value),
      schema: {
        user: {
          fields: {
            username: "mobile",
            displayUsername: "name",
          },
        },
      },
    }),
    admin({
      adminRoles: ["ADMIN"],
      defaultRole: "USER",
    }),
    magicLink({
      expiresIn: magicLinkExpiryMinutes * 60,
      sendMagicLink: async ({ email, url }) => {
        const { sendMagicLinkEmail } = await import("@/lib/mailer");
        await sendMagicLinkEmail({ email, url });
      },
    }),
    nextCookies(),
  ],
});

export type AppAuth = typeof auth;
export type AppSession = typeof auth.$Infer.Session;
