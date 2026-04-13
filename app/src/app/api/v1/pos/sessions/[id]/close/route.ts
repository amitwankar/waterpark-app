import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireSubRole } from "@/lib/session";
import { computeExpectedCash } from "@/lib/pos";
import { logAudit, getIp } from "@/lib/audit";

const schema = z.object({
  closingCash: z.number().nonnegative(),
  notes: z.string().optional(),
});

async function closeSessionHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireSubRole(
    "TICKET_COUNTER", "FB_STAFF", "LOCKER_ATTENDANT", "COSTUME_ATTENDANT", "PARKING_ATTENDANT", "SALES_EXECUTIVE"
  );
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const session = await db.posSession.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "Session already closed" }, { status: 409 });
  }

  const expectedCash = await computeExpectedCash(id, Number(session.openingCash));
  const variance = parsed.data.closingCash - expectedCash;

  const updated = await db.posSession.update({
    where: { id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closingCash: parsed.data.closingCash,
      expectedCash,
      variance,
      notes: parsed.data.notes,
    },
    include: {
      staff: { select: { id: true, name: true } },
      _count: { select: { transactions: true } },
    },
  });

  await logAudit({
    userId: user!.id,
    userRole: user!.role,
    action: "pos.session.close",
    entity: "PosSession",
    entityId: id,
    oldValue: { openingCash: Number(session.openingCash), expectedCash },
    newValue: { closingCash: parsed.data.closingCash, variance },
    ipAddress: getIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json(updated);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return closeSessionHandler(req, ctx);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return closeSessionHandler(req, ctx);
}
