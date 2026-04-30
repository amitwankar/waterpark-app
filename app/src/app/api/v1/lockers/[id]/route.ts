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
  categoryId: z.string().min(1).nullable().optional(),
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
      category: true,
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
    category: locker.category
      ? {
          ...locker.category,
          baseRate: asNumber((locker.category as unknown as Record<string, unknown>).baseRate, 0),
          gstRate: asNumber((locker.category as unknown as Record<string, unknown>).gstRate, 0),
        }
      : null,
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

  if (parsed.data.categoryId) {
    const category = await db.lockerCategory.findFirst({
      where: { id: parsed.data.categoryId, isActive: true },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Locker category not found" }, { status: 404 });
    }
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
  const locker = await db.locker.findUnique({ where: { id }, select: { id: true, number: true } });
  if (!locker) {
    return NextResponse.json({ error: "Locker not found" }, { status: 404 });
  }
  const activeAssignments = await db.lockerAssignment.count({
    where: {
      lockerId: id,
      returnedAt: null,
    },
  });
  if (activeAssignments > 0) {
    return NextResponse.json({ error: "Cannot delete locker with active assignment" }, { status: 409 });
  }

  await db.$transaction(async (tx) => {
    // Keep locker soft-deleted in business data.
    await tx.locker.update({
      where: { id },
      data: {
        isActive: false,
        status: "MAINTENANCE",
      },
    });

    // Remove linked maintenance entities if they exist for this locker.
    const lockerAssets = await tx.maintenanceAsset.findMany({
      where: {
        OR: [{ serialNumber: `LOCKER-${id}` }, { serialNumber: `LOCKER-${locker.number}` }],
      },
      select: { id: true },
    });
    const lockerAssetIds = lockerAssets.map((asset) => asset.id);
    if (lockerAssetIds.length > 0) {
      await tx.workOrder.deleteMany({ where: { assetId: { in: lockerAssetIds } } });
      await tx.maintenanceAsset.deleteMany({ where: { id: { in: lockerAssetIds } } });
    }
  });
  return NextResponse.json({ ok: true });
}
