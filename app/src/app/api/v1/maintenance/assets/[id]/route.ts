import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser, requireAdminOrEmployee } from "@/lib/rides";

const assetTypeValues = [
  "RIDE",
  "PUMP",
  "ELECTRICAL",
  "PLUMBING",
  "HVAC",
  "VEHICLE",
  "SAFETY_EQUIPMENT",
  "FOOD_EQUIPMENT",
  "LOCKER",
  "OTHER",
] as const;

const updateAssetSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  assetType: z.enum(assetTypeValues).optional(),
  location: z.string().trim().max(200).optional().nullable(),
  serialNumber: z.string().trim().max(120).optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  warrantyExpiry: z.string().optional().nullable(),
  lastServiceDate: z.string().optional().nullable(),
  nextServiceDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

function parseDateInput(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calcServiceStatus(nextServiceDate: Date | null): "ON_TRACK" | "DUE_SOON" | "OVERDUE" {
  if (!nextServiceDate) return "ON_TRACK";
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const diffDays = Math.ceil((nextServiceDate.getTime() - now.getTime()) / day);
  if (diffDays < 0) return "OVERDUE";
  if (diffDays <= 7) return "DUE_SOON";
  return "ON_TRACK";
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const { id } = await Promise.resolve(context.params);

  const asset = await db.maintenanceAsset.findFirst({
    where: { id, isDeleted: false },
    include: {
      workOrders: {
        where: { isDeleted: false },
        include: {
          assignee: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          ride: { select: { id: true, name: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!asset) {
    return NextResponse.json({ message: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({
    asset: {
      ...asset,
      serviceStatus: calcServiceStatus(asset.nextServiceDate),
      serviceHistory: asset.workOrders.filter((item: any) => item.status === "COMPLETED"),
    },
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdminOrEmployee(user) || user?.role !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const payload = await request.json().catch(() => null);
  const parsed = updateAssetSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.maintenanceAsset.findFirst({ where: { id, isDeleted: false } });
  if (!existing) {
    return NextResponse.json({ message: "Asset not found" }, { status: 404 });
  }

  try {
    const updated = await db.maintenanceAsset.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.assetType !== undefined ? { assetType: parsed.data.assetType } : {}),
        ...(parsed.data.location !== undefined ? { location: parsed.data.location ?? null } : {}),
        ...(parsed.data.serialNumber !== undefined ? { serialNumber: parsed.data.serialNumber ?? null } : {}),
        ...(parsed.data.purchaseDate !== undefined ? { purchaseDate: parseDateInput(parsed.data.purchaseDate) } : {}),
        ...(parsed.data.warrantyExpiry !== undefined ? { warrantyExpiry: parseDateInput(parsed.data.warrantyExpiry) } : {}),
        ...(parsed.data.lastServiceDate !== undefined ? { lastServiceDate: parseDateInput(parsed.data.lastServiceDate) } : {}),
        ...(parsed.data.nextServiceDate !== undefined ? { nextServiceDate: parseDateInput(parsed.data.nextServiceDate) } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    });

    return NextResponse.json({ asset: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update asset";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdminOrEmployee(user) || user?.role !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);

  const asset = await db.maintenanceAsset.findFirst({ where: { id, isDeleted: false } });
  if (!asset) {
    return NextResponse.json({ message: "Asset not found" }, { status: 404 });
  }

  const openWorkOrders = await db.workOrder.count({
    where: {
      assetId: id,
      isDeleted: false,
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
  });

  if (openWorkOrders > 0) {
    return NextResponse.json({ message: "Cannot delete asset with open work orders" }, { status: 400 });
  }

  await db.maintenanceAsset.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      isActive: false,
    },
  });

  return NextResponse.json({ ok: true });
}
