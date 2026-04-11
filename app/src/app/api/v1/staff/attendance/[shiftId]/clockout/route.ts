import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireStaff } from "@/lib/session";

const schema = z.object({
  notes: z.string().optional(),
});

/** PATCH: Clock out — sets endTime on an existing shift. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { shiftId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  const shift = await db.shift.findUnique({ where: { id: shiftId } });
  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }
  if (shift.endTime) {
    return NextResponse.json({ error: "Shift already clocked out" }, { status: 409 });
  }

  const updated = await db.shift.update({
    where: { id: shiftId },
    data: {
      endTime: new Date(),
      ...(parsed.success && parsed.data.notes ? { notes: parsed.data.notes } : {}),
    },
  });

  return NextResponse.json(updated);
}
