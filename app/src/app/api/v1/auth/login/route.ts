import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
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

  const payload = (await response.json().catch(() => null)) as
    | { user?: { role?: string } }
    | null;

  const role = payload?.user?.role;
  const redirectTo = role === "ADMIN" ? "/admin/dashboard" : "/staff/pos";

  const nextResponse = NextResponse.json({ success: true, redirectTo });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    nextResponse.headers.set("set-cookie", setCookie);
  }

  return nextResponse;
}