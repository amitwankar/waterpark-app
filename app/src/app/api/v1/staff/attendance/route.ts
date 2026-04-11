import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/session";

const clockInSchema = z.object({
  staffUserId: z.string().min(1),
  shiftType: z.enum(["MORNING", "AFTERNOON", "EVENING", "NIGHT"]),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

/** GET: List today's attendance for all or a specific staff member. */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const staffUserId = searchParams.get("staffUserId");

  const shifts = await db.shift.findMany({
    where: {
      shiftDate: new Date(date),
      ...(staffUserId
        ? { staff: { userId: staffUserId } }
        : {}),
    },
    include: {
      staff: {
        include: {
          user: { select: { id: true, name: true, mobile: true, subRole: true } },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json(shifts);
}

/** POST: Clock in — creates a shift record for the staff member. */
export async function POST(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const body = await req.json();
  const parsed = clockInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const profile = await db.staffProfile.findUnique({
    where: { userId: parsed.data.staffUserId },
  });
  if (!profile) {
    return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
  }

  // Prevent duplicate clock-in on same date + shift type
  const existing = await db.shift.findFirst({
    where: {
      staffId: profile.id,
      shiftDate: new Date(parsed.data.shiftDate),
      shiftType: parsed.data.shiftType,
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Shift already recorded for this date and shift type" },
      { status: 409 }
    );
  }

  const now = new Date();
  const shift = await db.shift.create({
    data: {
      staffId: profile.id,
      shiftDate: new Date(parsed.data.shiftDate),
      shiftType: parsed.data.shiftType,
      startTime: now,
      isPresent: true,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json(shift, { status: 201 });
}
