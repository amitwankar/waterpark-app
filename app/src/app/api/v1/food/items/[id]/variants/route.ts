import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireStaff, requireSubRole } from "@/lib/session";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sku: z.string().trim().max(64).nullable().optional(),
  price: z.number().positive(),
  preBookPrice: z.number().positive().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isDefault: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await params;

  const rows = await db.foodItemVariant.findMany({
    where: { foodItemId: id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(rows);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const item = await db.foodItem.findFirst({
    where: { id, isDeleted: false },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Food item not found" }, { status: 404 });
  }

  if (parsed.data.isDefault) {
    await db.foodItemVariant.updateMany({
      where: { foodItemId: id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const row = await db.foodItemVariant.create({
    data: {
      foodItemId: id,
      name: parsed.data.name,
      sku: parsed.data.sku ?? undefined,
      price: parsed.data.price,
      preBookPrice: parsed.data.preBookPrice ?? undefined,
      sortOrder: parsed.data.sortOrder,
      isDefault: parsed.data.isDefault,
      isAvailable: parsed.data.isAvailable,
    },
  });

  return NextResponse.json(row, { status: 201 });
}
