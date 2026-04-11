import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  code: z.string().trim().max(40).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const payload = parsed.data;
  const nextName = payload.name;
  const nextCode = payload.code === undefined ? undefined : payload.code ? payload.code.toUpperCase() : null;

  if (nextName || nextCode !== undefined) {
    const conflict = await db.departmentMaster.findFirst({
      where: {
        id: { not: id },
        isDeleted: false,
        OR: [
          ...(nextName ? [{ name: { equals: nextName, mode: "insensitive" as const } }] : []),
          ...(nextCode ? [{ code: nextCode }] : []),
        ],
      },
      select: { id: true },
    });

    if (conflict) {
      return NextResponse.json({ error: "Department with same name/code already exists" }, { status: 409 });
    }
  }

  const row = await db.departmentMaster.update({
    where: { id },
    data: {
      ...(nextName !== undefined ? { name: nextName } : {}),
      ...(nextCode !== undefined ? { code: nextCode } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const department = await db.departmentMaster.findUnique({
    where: { id },
    select: { id: true, name: true, isDeleted: true },
  });

  if (!department || department.isDeleted) {
    return NextResponse.json({ error: "Department not found" }, { status: 404 });
  }

  const linkedCount = await db.staffProfile.count({
    where: { department: department.name, isActive: true },
  });

  if (linkedCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete department. ${linkedCount} active staff are linked.` },
      { status: 409 },
    );
  }

  await db.departmentMaster.update({
    where: { id },
    data: { isDeleted: true, isActive: false, deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
