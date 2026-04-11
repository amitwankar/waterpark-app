import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireSubRole } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  sku: z.string().trim().max(64).nullable().optional(),
  price: z.number().positive().optional(),
  preBookPrice: z.number().positive().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) return error;

  const { id, variantId } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  if (parsed.data.isDefault === true) {
    await db.foodItemVariant.updateMany({
      where: { foodItemId: id, isDefault: true, id: { not: variantId } },
      data: { isDefault: false },
    });
  }

  const existing = await db.foodItemVariant.findFirst({
    where: { id: variantId, foodItemId: id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const row = await db.foodItemVariant.update({
    where: { id: variantId },
    data: {
      ...parsed.data,
      sku: parsed.data.sku ?? undefined,
      preBookPrice: parsed.data.preBookPrice ?? undefined,
    },
  });

  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) return error;

  const { id, variantId } = await params;

  const count = await db.foodItemVariant.count({ where: { foodItemId: id } });
  if (count <= 1) {
    return NextResponse.json(
      { error: "At least one variant is required. Delete the item instead." },
      { status: 409 },
    );
  }

  const existing = await db.foodItemVariant.findFirst({
    where: { id: variantId, foodItemId: id },
    select: { id: true, isDefault: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  await db.foodItemVariant.delete({ where: { id: variantId } });

  if (existing.isDefault) {
    const nextDefault = await db.foodItemVariant.findFirst({
      where: { foodItemId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (nextDefault) {
      await db.foodItemVariant.update({
        where: { id: nextDefault.id },
        data: { isDefault: true },
      });
    }
  }

  return new NextResponse(null, { status: 204 });
}
