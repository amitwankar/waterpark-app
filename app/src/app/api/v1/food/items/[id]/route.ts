import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireStaff, requireSubRole } from "@/lib/session";

const updateSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().min(1).max(150).optional(),
  description: z.string().optional(),
  sku: z.string().trim().max(64).nullable().optional(),
  price: z.number().positive().optional(),
  preBookPrice: z.number().positive().nullable().optional(),
  gstRate: z.number().min(0).max(100).optional(),
  prepTimeMin: z.number().int().min(0).max(240).nullable().optional(),
  allergens: z.array(z.string().trim().min(1).max(50)).max(12).optional(),
  isVeg: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await params;

  const item = await db.foodItem.findFirst({
    where: { id, isDeleted: false },
    include: {
      variants: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      modifierGroups: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          options: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          },
        },
      },
      category: {
        include: { outlet: { select: { id: true, name: true } } },
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSubRole("FB_STAFF");
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

  const item = await db.foodItem.update({
    where: { id },
    data: {
      ...parsed.data,
      sku: parsed.data.sku ?? undefined,
      prepTimeMin: parsed.data.prepTimeMin ?? undefined,
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) return error;

  const { id } = await params;

  await db.foodItem.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  return new NextResponse(null, { status: 204 });
}
