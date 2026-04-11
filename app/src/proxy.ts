import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function withSecurityHeaders(response: NextResponse, requestId: string): NextResponse {
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-frame-options", "SAMEORIGIN");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/about" ||
    pathname === "/rides" ||
    pathname === "/booking" ||
    pathname.startsWith("/booking/confirmation/") ||
    pathname === "/packages" ||
    pathname === "/offers" ||
    pathname === "/gallery" ||
    pathname === "/contact" ||
    pathname === "/inquiry" ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/auth/login" ||
    pathname === "/auth/register" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/login/whatsapp" ||
    pathname === "/login/magic-link" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/set-password" ||
    pathname === "/auth/magic" ||
    pathname === "/auth/callback/google" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/v1/public/") ||
    pathname.startsWith("/api/v1/auth/") ||
    pathname === "/api/v1/coupons/validate" ||
    pathname === "/api/v1/rides" ||
    pathname === "/api/v1/tickets" ||
    pathname === "/api/v1/zones" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  if (pathname === "/auth/login") {
    return withSecurityHeaders(NextResponse.redirect(new URL("/login", request.url)), requestId);
  }

  if (pathname === "/auth/register") {
    return withSecurityHeaders(NextResponse.redirect(new URL("/register", request.url)), requestId);
  }

  if (isPublicPath(pathname)) {
    return withSecurityHeaders(
      NextResponse.next({
        request: { headers: requestHeaders },
      }),
      requestId,
    );
  }

  // Edge runtime safe fallback:
  // do not call Prisma-backed auth checks in proxy.
  // Route-level/API-level auth checks remain active server-side.
  return withSecurityHeaders(
    NextResponse.next({
      request: { headers: requestHeaders },
    }),
    requestId,
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
