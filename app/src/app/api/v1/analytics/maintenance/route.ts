import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";

function calcServiceStatus(nextServiceDate: Date | null): "ON_TRACK" | "DUE_SOON" | "OVERDUE" {
  if (!nextServiceDate) return "ON_TRACK";
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const diffDays = Math.ceil((nextServiceDate.getTime() - now.getTime()) / day);
  if (diffDays < 0) return "OVERDUE";
  if (diffDays <= 7) return "DUE_SOON";
  return "ON_TRACK";
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const now = new Date();

  const [assets, workOrders, completedToday] = await Promise.all([
    db.maintenanceAsset.findMany({
      where: { isDeleted: false },
      select: { id: true, nextServiceDate: true, isActive: true },
    }),
    db.workOrder.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        priority: true,
        status: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
      },
    }),
    db.workOrder.count({
      where: {
        isDeleted: false,
        status: "COMPLETED",
        completedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ]);

  const dueSoon = assets.filter((asset: any) => calcServiceStatus(asset.nextServiceDate) === "DUE_SOON").length;
  const overdue = assets.filter((asset: any) => calcServiceStatus(asset.nextServiceDate) === "OVERDUE").length;

  const priorityMap = new Map<string, number>([
    ["CRITICAL", 0],
    ["HIGH", 0],
    ["MEDIUM", 0],
    ["LOW", 0],
  ]);

  const statusMap = new Map<string, number>([
    ["OPEN", 0],
    ["IN_PROGRESS", 0],
    ["COMPLETED", 0],
    ["CANCELLED", 0],
  ]);

  let overdueOpen = 0;

  for (const workOrder of workOrders) {
    priorityMap.set(workOrder.priority, (priorityMap.get(workOrder.priority) ?? 0) + 1);
    statusMap.set(workOrder.status, (statusMap.get(workOrder.status) ?? 0) + 1);

    if (workOrder.dueDate && workOrder.dueDate < now && ["OPEN", "IN_PROGRESS"].includes(workOrder.status)) {
      overdueOpen += 1;
    }
  }

  return NextResponse.json({
    assets: {
      total: assets.length,
      dueSoon,
      overdue,
      active: assets.filter((asset: any) => asset.isActive).length,
    },
    workOrders: {
      total: workOrders.length,
      overdueOpen,
      completedToday,
      byPriority: Array.from(priorityMap.entries()).map(([priority, count]) => ({ priority, count })),
      byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
    },
  });
}
