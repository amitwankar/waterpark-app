import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireSubRole } from "@/lib/session";

/** GET /api/v1/pos/sessions/[id]/report — session reconciliation / EOD report. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSubRole(
    "TICKET_COUNTER", "FB_STAFF", "LOCKER_ATTENDANT"
  );
  if (error) return error;

  const { id } = await params;

  const session = await db.posSession.findUnique({
    where: { id },
    include: {
      staff: { select: { name: true } },
      transactions: {
        where: { status: "PAID" },
        select: { method: true, amount: true, createdAt: true },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Aggregate by method
  const methodTotals: Record<string, number> = {};
  for (const tx of session.transactions) {
    const key = tx.method;
    methodTotals[key] = (methodTotals[key] ?? 0) + Number(tx.amount);
  }

  const totalCollected = session.transactions.reduce(
    (s, t) => s + Number(t.amount),
    0
  );

  return NextResponse.json({
    session: {
      id: session.id,
      terminalId: session.terminalId,
      staffName: session.staff.name,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      status: session.status,
      openingCash: Number(session.openingCash),
      closingCash: session.closingCash ? Number(session.closingCash) : null,
      expectedCash: session.expectedCash ? Number(session.expectedCash) : null,
      variance: session.variance ? Number(session.variance) : null,
    },
    summary: {
      transactionCount: session.transactions.length,
      totalCollected: Math.round(totalCollected * 100) / 100,
      byMethod: Object.entries(methodTotals).map(([method, amount]) => ({
        method,
        amount: Math.round(amount * 100) / 100,
      })),
    },
  });
}
