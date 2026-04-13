import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const updateSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  baseRate: z.number().nonnegative().optional(),
  gstRate: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { error } = await requireAdmin();
  if (error) return error;

  const payload = await req.json();
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const { id } = await params;
  const updated = await db.parkingRate.update({
    where: { id },
    data: {
      ...(parsed.data.label !== undefined ? { label: parsed.data.label.trim() } : {}),
      ...(parsed.data.baseRate !== undefined ? { baseRate: parsed.data.baseRate } : {}),
      ...(parsed.data.gstRate !== undefined ? { gstRate: parsed.data.gstRate } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
    },
  });

  return NextResponse.json({
    ...updated,
    baseRate: Number(updated.baseRate),
    gstRate: Number(updated.gstRate),
  });
}
