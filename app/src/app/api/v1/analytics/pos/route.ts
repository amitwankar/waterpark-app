import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { normalizePaymentMethod } from "@/lib/payment-methods";
import { buildDateRange, groupByDate } from "@/lib/reports";
import { requireAdmin } from "@/lib/session";

interface StaffRow {
  staffId: string;
  staffName: string;
  collected: number;
  txCount: number;
  cash: number;
  card: number;
  upi: number;
  gateway: number;
  complimentary: number;
}

interface TerminalRow {
  terminalId: string;
  collected: number;
  txCount: number;
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { dateFrom, dateTo } = buildDateRange(
    searchParams.get("dateFrom"),
    searchParams.get("dateTo"),
  );

  const transactions = await db.transaction.findMany({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
      posSessionId: { not: null },
      status: "PAID",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      amount: true,
      method: true,
      createdAt: true,
      posSession: {
        select: {
          id: true,
          terminalId: true,
          staff: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const sessions = await db.posSession.findMany({
    where: { openedAt: { gte: dateFrom, lte: dateTo } },
    select: {
      id: true,
      terminalId: true,
      status: true,
      openedAt: true,
      closedAt: true,
      staff: { select: { id: true, name: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  const byMethod = transactions.reduce<Record<string, number>>((acc, tx) => {
    const method = normalizePaymentMethod(tx.method) ?? tx.method;
    acc[method] = Number(acc[method] ?? 0) + Number(tx.amount);
    return acc;
  }, {});

  const staffMap = new Map<string, StaffRow>();
  const terminalMap = new Map<string, TerminalRow>();

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    const method = normalizePaymentMethod(tx.method);
    const staffId = tx.posSession?.staff.id ?? "unknown";
    const staffName = tx.posSession?.staff.name ?? "Unknown";
    const terminalId = tx.posSession?.terminalId ?? "Unknown";

    const existingStaff = staffMap.get(staffId) ?? {
      staffId,
      staffName,
      collected: 0,
      txCount: 0,
      cash: 0,
      card: 0,
      upi: 0,
      gateway: 0,
      complimentary: 0,
    };
    existingStaff.collected += amount;
    existingStaff.txCount += 1;
    if (method === "CASH") existingStaff.cash += amount;
    if (method === "CARD") existingStaff.card += amount;
    if (method === "MANUAL_UPI") existingStaff.upi += amount;
    if (method === "GATEWAY") existingStaff.gateway += amount;
    if (method === "COMPLIMENTARY") existingStaff.complimentary += amount;
    staffMap.set(staffId, existingStaff);

    const existingTerminal = terminalMap.get(terminalId) ?? {
      terminalId,
      collected: 0,
      txCount: 0,
    };
    existingTerminal.collected += amount;
    existingTerminal.txCount += 1;
    terminalMap.set(terminalId, existingTerminal);
  }

  const daily = groupByDate(transactions, "createdAt").map(({ date, items }) => ({
    date,
    total: items.reduce((sum, row) => sum + Number(row.amount), 0),
    cash: items.filter((row) => normalizePaymentMethod(row.method) === "CASH").reduce((sum, row) => sum + Number(row.amount), 0),
    card: items.filter((row) => normalizePaymentMethod(row.method) === "CARD").reduce((sum, row) => sum + Number(row.amount), 0),
    upi: items.filter((row) => normalizePaymentMethod(row.method) === "MANUAL_UPI").reduce((sum, row) => sum + Number(row.amount), 0),
  }));

  const staffBreakdown = Array.from(staffMap.values()).sort((a, b) => b.collected - a.collected);
  const terminalBreakdown = Array.from(terminalMap.values()).sort((a, b) => b.collected - a.collected);

  return NextResponse.json({
    kpi: {
      totalPosCollection: transactions.reduce((sum, tx) => sum + Number(tx.amount), 0),
      posTransactionCount: transactions.length,
      sessionsOpened: sessions.length,
      sessionsClosed: sessions.filter((s) => s.status === "CLOSED").length,
      activeSessions: sessions.filter((s) => s.status === "OPEN").length,
      distinctStaff: new Set(staffBreakdown.map((s) => s.staffId)).size,
      CASH: Number(byMethod.CASH ?? 0),
      CARD: Number(byMethod.CARD ?? 0),
      MANUAL_UPI: Number(byMethod.MANUAL_UPI ?? 0),
      GATEWAY: Number(byMethod.GATEWAY ?? 0),
      COMPLIMENTARY: Number(byMethod.COMPLIMENTARY ?? 0),
    },
    daily,
    staffBreakdown,
    terminalBreakdown,
    recentSessions: sessions.slice(0, 20).map((s) => ({
      id: s.id,
      terminalId: s.terminalId,
      status: s.status,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      staffName: s.staff.name,
    })),
  });
}

