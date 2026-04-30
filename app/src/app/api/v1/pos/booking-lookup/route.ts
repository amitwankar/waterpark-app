import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { splitBookingNotes } from "@/lib/booking-meta";
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
  const todayOnly = searchParams.get("today") === "1";
  const countOnly = searchParams.get("countOnly") === "1";
  const take = Math.max(1, Math.min(100, Number(searchParams.get("take") ?? 10)));
  const purpose = searchParams.get("purpose") === "service" ? "service" : "balance";
  if (!todayOnly && (!q || q.length < 3)) {
    requestLogger.warn({ queryLength: q?.length ?? 0 }, "POS booking lookup query too short");
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  requestLogger.info({ query: q?.slice(0, 12) ?? null, todayOnly, countOnly }, "POS booking lookup started");
  const todayIst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todayDate = new Date(`${todayIst}T00:00:00.000Z`);

  const baseWhere: Prisma.BookingWhereInput =
    purpose === "service"
      ? {
          status: "CHECKED_IN",
          checkedInAt: { not: null },
        }
      : {
          status: { in: ["PENDING", "CONFIRMED"] },
          visitDate: { gte: todayDate },
          checkedInAt: null,
          transactions: { none: { posSessionId: { not: null } } },
        };

  if (q) {
    baseWhere.OR = [
      { id: q },
      { bookingNumber: { contains: q, mode: "insensitive" } },
      { guestMobile: { contains: q } },
      { guestName: { contains: q, mode: "insensitive" } },
    ];
  }

  if (countOnly) {
    const count = await db.booking.count({ where: baseWhere });
    return NextResponse.json({ count });
  }

  const bookings = await db.booking.findMany({
    where: baseWhere,
    take,
    orderBy: [{ visitDate: "asc" }, { createdAt: "desc" }],
    include: {
      transactions: { where: { status: "PAID" }, select: { amount: true } },
      lockerAssignments: {
        where: { returnedAt: null },
        select: { id: true, notes: true },
      },
      lockerEntitlements: {
        select: {
          lockerCategoryId: true,
          quantity: true,
          deliveredQuantity: true,
          category: { select: { id: true, name: true, code: true } },
        },
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
    const parsedNotes = splitBookingNotes(b.notes);
    const paid = b.transactions.reduce((s, t) => s + Number(t.amount), 0);
    const balance = Math.round((Number(b.totalAmount) - paid) * 100) / 100;
    const entitlementPending = b.lockerEntitlements.reduce((sum, row) => {
      return sum + Math.max(0, row.quantity - row.deliveredQuantity);
    }, 0);
    const entitlementDelivered = b.lockerEntitlements.reduce((sum, row) => sum + row.deliveredQuantity, 0);
    const legacyLockerPending = b.lockerAssignments.filter((row) => row.notes?.includes("PREBOOKED:PENDING")).length;
    const legacyLockerDelivered = b.lockerAssignments.filter((row) => row.notes?.includes("PREBOOKED:DELIVERED")).length;
    const lockerPending = entitlementPending + legacyLockerPending;
    const lockerDelivered = entitlementDelivered + legacyLockerDelivered;
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
      guestEmail: b.guestEmail ?? "",
      visitDate: b.visitDate.toISOString().slice(0, 10),
      status: b.status,
      discountAmount: Number(b.discountAmount),
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
        locker: {
          pending: lockerPending,
          delivered: lockerDelivered,
          byCategory: b.lockerEntitlements.map((row) => ({
            lockerCategoryId: row.lockerCategoryId,
            name: row.category.name,
            code: row.category.code,
            quantity: row.quantity,
            delivered: row.deliveredQuantity,
            pending: Math.max(0, row.quantity - row.deliveredQuantity),
          })),
        },
        costume: { pending: costumePending, delivered: costumeDelivered },
        food: { pendingQty: foodQty },
      },
      posPreload: parsedNotes.meta?.posPreload ?? null,
    };
  });

  requestLogger.info({ count: results.length }, "POS booking lookup completed");

  return NextResponse.json(results);
}
