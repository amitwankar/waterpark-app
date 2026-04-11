import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await params;

  const zone = await db.lockerZone.findUnique({
    where: { id },
    include: {
      lockers: {
        orderBy: { number: "asc" },
      },
    },
  });

  if (!zone) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  return NextResponse.json(zone);
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

  const zone = await db.lockerZone.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(zone);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const zone = await db.lockerZone.findUnique({
    where: { id },
    include: {
      _count: { select: { lockers: true } },
    },
  });

  if (!zone) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  if (zone._count.lockers > 0) {
    return NextResponse.json(
      { error: "Cannot delete zone with lockers assigned. Move/delete lockers first." },
      { status: 409 }
    );
  }

  await db.lockerZone.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
