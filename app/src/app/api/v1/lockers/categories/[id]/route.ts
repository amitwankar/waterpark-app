import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().min(2).max(30).regex(/^[A-Z0-9_-]+$/).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  size: z.enum(["SMALL", "MEDIUM", "LARGE"]).optional(),
  baseRate: z.number().nonnegative().optional(),
  gstRate: z.number().min(0).max(100).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

function asNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await params;
  const category = await db.lockerCategory.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          lockers: true,
          bookingEntitlements: true,
        },
      },
    },
  });

  if (!category) {
    return NextResponse.json({ error: "Locker category not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...category,
    baseRate: asNumber(category.baseRate, 0),
    gstRate: asNumber(category.gstRate, 0),
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const payload = {
    ...parsed.data,
    code: parsed.data.code?.trim().toUpperCase(),
    description:
      parsed.data.description === undefined ? undefined : parsed.data.description?.trim() || null,
  };
  if (payload.code) {
    const existing = await db.lockerCategory.findFirst({
      where: { code: payload.code, id: { not: id } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Category code already exists" }, { status: 409 });
    }
  }

  const category = await db.lockerCategory.update({
    where: { id },
    data: payload,
  });

  return NextResponse.json({
    ...category,
    baseRate: asNumber(category.baseRate, 0),
    gstRate: asNumber(category.gstRate, 0),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const used = await db.lockerCategory.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          lockers: true,
          bookingEntitlements: true,
          packageItems: true,
        },
      },
    },
  });
  if (!used) {
    return NextResponse.json({ error: "Locker category not found" }, { status: 404 });
  }

  if (used._count.lockers > 0 || used._count.bookingEntitlements > 0 || used._count.packageItems > 0) {
    await db.lockerCategory.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true, softDeleted: true });
  }

  await db.lockerCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
