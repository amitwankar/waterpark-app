import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { requireSubRole } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { validateSplitPayment, type SplitPaymentLine } from "@/lib/pos";
import { logAudit, getIp } from "@/lib/audit";
import { withRequestContext } from "@/lib/logger";

const paymentLineSchema = z.object({
  method: z.enum(["CASH", "MANUAL_UPI", "CARD", "COMPLIMENTARY"]),
  amount: z.number().positive(),
});

const schema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  sessionId: z.string().min(1),
  bookingId: z.string().min(1),
  paymentLines: z.array(paymentLineSchema).min(1),
  notes: z.string().optional(),
});

/**
 * POST /api/v1/pos/collect-balance
 * Collect the remaining balance for a pre-booked guest at the gate.
 * Validates the outstanding amount and records payment transactions.
 */
export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { user, error } = await requireSubRole("TICKET_COUNTER", "SALES_EXECUTIVE");
  if (error) return error;
  const requestLogger = withRequestContext({
    requestId,
    userId: user?.id,
    method: req.method,
    path: req.nextUrl.pathname,
  });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    requestLogger.warn({ issues: parsed.error.issues.length }, "POS collect-balance validation failed");
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const { idempotencyKey, sessionId, bookingId, paymentLines, notes } = parsed.data;
  requestLogger.info(
    {
      bookingId,
      sessionId,
      lines: paymentLines.length,
      total: paymentLines.reduce((sum, line) => sum + Number(line.amount), 0),
    },
    "POS collect-balance started",
  );

  const idempotencyRedisKey = idempotencyKey
    ? `pos:idempotency:collect-balance:${sessionId}:${bookingId}:${idempotencyKey}`
    : null;
  if (idempotencyRedisKey) {
    const existing = await redis.get(idempotencyRedisKey);
    if (existing?.startsWith("DONE:")) {
      const payload = JSON.parse(existing.slice(5)) as { bookingId: string; balanceCollected: number };
      return NextResponse.json(payload, { status: 200 });
    }
    if (existing === "IN_PROGRESS") {
      return NextResponse.json({ error: "Duplicate request in progress" }, { status: 409 });
    }
    await redis.set(idempotencyRedisKey, "IN_PROGRESS", "EX", 120);
  }

  const session = await db.posSession.findFirst({
    where: { id: sessionId, status: "OPEN" },
  });
  if (!session) {
    return NextResponse.json({ error: "No active POS session" }, { status: 400 });
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      transactions: { where: { status: "PAID" } },
    },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status === "CANCELLED") {
    return NextResponse.json({ error: "Booking is cancelled" }, { status: 400 });
  }

  const totalPaid = booking.transactions.reduce((s, t) => s + Number(t.amount), 0);
  const balance = Math.round((Number(booking.totalAmount) - totalPaid) * 100) / 100;

  if (balance <= 0) {
    return NextResponse.json({ error: "Booking is fully paid" }, { status: 400 });
  }

  const splitCheck = validateSplitPayment(paymentLines as SplitPaymentLine[], balance);
  if (!splitCheck.valid) {
    return NextResponse.json({ error: splitCheck.reason }, { status: 400 });
  }

  const settings = await getSettings();
  const allowedMethods = new Set<SplitPaymentLine["method"]>(["CASH", "CARD", "COMPLIMENTARY"]);
  if (settings.manualUpiEnabled) allowedMethods.add("MANUAL_UPI");
  const hasDisabledMethod = paymentLines.some((line) => !allowedMethods.has(line.method));
  if (hasDisabledMethod) {
    return NextResponse.json({ error: "Selected payment method is disabled in park settings" }, { status: 400 });
  }

  await db.$transaction([
    db.transaction.createMany({
      data: (paymentLines as SplitPaymentLine[]).map((pl) => ({
        bookingId,
        posSessionId: sessionId,
        amount: pl.amount,
        method: pl.method,
        status: "PAID" as const,
        verifiedById: user!.id,
        verifiedAt: new Date(),
        notes,
      })),
    }),
    // Mark booking confirmed if still pending
    ...(booking.status === "PENDING"
      ? [db.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED" } })]
      : []),
  ]);

  await logAudit({
    userId: user!.id,
    userRole: user!.role,
    action: "pos.collect_balance",
    entity: "Booking",
    entityId: bookingId,
    newValue: { balance, sessionId },
    ipAddress: getIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  const responsePayload = { bookingId, balanceCollected: balance };
  requestLogger.info({ bookingId, balanceCollected: balance }, "POS collect-balance completed");
  if (idempotencyRedisKey) {
    await redis.set(idempotencyRedisKey, `DONE:${JSON.stringify(responsePayload)}`, "EX", 3600);
  }
  return NextResponse.json(responsePayload);
}
