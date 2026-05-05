import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getIstTodayDateOnly, normalizeQueuePrefix } from "@/lib/queue-public";
import { normalizeQueueVerificationMode } from "@/lib/queue-verification";

type FoodOption = {
  id: string;
  foodItemId: string;
  foodVariantId?: string;
  name: string;
  variantName?: string;
  price: number;
  gstRate: number;
};

type LockerProduct = {
  lockerCategoryId: string;
  label: string;
  code: string;
  size: string;
  rate: number;
  gstRate: number;
};

type CostumeGroup = {
  costumeItemId: string;
  label: string;
  categoryId: string;
  categoryName: string;
  size: string;
  rentalRate: number;
  gstRate: number;
  availableQuantity: number;
};

function normalizeTagBase(tagNumber: string): string {
  return tagNumber.trim().toUpperCase().replace(/-\d{3}$/i, "");
}

export async function GET() {
  const [config, ticketTypes, packages, foodItems, foodVariants, lockerCategories, costumes, rides, queueCountToday] = await Promise.all([
    db.parkConfig.findFirst({
      select: {
        queueLimitPerDay: true,
        queuePrefix: true,
        queueVerificationMode: true,
        showGstBreakup: true,
      },
    }),
    db.ticketType.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, price: true, gstRate: true },
    }),
    db.salesPackage.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: {
            ticketType: { select: { name: true } },
            ride: { select: { name: true } },
            costumeItem: { select: { name: true } },
            foodItem: { select: { name: true } },
            foodVariant: { select: { name: true } },
            locker: { select: { number: true } },
          },
        },
      },
    }),
    db.foodItem.findMany({
      where: { isDeleted: false, isAvailable: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, price: true, gstRate: true },
    }),
    db.foodItemVariant.findMany({
      where: { isAvailable: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, foodItemId: true, name: true, price: true },
    }),
    db.lockerCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, size: true, baseRate: true, gstRate: true },
    }),
    db.costumeItem.findMany({
      where: { isActive: true, status: "AVAILABLE" },
      include: { category: { select: { id: true, name: true, isActive: true } } },
      orderBy: [{ categoryId: "asc" }, { size: "asc" }, { tagNumber: "asc" }],
    }),
    db.ride.findMany({
      where: { isDeleted: false, status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, entryFee: true, gstRate: true, zone: { select: { name: true } } },
    }),
    db.queueRequest.count({ where: { visitDate: getIstTodayDateOnly() } }),
  ]);

  const variantMap = new Map(foodVariants.map((v) => [v.id, v]));
  const foodOptions: FoodOption[] = [];
  for (const item of foodItems) {
    const variantsForItem = foodVariants.filter((v) => v.foodItemId === item.id);
    if (variantsForItem.length === 0) {
      foodOptions.push({
        id: item.id,
        foodItemId: item.id,
        name: item.name,
        price: Number(item.price),
        gstRate: Number(item.gstRate ?? 0),
      });
      continue;
    }
    for (const variant of variantsForItem) {
      const resolved = variantMap.get(variant.id);
      if (!resolved) continue;
      foodOptions.push({
        id: `${item.id}__${variant.id}`,
        foodItemId: item.id,
        foodVariantId: variant.id,
        name: item.name,
        variantName: variant.name,
        price: Number(variant.price),
        gstRate: Number(item.gstRate ?? 0),
      });
    }
  }

  const lockerProducts: LockerProduct[] = lockerCategories.map((category) => ({
    lockerCategoryId: category.id,
    code: category.code,
    size: category.size,
    label: `${category.name} (${category.code})`,
    rate: Number(category.baseRate),
    gstRate: Number(category.gstRate ?? 0),
  }));

  const costumeGroupsMap = new Map<string, CostumeGroup>();
  for (const item of costumes) {
    if (!item.category?.isActive) continue;
    const groupId = normalizeTagBase(item.tagNumber);
    const existing = costumeGroupsMap.get(groupId);
    if (!existing) {
      costumeGroupsMap.set(groupId, {
        costumeItemId: groupId,
        label: `${item.category.name} · ${item.size}`,
        categoryId: item.categoryId,
        categoryName: item.category.name,
        size: item.size,
        rentalRate: Number(item.rentalRate),
        gstRate: Number(item.gstRate ?? 0),
        availableQuantity: 1,
      });
    } else {
      existing.availableQuantity += 1;
    }
  }

  return NextResponse.json({
    queue: {
      limitPerDay: Number(config?.queueLimitPerDay ?? 0),
      prefix: normalizeQueuePrefix(config?.queuePrefix),
      todayCount: queueCountToday,
      verificationMode: normalizeQueueVerificationMode(config?.queueVerificationMode),
      showGstBreakup: config?.showGstBreakup !== false,
    },
    tickets: ticketTypes.map((t) => ({
      id: t.id,
      name: t.name,
      price: Number(t.price),
      gstRate: Number(t.gstRate ?? 0),
    })),
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      listedPrice: Number(p.listedPrice),
      salePrice: Number(p.salePrice),
      gstRate: Number(p.gstRate ?? 0),
      items: p.items.map((item) => ({
        itemType: item.itemType,
        quantity: item.quantity,
        label:
          item.ticketType?.name ??
          item.ride?.name ??
          (item.foodVariant ? `${item.foodItem?.name ?? "Food"} · ${item.foodVariant.name}` : item.foodItem?.name) ??
          item.costumeItem?.name ??
          item.locker?.number ??
          item.itemType,
      })),
    })),
    foodOptions,
    lockerProducts,
    costumeGroups: Array.from(costumeGroupsMap.values()),
    rides: rides.map((r) => ({
      id: r.id,
      name: r.name,
      zoneName: r.zone?.name ?? null,
      entryFee: Number(r.entryFee ?? 0),
      gstRate: Number(r.gstRate ?? 0),
    })),
  });
}
