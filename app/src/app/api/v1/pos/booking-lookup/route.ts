import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { withRequestContext } from "@/lib/logger";
import { requireSubRole } from "@/lib/session";

/**
 * GET /api/v1/pos/booking-lookup?q=WP-ABC123 | 9876543210
 * Find bookings by booking number or guest mobile for balance collection.
 */
export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { error } = await requireSubRole("TICKET_COUNTER", "SALES_EXECUTIVE");
  if (error) return error;
  const requestLogger = withRequestContext({
    requestId,
    method: req.method,
    path: req.nextUrl.pathname,
  });

  const searchParams = new URL(req.url).searchParams;
  const q = searchParams.get("q")?.trim();
  const purpose = searchParams.get("purpose") === "service" ? "service" : "balance";
  if (!q || q.length < 3) {
    requestLogger.warn({ queryLength: q?.length ?? 0 }, "POS booking lookup query too short");
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  requestLogger.info({ query: q.slice(0, 12) }, "POS booking lookup started");
  const todayIst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todayDate = new Date(`${todayIst}T00:00:00.000Z`);

  const bookings = await db.booking.findMany({
    where: {
      ...(purpose === "service"
        ? { status: "CHECKED_IN" as const, checkedInAt: { not: null } }
        : {
            status: { in: ["PENDING", "CONFIRMED"] as const },
            visitDate: { gte: todayDate },
            checkedInAt: null,
            transactions: { none: { posSessionId: { not: null } } },
          }),
      OR: [
        { id: q },
        { bookingNumber: { contains: q, mode: "insensitive" } },
        { guestMobile: { contains: q } },
        { guestName: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 10,
    orderBy: { visitDate: "asc" },
    include: {
      transactions: { where: { status: "PAID" }, select: { amount: true } },
      lockerAssignments: {
        where: { returnedAt: null },
        select: { id: true, notes: true },
      },
      costumeRentals: {
        where: { returnedAt: null },
        select: { id: true, notes: true },
      },
      foodOrders: {
        where: { status: { in: ["PENDING", "PREPARING", "READY"] } },
        include: { orderItems: { select: { quantity: true } } },
      },
      bookingTickets: {
        include: {
          ticketType: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const results = bookings.map((b) => {
    const paid = b.transactions.reduce((s, t) => s + Number(t.amount), 0);
    const balance = Math.round((Number(b.totalAmount) - paid) * 100) / 100;
    const lockerPending = b.lockerAssignments.filter((row) => row.notes?.includes("PREBOOKED:PENDING")).length;
    const lockerDelivered = b.lockerAssignments.filter((row) => row.notes?.includes("PREBOOKED:DELIVERED")).length;
    const costumePending = b.costumeRentals.filter((row) => row.notes?.includes("PREBOOKED:PENDING")).length;
    const costumeDelivered = b.costumeRentals.filter((row) => row.notes?.includes("PREBOOKED:DELIVERED")).length;
    const foodQty = b.foodOrders.reduce((sum, order) => {
      return sum + order.orderItems.reduce((lineSum, line) => lineSum + line.quantity, 0);
    }, 0);
    return {
      id: b.id,
      bookingNumber: b.bookingNumber,
      guestName: b.guestName,
      guestMobile: b.guestMobile,
      visitDate: b.visitDate.toISOString().slice(0, 10),
      status: b.status,
      totalAmount: Number(b.totalAmount),
      paid,
      balance,
      tickets: b.bookingTickets.map((bt) => ({
        ticketTypeId: bt.ticketType.id,
        name: bt.ticketType.name,
        quantity: bt.quantity,
        unitPrice: Number(bt.unitPrice),
        gstRate: Number(bt.gstRate),
      })),
      services: {
        locker: { pending: lockerPending, delivered: lockerDelivered },
        costume: { pending: costumePending, delivered: costumeDelivered },
        food: { pendingQty: foodQty },
      },
    };
  });

  requestLogger.info({ count: results.length }, "POS booking lookup completed");

  return NextResponse.json(results);
}
