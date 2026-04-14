import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getIstTodayDateOnly, normalizeQueuePrefix } from "@/lib/queue-public";

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
  lockerId: string;
  label: string;
  zoneId: string;
  zoneName: string;
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
  const [config, ticketTypes, packages, foodItems, foodVariants, lockers, costumes, rides, queueCountToday] = await Promise.all([
    db.parkConfig.findFirst({
      select: {
        queueLimitPerDay: true,
        queuePrefix: true,
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
      select: { id: true, name: true, listedPrice: true, salePrice: true, gstRate: true },
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
    db.locker.findMany({
      where: { isActive: true },
      include: { zone: { select: { id: true, name: true, isActive: true } } },
      orderBy: [{ zoneId: "asc" }, { size: "asc" }, { number: "asc" }],
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

  const lockerProductsMap = new Map<string, LockerProduct>();
  for (const locker of lockers) {
    if (!locker.zone?.isActive) continue;
    const key = `${locker.zoneId}:${locker.size}`;
    if (!lockerProductsMap.has(key)) {
      lockerProductsMap.set(key, {
        lockerId: locker.id,
        zoneId: locker.zoneId,
        zoneName: locker.zone.name,
        size: locker.size,
        label: `${locker.zone.name} · ${locker.size}`,
        rate: Number(locker.rate),
        gstRate: Number(locker.gstRate ?? 0),
      });
    }
  }

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
    })),
    foodOptions,
    lockerProducts: Array.from(lockerProductsMap.values()),
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

