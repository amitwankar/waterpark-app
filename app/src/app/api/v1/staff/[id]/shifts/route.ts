import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const createSchema = z.object({
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  shiftType: z.enum(["MORNING", "AFTERNOON", "EVENING", "NIGHT"]),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  isPresent: z.boolean().default(false),
  notes: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const profile = await db.staffProfile.findUnique({ where: { userId: id } });
  if (!profile) {
    return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
  }

  const shifts = await db.shift.findMany({
    where: {
      staffId: profile.id,
      ...(from || to
        ? {
            shiftDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { shiftDate: "desc" },
  });

  return NextResponse.json(shifts);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const profile = await db.staffProfile.findUnique({ where: { userId: id } });
  if (!profile) {
    return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
  }

  const shift = await db.shift.create({
    data: {
      staffId: profile.id,
      shiftDate: new Date(parsed.data.shiftDate),
      shiftType: parsed.data.shiftType,
      startTime: new Date(parsed.data.startTime),
      endTime: parsed.data.endTime ? new Date(parsed.data.endTime) : undefined,
      isPresent: parsed.data.isPresent,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json(shift, { status: 201 });
}
