import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { buildInspectionDescription, ensureRideAsset, getSessionUser, parseInspectionWorkOrderMeta, requireAdminOrEmployee } from "@/lib/rides";

const inspectionSchema = z.object({
  checklistPassed: z.boolean(),
  notes: z.string().trim().max(1000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

const INSPECTION_PREFIX = "[INSPECTION]";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const { id } = await Promise.resolve(context.params);

  const ride = await db.ride.findUnique({ where: { id }, select: { id: true, name: true, isDeleted: true } });
  if (!ride || ride.isDeleted) {
    return NextResponse.json({ message: "Ride not found" }, { status: 404 });
  }

  const inspections = await db.workOrder.findMany({
    where: {
      rideId: ride.id,
      isDeleted: false,
      title: { startsWith: INSPECTION_PREFIX },
    },
    include: {
      assignee: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    items: inspections.map((item: any) => ({
      ...item,
      meta: parseInspectionWorkOrderMeta(item.description),
    })),
  });
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

  const ride = await db.ride.findUnique({ where: { id }, select: { id: true, name: true, isDeleted: true } });
  if (!ride || ride.isDeleted) {
    return NextResponse.json({ message: "Ride not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = inspectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const assetId = await ensureRideAsset(ride.id, ride.name);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const created = await db.workOrder.create({
    data: {
      assetId,
      rideId: ride.id,
      title: `${INSPECTION_PREFIX} ${ride.name}`,
      description: buildInspectionDescription(parsed.data.checklistPassed, parsed.data.notes),
      priority: (parsed.data.priority ?? "LOW") as any,
      status: parsed.data.checklistPassed ? ("COMPLETED" as any) : ("OPEN" as any),
      dueDate,
      completedAt: parsed.data.checklistPassed ? new Date() : null,
      resolutionNotes: parsed.data.checklistPassed ? "Inspection passed" : "Inspection failed",
      createdBy: user?.id ?? "",
    },
    include: {
      creator: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ inspection: created }, { status: 201 });
}
