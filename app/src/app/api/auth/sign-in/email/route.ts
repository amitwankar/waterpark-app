import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  rememberMe: z.boolean().optional(),
  callbackURL: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid email or password" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;
  const rememberMe = Boolean(parsed.data.rememberMe);
  const callbackURL = parsed.data.callbackURL;

  const loginCandidate = await db.user.findFirst({
    where: {
      email,
      role: { in: ["ADMIN", "EMPLOYEE"] },
      isActive: true,
      isDeleted: false,
    },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!loginCandidate) {
    const inactive = await db.user.findFirst({
      where: {
        email,
        role: { in: ["ADMIN", "EMPLOYEE"] },
        isDeleted: false,
        isActive: false,
      },
      select: { id: true },
    });
    if (inactive) {
      return NextResponse.json({ message: "Your account is disabled. Contact administrator." }, { status: 403 });
    }
    return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
  }

  let response: Response;
  try {
    response = await auth.api.signInEmail({
      body: { email, password, rememberMe, callbackURL },
      headers: request.headers,
      asResponse: true,
    });
  } catch {
    response = new Response(null, { status: 401 });
  }

  if (!response.ok && loginCandidate.passwordHash && (await verifyPassword(password, loginCandidate.passwordHash))) {
    const normalizedHash = await hashPassword(password);
    const credentialAccount = await db.account.findFirst({
      where: { userId: loginCandidate.id, providerId: "credential" },
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
      response = await auth.api.signInEmail({
        body: { email, password, rememberMe, callbackURL },
        headers: request.headers,
        asResponse: true,
      });
    } catch {
      response = new Response(null, { status: 401 });
    }
  }

  if (!response.ok) {
    return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
  }

  const nextResponse = NextResponse.json({ success: true });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    nextResponse.headers.set("set-cookie", setCookie);
  }

  return nextResponse;
}
