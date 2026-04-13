import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireStaff, requireAdmin } from "@/lib/session";

const createSchema = z.object({
  vehicleType: z.enum(["TWO_WHEELER", "FOUR_WHEELER", "BUS", "OTHER"]),
  label: z.string().min(1).max(80),
  baseRate: z.number().nonnegative(),
  gstRate: z.number().min(0).max(100),
  isActive: z.boolean().optional(),
});

const defaultRates: Array<{ vehicleType: "TWO_WHEELER" | "FOUR_WHEELER" | "BUS" | "OTHER"; label: string; baseRate: number; gstRate: number }> = [
  { vehicleType: "TWO_WHEELER", label: "Two Wheeler", baseRate: 30, gstRate: 18 },
  { vehicleType: "FOUR_WHEELER", label: "Four Wheeler", baseRate: 80, gstRate: 18 },
  { vehicleType: "BUS", label: "Bus", baseRate: 200, gstRate: 18 },
  { vehicleType: "OTHER", label: "Other", baseRate: 100, gstRate: 18 },
];

async function ensureDefaults(): Promise<void> {
  const count = await db.parkingRate.count();
  if (count > 0) return;
  await db.parkingRate.createMany({
    data: defaultRates.map((row) => ({
      vehicleType: row.vehicleType,
      label: row.label,
      baseRate: row.baseRate,
      gstRate: row.gstRate,
      isActive: true,
    })),
  });
}

export async function GET(): Promise<NextResponse> {
  const { error } = await requireStaff();
  if (error) return error;

  await ensureDefaults();

  const rows = await db.parkingRate.findMany({
    orderBy: { vehicleType: "asc" },
  });

  return NextResponse.json(rows.map((row) => ({
    ...row,
    baseRate: Number(row.baseRate),
    gstRate: Number(row.gstRate),
  })));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { error } = await requireAdmin();
  if (error) return error;

  const payload = await req.json();
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const created = await db.parkingRate.upsert({
    where: { vehicleType: parsed.data.vehicleType },
    update: {
      label: parsed.data.label.trim(),
      baseRate: parsed.data.baseRate,
      gstRate: parsed.data.gstRate,
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
    },
    create: {
      vehicleType: parsed.data.vehicleType,
      label: parsed.data.label.trim(),
      baseRate: parsed.data.baseRate,
      gstRate: parsed.data.gstRate,
      isActive: parsed.data.isActive ?? true,
    },
  });

  return NextResponse.json({
    ...created,
    baseRate: Number(created.baseRate),
    gstRate: Number(created.gstRate),
  });
}
