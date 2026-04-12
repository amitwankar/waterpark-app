import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const itemSchema = z.object({
  itemType: z.enum(["TICKET", "RIDE", "LOCKER", "COSTUME", "FOOD"]),
  ticketTypeId: z.string().min(1).optional().nullable(),
  rideId: z.string().min(1).optional().nullable(),
  lockerId: z.string().min(1).optional().nullable(),
  costumeItemId: z.string().min(1).optional().nullable(),
  foodItemId: z.string().min(1).optional().nullable(),
  foodVariantId: z.string().min(1).optional().nullable(),
  quantity: z.number().int().min(1).max(500),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(800).optional().nullable(),
  listedPrice: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  gstRate: z.number().min(0).max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  items: z.array(itemSchema).min(1).optional(),
});

function cleanItem(item: z.infer<typeof itemSchema>, sortOrder: number) {
  return {
    itemType: item.itemType,
    ticketTypeId: item.itemType === "TICKET" ? item.ticketTypeId : null,
    rideId: item.itemType === "RIDE" ? item.rideId : null,
    lockerId: item.itemType === "LOCKER" ? item.lockerId : null,
    costumeItemId: item.itemType === "COSTUME" ? item.costumeItemId : null,
    foodItemId: item.itemType === "FOOD" ? item.foodItemId : null,
    foodVariantId: item.itemType === "FOOD" ? item.foodVariantId ?? null : null,
    quantity: item.quantity,
    sortOrder,
  };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid package payload", issues: parsed.error.issues }, { status: 422 });
  }

  const { items, ...body } = parsed.data;
  const updated = await db.$transaction(async (tx) => {
    const pkg = await tx.salesPackage.update({
      where: { id },
      data: {
        ...body,
        description: body.description === undefined ? undefined : body.description || null,
      },
    });
    if (items) {
      await tx.salesPackageItem.deleteMany({ where: { packageId: id } });
      await tx.salesPackageItem.createMany({
        data: items.map((item, index) => ({ packageId: id, ...cleanItem(item, index) })),
      });
    }
    return pkg;
  });

  return NextResponse.json({
    ...updated,
    listedPrice: Number(updated.listedPrice),
    salePrice: Number(updated.salePrice),
    gstRate: Number(updated.gstRate),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await db.salesPackage.update({
    where: { id },
    data: { isDeleted: true, isActive: false, deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
