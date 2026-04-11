import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/session";

const createSchema = z.object({
  zoneId: z.string().min(1),
  number: z.string().min(1).max(20),
  size: z.enum(["SMALL", "MEDIUM", "LARGE"]).default("MEDIUM"),
  rate: z.number().positive().default(299),
  gstRate: z.number().min(0).max(100).default(18),
});

export async function GET(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const zoneId = searchParams.get("zoneId");
  const status = searchParams.get("status");
  const size = searchParams.get("size");

  const lockers = await db.locker.findMany({
    where: {
      isActive: true,
      ...(zoneId ? { zoneId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(size ? { size: size as never } : {}),
    },
    orderBy: [{ zoneId: "asc" }, { number: "asc" }],
    include: {
      zone: { select: { id: true, name: true } },
      _count: { select: { assignments: true } },
    },
  });

  return NextResponse.json(
    lockers.map((locker) => ({
      ...locker,
      rate: Number(locker.rate),
      gstRate: Number((locker as { gstRate?: number | string }).gstRate ?? 18),
    })),
  );
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const existing = await db.locker.findUnique({
    where: { number: parsed.data.number },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Locker number already exists" },
      { status: 409 }
    );
  }

  const locker = await db.locker.create({ data: parsed.data });
  return NextResponse.json(
    {
      ...locker,
      rate: Number(locker.rate),
      gstRate: Number((locker as { gstRate?: number | string }).gstRate ?? 18),
    },
    { status: 201 },
  );
}
