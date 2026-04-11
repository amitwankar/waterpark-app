import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUser, requireAdmin } from "@/lib/rides";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const now = new Date();

  const dueAssets = await db.maintenanceAsset.findMany({
    where: {
      isDeleted: false,
      isActive: true,
      nextServiceDate: { lte: now },
    },
    select: {
      id: true,
      name: true,
      nextServiceDate: true,
    },
  });

  let createdCount = 0;

  for (const asset of dueAssets) {
    const open = await db.workOrder.count({
      where: {
        assetId: asset.id,
        isDeleted: false,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        title: { startsWith: "Preventive Service" },
      },
    });

    if (open > 0) continue;

    await db.workOrder.create({
      data: {
        assetId: asset.id,
        title: `Preventive Service: ${asset.name}`,
        description: `Auto-created on overdue service scan. Next service date was ${asset.nextServiceDate?.toISOString() ?? "N/A"}`,
        priority: "MEDIUM",
        status: "OPEN",
        dueDate: now,
        createdBy: user?.id ?? "",
      },
    });

    createdCount += 1;
  }

  return NextResponse.json({
    scanned: dueAssets.length,
    created: createdCount,
  });
}
