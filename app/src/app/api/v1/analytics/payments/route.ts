import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { normalizePaymentMethod } from "@/lib/payment-methods";
import { buildDateRange, groupByDate } from "@/lib/reports";
import { requireAdmin } from "@/lib/session";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") ?? "").toLowerCase();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const { dateFrom, dateTo } =
    period === "today"
      ? { dateFrom: todayStart, dateTo: todayEnd }
      : buildDateRange(searchParams.get("dateFrom"), searchParams.get("dateTo"));

  const transactions = await db.transaction.findMany({
    where: { createdAt: { gte: dateFrom, lte: dateTo } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      amount: true,
      method: true,
      status: true,
      notes: true,
      posSessionId: true,
      booking: {
        select: {
          bookingNumber: true,
          guestName: true,
        },
      },
    },
  });

  const paid = transactions.filter((t) => t.status === "PAID");
  const pending = transactions.filter((t) => t.status === "PENDING");
  const refunded = transactions.filter((t) => t.status === "REFUNDED");

  const sum = (arr: Array<{ amount: unknown }>) =>
    arr.reduce((s, t) => s + Number(t.amount), 0);

  const byMethod = paid.reduce<Record<string, number>>((acc, tx) => {
    const method = normalizePaymentMethod(tx.method) ?? tx.method;
    acc[method] = Number(acc[method] ?? 0) + Number(tx.amount);
    return acc;
  }, {});

  const bookingPaid = paid.filter((t) => !t.posSessionId);
  const posPaid = paid.filter((t) => Boolean(t.posSessionId));
  const bookingAdvancePaid = bookingPaid.filter((t) =>
    String(t.notes ?? "").toLowerCase().includes("advance payment initiated"),
  );

  const daily = groupByDate(paid, "createdAt").map(({ date, items }) => ({
    date,
    total: items.reduce((s, t) => s + Number(t.amount), 0),
    gateway: items.filter((t) => normalizePaymentMethod(t.method) === "GATEWAY").reduce((s, t) => s + Number(t.amount), 0),
    upi: items.filter((t) => normalizePaymentMethod(t.method) === "MANUAL_UPI").reduce((s, t) => s + Number(t.amount), 0),
    cash: items.filter((t) => normalizePaymentMethod(t.method) === "CASH").reduce((s, t) => s + Number(t.amount), 0),
    card: items.filter((t) => normalizePaymentMethod(t.method) === "CARD").reduce((s, t) => s + Number(t.amount), 0),
  }));

  const recentTransactions = paid.slice(0, 30).map((tx) => ({
    id: tx.id,
    bookingNumber: tx.booking?.bookingNumber ?? null,
    guestName: tx.booking?.guestName ?? null,
    amount: Number(tx.amount),
    method: tx.method,
    status: tx.status,
    createdAt: tx.createdAt.toISOString(),
    source: tx.posSessionId ? "POS" : "BOOKING",
    isAdvance: !tx.posSessionId && String(tx.notes ?? "").toLowerCase().includes("advance payment initiated"),
  }));

  const pendingManualUpi = pending.filter((t) => normalizePaymentMethod(t.method) === "MANUAL_UPI");

  return NextResponse.json({
    today: {
      totalCollected: sum(paid),
      gateway: Number(byMethod.GATEWAY ?? 0),
      manualUpi: Number(byMethod.MANUAL_UPI ?? 0),
      cash: Number(byMethod.CASH ?? 0),
      card: Number(byMethod.CARD ?? 0),
      wristband: Number(byMethod.WRISTBAND ?? 0),
      complimentary: Number(byMethod.COMPLIMENTARY ?? 0),
      bookingCollection: sum(bookingPaid),
      posCollection: sum(posPaid),
      bookingAdvance: sum(bookingAdvancePaid),
      transactionCount: paid.length,
    },
    upiQueue: {
      pending: pendingManualUpi.length,
      pendingAmount: sum(pendingManualUpi),
    },
    recentTransactions,
    // Keep compatibility for reports
    kpi: {
      total: sum(paid),
      GATEWAY: Number(byMethod.GATEWAY ?? 0),
      MANUAL_UPI: Number(byMethod.MANUAL_UPI ?? 0),
      CASH: Number(byMethod.CASH ?? 0),
      CARD: Number(byMethod.CARD ?? 0),
      WRISTBAND: Number(byMethod.WRISTBAND ?? 0),
      COMPLIMENTARY: Number(byMethod.COMPLIMENTARY ?? 0),
      pendingVerify: pending.length,
      refunded: sum(refunded),
    },
    daily,
    transactionCount: paid.length,
  });
}

