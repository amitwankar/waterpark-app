import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPostLoginRoute } from "@/lib/post-login-route";
import { hashPassword, verifyPassword } from "@/lib/password";
import { REDIS_KEYS, REDIS_TTL, incrementWithWindow, redis } from "@/lib/redis";
import {
  mobileSchema,
  passwordSchema,
  sanitizeMobile,
  sanitizeText,
} from "@/types/auth";

const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const json = (await request.json().catch(() => null)) as
    | { mobile?: string; password?: string }
    | null;

  const mobile = sanitizeMobile(json?.mobile ?? "");
  const password = sanitizeText(json?.password ?? "", 128);

  const mobileValidation = mobileSchema.safeParse(mobile);
  if (!mobileValidation.success) {
    return NextResponse.json(
      { message: mobileValidation.error.issues[0]?.message ?? "Invalid mobile" },
      { status: 400 },
    );
  }

  const passwordValidation = passwordSchema.safeParse(password);
  if (!passwordValidation.success) {
    return NextResponse.json(
      { message: passwordValidation.error.issues[0]?.message ?? "Invalid password" },
      { status: 400 },
    );
  }

  const lockKey = REDIS_KEYS.loginLock(mobile);
  const lockedFor = await redis.ttl(lockKey);
  if (lockedFor > 0) {
    return NextResponse.json(
      {
        message: "Account locked due to failed login attempts",
        remainingAttempts: 0,
        lockedUntil: Date.now() + lockedFor * 1000,
      },
      { status: 423 },
    );
  }

  let response: Response;
  const loginCandidate = await db.user.findFirst({
    where: {
      mobile,
      role: { in: ["ADMIN", "EMPLOYEE"] },
      isActive: true,
      isDeleted: false,
    },
    select: {
      id: true,
      role: true,
      subRole: true,
      passwordHash: true,
    },
  });

  if (!loginCandidate) {
    return NextResponse.json(
      {
        message: "Invalid mobile or password",
        remainingAttempts: MAX_ATTEMPTS,
      },
      { status: 401 },
    );
  }

  try {
    response = await auth.api.signInUsername({
      body: {
        username: mobile,
        password,
      },
      headers: request.headers,
      asResponse: true,
    });
  } catch {
    response = new Response(null, { status: 401 });
  }

  if (!response.ok) {
    // Backward compatibility: older staff creation flow stored user.passwordHash
    // but missed account(provider=credential), causing auth failure.
    if (loginCandidate.passwordHash && (await verifyPassword(password, loginCandidate.passwordHash))) {
      const normalizedHash = await hashPassword(password);
      const credentialAccount = await db.account.findFirst({
        where: {
          userId: loginCandidate.id,
          providerId: "credential",
        },
        select: { id: true },
      });

      if (credentialAccount) {
        await db.account.update({
          where: { id: credentialAccount.id },
          data: { password: normalizedHash },
        });
      } else {
        await db.account.create({
          data: {
            userId: loginCandidate.id,
            providerId: "credential",
            accountId: loginCandidate.id,
            password: normalizedHash,
          },
        });
      }
      await db.user.update({
        where: { id: loginCandidate.id },
        data: { passwordHash: normalizedHash },
      });

      try {
        response = await auth.api.signInUsername({
          body: {
            username: mobile,
            password,
          },
          headers: request.headers,
          asResponse: true,
        });
      } catch {
        response = new Response(null, { status: 401 });
      }
    }
  }

  if (!response.ok) {
    const fail = await incrementWithWindow(
      REDIS_KEYS.loginFailCount(mobile),
      REDIS_TTL.loginLock,
    );

    const remainingAttempts = Math.max(0, MAX_ATTEMPTS - fail.count);

    if (fail.count >= MAX_ATTEMPTS) {
      await redis.set(lockKey, "1", "EX", REDIS_TTL.loginLock);
      await redis.del(REDIS_KEYS.loginFailCount(mobile));
      return NextResponse.json(
        {
          message: "Account locked due to failed login attempts",
          remainingAttempts: 0,
          lockedUntil: Date.now() + REDIS_TTL.loginLock * 1000,
        },
        { status: 423 },
      );
    }

    return NextResponse.json(
      {
        message: "Invalid mobile or password",
        remainingAttempts,
      },
      { status: 401 },
    );
  }

  await redis.del(REDIS_KEYS.loginFailCount(mobile));
  await redis.del(lockKey);

  const redirectTo = getPostLoginRoute(
    loginCandidate.role,
    loginCandidate.subRole,
  );

  const nextResponse = NextResponse.json({
    success: true,
    role: loginCandidate.role,
    subRole: loginCandidate.subRole,
    redirectTo,
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    nextResponse.headers.set("set-cookie", setCookie);
  }

  return nextResponse;
}
