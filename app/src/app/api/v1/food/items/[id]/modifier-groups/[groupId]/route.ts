import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireSubRole } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) return error;

  const { id, groupId } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const existing = await db.foodModifierGroup.findFirst({
    where: { id: groupId, foodItemId: id },
    select: { id: true, minSelect: true, maxSelect: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Modifier group not found" }, { status: 404 });
  }

  const nextMin = parsed.data.minSelect ?? existing.minSelect;
  const nextMax = parsed.data.maxSelect ?? existing.maxSelect;
  if (nextMin > nextMax) {
    return NextResponse.json(
      { error: "minSelect cannot be greater than maxSelect" },
      { status: 422 },
    );
  }

  const row = await db.foodModifierGroup.update({
    where: { id: groupId },
    data: parsed.data,
    include: {
      options: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) return error;

  const { id, groupId } = await params;
  const existing = await db.foodModifierGroup.findFirst({
    where: { id: groupId, foodItemId: id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Modifier group not found" }, { status: 404 });
  }

  await db.foodModifierGroup.update({
    where: { id: groupId },
    data: { isActive: false },
  });

  await db.foodModifierOption.updateMany({
    where: { groupId },
    data: { isActive: false },
  });

  return new NextResponse(null, { status: 204 });
}
