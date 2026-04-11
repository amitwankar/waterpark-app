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

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  type: z.enum(assetTypeValues).optional(),
  serviceStatus: z.enum(["ON_TRACK", "DUE_SOON", "OVERDUE"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createAssetSchema = z.object({
  name: z.string().trim().min(2).max(120),
  assetType: z.enum(assetTypeValues),
  location: z.string().trim().max(200).optional().nullable(),
  serialNumber: z.string().trim().max(120).optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  warrantyExpiry: z.string().optional().nullable(),
  lastServiceDate: z.string().optional().nullable(),
  serviceIntervalDays: z.number().int().min(1).max(365).default(30),
  linkedRideId: z.string().cuid().optional().nullable(),
  linkedOutletId: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsedQuery = listQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsedQuery.success) {
    return NextResponse.json({ message: "Invalid query", errors: parsedQuery.error.flatten() }, { status: 400 });
  }

  const { search, type, serviceStatus, page, limit } = parsedQuery.data;

  const where = {
    isDeleted: false,
    ...(type ? { assetType: type } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { serialNumber: { contains: search, mode: "insensitive" as const } },
            { location: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.maintenanceAsset.findMany({
      where,
      include: {
        _count: { select: { workOrders: { where: { isDeleted: false } } } },
      },
      orderBy: [{ nextServiceDate: "asc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.maintenanceAsset.count({ where }),
  ]);

  const normalized = items.map((item: any) => ({
    ...item,
    serviceStatus: calcServiceStatus(item.nextServiceDate),
  }));

  const filtered = serviceStatus
    ? normalized.filter((item: any) => item.serviceStatus === serviceStatus)
    : normalized;

  const summary = {
    total,
    dueSoon: normalized.filter((item: any) => item.serviceStatus === "DUE_SOON").length,
    overdue: normalized.filter((item: any) => item.serviceStatus === "OVERDUE").length,
    underMaintenance: await db.workOrder.count({
      where: { isDeleted: false, status: { in: ["OPEN", "IN_PROGRESS"] }, priority: { in: ["CRITICAL", "HIGH"] } },
    }),
  };

  return NextResponse.json({
    items: filtered,
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdminOrEmployee(user) || user?.role !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = createAssetSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const lastServiceDate = parseDateInput(parsed.data.lastServiceDate);
  const nextServiceDate = lastServiceDate
    ? new Date(lastServiceDate.getTime() + parsed.data.serviceIntervalDays * 24 * 60 * 60 * 1000)
    : null;

  const notesLines = [
    parsed.data.notes ? `NOTES:${parsed.data.notes}` : null,
    parsed.data.linkedRideId ? `LINKED_RIDE:${parsed.data.linkedRideId}` : null,
    parsed.data.linkedOutletId ? `LINKED_OUTLET:${parsed.data.linkedOutletId}` : null,
    `SERVICE_INTERVAL_DAYS:${parsed.data.serviceIntervalDays}`,
  ].filter(Boolean) as string[];

  try {
    const created = await db.maintenanceAsset.create({
      data: {
        name: parsed.data.name,
        assetType: parsed.data.assetType,
        location: parsed.data.location ?? null,
        serialNumber: parsed.data.serialNumber ?? null,
        purchaseDate: parseDateInput(parsed.data.purchaseDate),
        warrantyExpiry: parseDateInput(parsed.data.warrantyExpiry),
        lastServiceDate,
        nextServiceDate,
        isActive: true,
      },
    });

    if (notesLines.length > 0) {
      await db.workOrder.create({
        data: {
          assetId: created.id,
          title: `Asset Metadata: ${created.name}`,
          description: notesLines.join("\n"),
          priority: "LOW",
          status: "COMPLETED",
          createdBy: user.id,
          completedAt: new Date(),
          resolutionNotes: "Auto-created metadata record",
        },
      });
    }

    return NextResponse.json({ asset: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create asset";
    return NextResponse.json({ message }, { status: 400 });
  }
}
