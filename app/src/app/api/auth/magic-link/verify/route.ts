import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token");
  const callbackURL = request.nextUrl.searchParams.get("callbackURL") ?? undefined;

  if (!token) {
    return NextResponse.json({ success: false, error: "TOKEN_REQUIRED" }, { status: 400 });
  }

  try {
    await auth.api.magicLinkVerify({
      query: {
        token,
        callbackURL,
      },
      headers: request.headers,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 400 });
  }
}
