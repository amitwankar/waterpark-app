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

const packageSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(800).optional().nullable(),
  listedPrice: z.number().min(0),
  salePrice: z.number().min(0),
  gstRate: z.number().min(0).max(100).default(18),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  items: z.array(itemSchema).min(1),
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

function serializePackage(pkg: Awaited<ReturnType<typeof getPackages>>[number]) {
  return {
    ...pkg,
    listedPrice: Number(pkg.listedPrice),
    salePrice: Number(pkg.salePrice),
    gstRate: Number(pkg.gstRate),
    items: pkg.items.map((item) => ({
      ...item,
      label:
        item.ticketType?.name ??
        item.ride?.name ??
        item.locker?.number ??
        item.costumeItem?.name ??
        (item.foodVariant ? `${item.foodItem?.name ?? "Food"} - ${item.foodVariant.name}` : item.foodItem?.name) ??
        item.itemType,
    })),
  };
}

async function getPackages(activeOnly = false) {
  return db.salesPackage.findMany({
    where: { isDeleted: false, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          ticketType: { select: { id: true, name: true, price: true, gstRate: true } },
          ride: { select: { id: true, name: true, entryFee: true, gstRate: true } },
          locker: { select: { id: true, number: true, rate: true, gstRate: true, status: true } },
          costumeItem: { select: { id: true, name: true, tagNumber: true, rentalRate: true, gstRate: true, status: true } },
          foodItem: { select: { id: true, name: true, price: true, gstRate: true, isAvailable: true } },
          foodVariant: { select: { id: true, name: true, price: true, isAvailable: true } },
        },
      },
    },
  });
}

export async function GET(req: NextRequest) {
  const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "true";
  const packages = await getPackages(activeOnly);
  return NextResponse.json(packages.map(serializePackage));
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = packageSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid package payload", issues: parsed.error.issues }, { status: 422 });
  }

  const body = parsed.data;
  const pkg = await db.salesPackage.create({
    data: {
      name: body.name,
      description: body.description || null,
      listedPrice: body.listedPrice,
      salePrice: body.salePrice,
      gstRate: body.gstRate,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
      items: {
        create: body.items.map((item, index) => cleanItem(item, index)),
      },
    },
  });

  return NextResponse.json({ id: pkg.id }, { status: 201 });
}
