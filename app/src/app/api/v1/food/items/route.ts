import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireStaff, requireSubRole } from "@/lib/session";

const createSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(150),
  description: z.string().nullable().optional(),
  sku: z.string().trim().max(64).nullable().optional(),
  price: z.number().positive(),
  preBookPrice: z.number().positive().nullable().optional(),
  gstRate: z.number().min(0).max(100).default(5),
  prepTimeMin: z.number().int().min(0).max(240).nullable().optional(),
  allergens: z.array(z.string().trim().min(1).max(50)).max(12).optional(),
  isVeg: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export async function GET(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const outletId = searchParams.get("outletId");
  const available = searchParams.get("available");

  const items = await db.foodItem.findMany({
    where: {
      isDeleted: false,
      ...(categoryId ? { categoryId } : {}),
      ...(outletId ? { category: { outletId } } : {}),
      ...(available === "true" ? { isAvailable: true } : {}),
    },
    orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
    include: {
      category: { select: { id: true, name: true, outletId: true } },
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
    },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const item = await db.foodItem.create({
    data: {
      ...parsed.data,
      description: parsed.data.description ?? undefined,
      sku: parsed.data.sku ?? undefined,
      prepTimeMin: parsed.data.prepTimeMin ?? undefined,
      allergens: parsed.data.allergens ?? [],
      imageUrl: parsed.data.imageUrl ?? undefined,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
