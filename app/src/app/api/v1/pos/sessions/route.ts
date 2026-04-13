import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireSubRole } from "@/lib/session";
import { logAudit, getIp } from "@/lib/audit";

const openSchema = z.object({
  terminalId: z.string().min(1).max(50),
  openingCash: z.number().nonnegative(),
});

/** GET: list recent sessions for current staff (last 10). */
export async function GET(req: NextRequest) {
  const { user, error } = await requireSubRole(
    "TICKET_COUNTER", "FB_STAFF", "LOCKER_ATTENDANT", "COSTUME_ATTENDANT", "PARKING_ATTENDANT", "SALES_EXECUTIVE"
  );
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const terminalId = searchParams.get("terminalId");

  const sessions = await db.posSession.findMany({
    where: {
      staffId: user!.id,
      ...(terminalId ? { terminalId } : {}),
    },
    orderBy: { openedAt: "desc" },
    take: 10,
    include: {
      _count: { select: { transactions: true } },
    },
  });

  return NextResponse.json(sessions);
}

/** POST: open a new POS session (cash drawer). */
export async function POST(req: NextRequest) {
  const { user, error } = await requireSubRole(
    "TICKET_COUNTER", "FB_STAFF", "LOCKER_ATTENDANT", "COSTUME_ATTENDANT", "PARKING_ATTENDANT", "SALES_EXECUTIVE"
  );
  if (error) return error;

  const body = await req.json();
  const parsed = openSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  // Check: no already-open session for this terminal
  const existing = await db.posSession.findFirst({
    where: { terminalId: parsed.data.terminalId, status: "OPEN" },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: "Terminal already has an open session",
        sessionId: existing.id,
        openedAt: existing.openedAt,
      },
      { status: 409 }
    );
  }

  const session = await db.posSession.create({
    data: {
      terminalId: parsed.data.terminalId,
      staffId: user!.id,
      openingCash: parsed.data.openingCash,
    },
    include: { staff: { select: { id: true, name: true } } },
  });

  await logAudit({
    userId: user!.id,
    userRole: user!.role,
    action: "pos.session.open",
    entity: "PosSession",
    entityId: session.id,
    newValue: { terminalId: session.terminalId, openingCash: Number(session.openingCash) },
    ipAddress: getIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json(session, { status: 201 });
}
