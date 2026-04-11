import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addHours } from "date-fns";

import { db } from "@/lib/db";
import { requireSubRole } from "@/lib/session";

const FULL_DAY_HOURS = 8;

const assignSchema = z.object({
  bookingId: z.string().optional(),
  guestName: z.string().min(1).max(150),
  guestMobile: z.string().regex(/^[6-9]\d{9}$/),
  durationType: z.enum(["HOURLY", "FULL_DAY"]),
  durationHours: z.number().int().min(1).max(12).optional(), // only for HOURLY
  amount: z.number().nonnegative().optional(),
  paymentMethod: z.string().default("CASH"),
  notes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireSubRole("LOCKER_ATTENDANT");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const locker = await db.locker.findUnique({ where: { id } });
  if (!locker) {
    return NextResponse.json({ error: "Locker not found" }, { status: 404 });
  }
  if (locker.status !== "AVAILABLE") {
    return NextResponse.json(
      { error: `Locker is currently ${locker.status}` },
      { status: 409 }
    );
  }

  const { durationType, durationHours, paymentMethod, notes, bookingId, guestName, guestMobile } =
    parsed.data;
  if (bookingId) {
    const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.status !== "CHECKED_IN") {
      return NextResponse.json({ error: "Booking must be checked in before assigning locker" }, { status: 409 });
    }
  }

  const now = new Date();
  const hours =
    durationType === "FULL_DAY" ? FULL_DAY_HOURS : (durationHours ?? 1);
  const dueAt = addHours(now, hours);
  const baseRate = Number(locker.rate);
  const gstRate = Number((locker as unknown as Record<string, unknown>).gstRate ?? 18);
  const amount =
    durationType === "HOURLY"
      ? Math.round(baseRate * hours * (1 + gstRate / 100) * 100) / 100
      : Math.round(baseRate * (1 + gstRate / 100) * 100) / 100;

  const [assignment] = await db.$transaction([
    db.lockerAssignment.create({
      data: {
        lockerId: id,
        bookingId,
        guestName,
        guestMobile,
        assignedById: user!.id,
        durationType,
        assignedAt: now,
        dueAt,
        amount,
        paymentMethod,
        notes: `WALKIN:DELIVERED${notes ? `\n${notes}` : ""}`,
      },
    }),
    db.locker.update({
      where: { id },
      data: { status: "ASSIGNED" },
    }),
  ]);

  return NextResponse.json(assignment, { status: 201 });
}
