import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser, requireAdminOrEmployee } from "@/lib/rides";

const serviceSchema = z.object({
  lastServiceDate: z.string().optional(),
  serviceIntervalDays: z.number().int().min(1).max(365).default(30),
  notes: z.string().trim().max(1000).optional(),
});

function parseDateInput(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdminOrEmployee(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const payload = await request.json().catch(() => null);
  const parsed = serviceSchema.safeParse(payload ?? {});
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const asset = await db.maintenanceAsset.findFirst({ where: { id, isDeleted: false } });
  if (!asset) {
    return NextResponse.json({ message: "Asset not found" }, { status: 404 });
  }

  const lastServiceDate = parseDateInput(parsed.data.lastServiceDate) ?? new Date();
  const nextServiceDate = new Date(
    lastServiceDate.getTime() + parsed.data.serviceIntervalDays * 24 * 60 * 60 * 1000,
  );

  const [updated] = await db.$transaction([
    db.maintenanceAsset.update({
      where: { id },
      data: {
        lastServiceDate,
        nextServiceDate,
        isActive: true,
      },
    }),
    db.workOrder.create({
      data: {
        assetId: id,
        title: `Service completed: ${asset.name}`,
        description: `SERVICE_INTERVAL_DAYS:${parsed.data.serviceIntervalDays}`,
        priority: "LOW",
        status: "COMPLETED",
        createdBy: user?.id ?? "",
        completedAt: new Date(),
        resolutionNotes: parsed.data.notes?.trim() || "Scheduled service completed",
      },
    }),
  ]);

  return NextResponse.json({ asset: updated });
}
