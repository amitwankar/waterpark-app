import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireSubRole } from "@/lib/session";

const schema = z.object({
  bookingId: z.string().min(1),
  quantity: z.number().int().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const { error } = await requireSubRole("LOCKER_ATTENDANT", "TICKET_COUNTER", "SALES_EXECUTIVE");
  if (error) return error;

  try {
    const body = schema.parse(await req.json());
    const booking = await db.booking.findUnique({ where: { id: body.bookingId }, select: { status: true } });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.status !== "CHECKED_IN") {
      return NextResponse.json({ error: "Booking must be checked in before delivery" }, { status: 409 });
    }
    const pending = await db.lockerAssignment.findMany({
      where: {
        bookingId: body.bookingId,
        returnedAt: null,
        notes: { contains: "PREBOOKED:PENDING" },
      },
      orderBy: { assignedAt: "asc" },
      take: body.quantity,
      select: { id: true, notes: true },
    });

    if (pending.length === 0) {
      return NextResponse.json({ error: "No pending booked lockers found for this booking." }, { status: 409 });
    }

    for (const row of pending) {
      const nextNotes = (row.notes ?? "PREBOOKED:PENDING").replace("PREBOOKED:PENDING", "PREBOOKED:DELIVERED");
      await db.lockerAssignment.update({
        where: { id: row.id },
        data: { notes: nextNotes },
      });
    }

    return NextResponse.json({ ok: true, delivered: pending.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: error.issues }, { status: 422 });
    }
    return NextResponse.json({ error: "Failed to deliver booked lockers" }, { status: 500 });
  }
}
