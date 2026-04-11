import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireStaff, requireSubRole } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await params;
  const category = await db.foodCategory.findUnique({
    where: { id },
    include: {
      outlet: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  });

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json(category);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) return error;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const category = await db.foodCategory.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(category);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) return error;

  const { id } = await params;
  const activeItems = await db.foodItem.count({
    where: {
      categoryId: id,
      isDeleted: false,
    },
  });

  if (activeItems > 0) {
    return NextResponse.json(
      { error: "Delete menu items in this category first" },
      { status: 409 }
    );
  }

  await db.foodCategory.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
