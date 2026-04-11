/**
 * Server-only session helpers.
 * Import ONLY in route handlers, server actions, and server components.
 */
import "server-only";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { EmployeeSubRole, UserRole } from "@/types/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  name: string;
  email?: string | null;
  mobile: string;
  role: UserRole;
  subRole?: EmployeeSubRole | null;
  isActive: boolean;
}

// ─── Core ─────────────────────────────────────────────────────────────────────

export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}

export function extractUser(
  session: Awaited<ReturnType<typeof getServerSession>>
): SessionUser | null {
  if (!session?.user) return null;
  return session.user as unknown as SessionUser;
}

// ─── Guards (return NextResponse on failure, null on success) ─────────────────

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/** Ensures session exists and user is active. */
export async function requireAuth(): Promise<
  { user: SessionUser; error: null } | { user: null; error: NextResponse }
> {
  const session = await getServerSession();
  const user = extractUser(session);
  if (!user) return { user: null, error: unauthorized() };
  if (!user.isActive) return { user: null, error: forbidden() };
  return { user, error: null };
}

/** Requires ADMIN role. */
export async function requireAdmin(): Promise<
  { user: SessionUser; error: null } | { user: null; error: NextResponse }
> {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };
  if (user!.role !== "ADMIN") return { user: null, error: forbidden() };
  return { user: user!, error: null };
}

/** Requires ADMIN or EMPLOYEE role. */
export async function requireStaff(): Promise<
  { user: SessionUser; error: null } | { user: null; error: NextResponse }
> {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };
  if (!["ADMIN", "EMPLOYEE"].includes(user!.role))
    return { user: null, error: forbidden() };
  return { user: user!, error: null };
}

/** Requires ADMIN or a specific sub-role. */
export async function requireSubRole(
  ...allowed: EmployeeSubRole[]
): Promise<
  { user: SessionUser; error: null } | { user: null; error: NextResponse }
> {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };
  const u = user!;
  if (
    u.role !== "ADMIN" &&
    (!u.subRole || !allowed.includes(u.subRole as EmployeeSubRole))
  )
    return { user: null, error: forbidden() };
  return { user: u, error: null };
}
