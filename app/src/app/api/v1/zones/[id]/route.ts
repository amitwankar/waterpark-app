import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser, requireAdmin } from "@/lib/rides";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const zone = await db.zone.findUnique({ where: { id } });
  if (!zone) {
    return NextResponse.json({ message: "Zone not found" }, { status: 404 });
  }

  const updated = await db.zone.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description ?? null } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
    },
  });

  return NextResponse.json({ zone: updated });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);

  const zone = await db.zone.findUnique({
    where: { id },
    include: {
      rides: { select: { id: true, name: true } },
    },
  });

  if (!zone) {
    return NextResponse.json({ message: "Zone not found" }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    const rideIds = zone.rides.map((ride) => ride.id);
    if (rideIds.length > 0) {
      await tx.rideAccessLog.deleteMany({ where: { rideId: { in: rideIds } } });
      await tx.ticketType.updateMany({ where: { rideId: { in: rideIds } }, data: { rideId: null } });
      await tx.salesPackageItem.updateMany({ where: { rideId: { in: rideIds } }, data: { rideId: null } });
      await tx.workOrder.deleteMany({ where: { rideId: { in: rideIds } } });

      const rideAssets = await tx.maintenanceAsset.findMany({
        where: {
          OR: [
            { serialNumber: { in: rideIds.map((rideId) => `RIDE-${rideId}`) } },
            { name: { in: zone.rides.map((ride) => `Ride Asset - ${ride.name}`) } },
          ],
        },
        select: { id: true },
      });
      const rideAssetIds = rideAssets.map((asset) => asset.id);
      if (rideAssetIds.length > 0) {
        await tx.workOrder.deleteMany({ where: { assetId: { in: rideAssetIds } } });
        await tx.maintenanceAsset.deleteMany({ where: { id: { in: rideAssetIds } } });
      }

      await tx.ride.deleteMany({ where: { id: { in: rideIds } } });
    }

    await tx.zone.delete({ where: { id } });
  });
  return NextResponse.json({ ok: true });
}
