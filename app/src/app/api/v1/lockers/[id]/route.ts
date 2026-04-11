import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/session";

function asNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const updateSchema = z.object({
  zoneId: z.string().min(1).optional(),
  number: z.string().min(1).max(20).optional(),
  size: z.enum(["SMALL", "MEDIUM", "LARGE"]).optional(),
  rate: z.number().positive().optional(),
  gstRate: z.number().min(0).max(100).optional(),
  status: z.enum(["AVAILABLE", "ASSIGNED", "RETURNED", "MAINTENANCE"]).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await params;

  const locker = await db.locker.findUnique({
    where: { id },
    include: {
      zone: true,
      assignments: {
        where: { returnedAt: null },
        take: 1,
        orderBy: { assignedAt: "desc" },
        include: { assignedBy: { select: { id: true, name: true } } },
      },
    },
  });

  if (!locker) {
    return NextResponse.json({ error: "Locker not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...locker,
    rate: Number(locker.rate),
    gstRate: asNumber((locker as unknown as Record<string, unknown>).gstRate, 18),
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const locker = await db.locker.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({
    ...locker,
    rate: Number(locker.rate),
    gstRate: asNumber((locker as unknown as Record<string, unknown>).gstRate, 18),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const activeAssignments = await db.lockerAssignment.count({
    where: {
      lockerId: id,
      returnedAt: null,
    },
  });
  if (activeAssignments > 0) {
    return NextResponse.json({ error: "Cannot delete locker with active assignment" }, { status: 409 });
  }

  await db.locker.update({
    where: { id },
    data: {
      isActive: false,
      status: "MAINTENANCE",
    },
  });
  return NextResponse.json({ ok: true });
}
