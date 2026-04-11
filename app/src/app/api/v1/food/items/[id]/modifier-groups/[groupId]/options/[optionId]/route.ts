import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireSubRole } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  price: z.number().min(0).optional(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string; optionId: string }> },
) {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) return error;

  const { id, groupId, optionId } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const existing = await db.foodModifierOption.findFirst({
    where: {
      id: optionId,
      groupId,
      group: { foodItemId: id },
    },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Modifier option not found" }, { status: 404 });
  }

  if (parsed.data.isDefault === true) {
    await db.foodModifierOption.updateMany({
      where: { groupId, isDefault: true, id: { not: optionId } },
      data: { isDefault: false },
    });
  }

  const row = await db.foodModifierOption.update({
    where: { id: optionId },
    data: parsed.data,
  });

  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string; optionId: string }> },
) {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) return error;

  const { id, groupId, optionId } = await params;
  const existing = await db.foodModifierOption.findFirst({
    where: {
      id: optionId,
      groupId,
      group: { foodItemId: id },
    },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Modifier option not found" }, { status: 404 });
  }

  await db.foodModifierOption.update({
    where: { id: optionId },
    data: { isActive: false, isDefault: false },
  });

  return new NextResponse(null, { status: 204 });
}
