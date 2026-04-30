import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/session";

function asNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const createSchema = z.object({
  zoneId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
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
  const categoryId = searchParams.get("categoryId");
  const active = searchParams.get("active");

  const lockers = await db.locker.findMany({
    where: {
      ...(active === "0" ? { isActive: false } : active === "all" ? {} : { isActive: true }),
      ...(zoneId ? { zoneId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(size ? { size: size as never } : {}),
    },
    orderBy: [{ zoneId: "asc" }, { number: "asc" }],
    include: {
      zone: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, code: true, baseRate: true, gstRate: true } },
      _count: { select: { assignments: true } },
    },
  });

  return NextResponse.json(
    lockers.map((locker) => ({
      ...locker,
      rate: Number(locker.rate),
      gstRate: asNumber((locker as unknown as Record<string, unknown>).gstRate, 18),
      category: locker.category
        ? {
            ...locker.category,
            baseRate: asNumber((locker.category as unknown as Record<string, unknown>).baseRate, 0),
            gstRate: asNumber((locker.category as unknown as Record<string, unknown>).gstRate, 0),
          }
        : null,
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
  if (existing?.isActive) {
    return NextResponse.json({ error: "Locker number already exists" }, { status: 409 });
  }

  if (parsed.data.categoryId) {
    const category = await db.lockerCategory.findFirst({
      where: { id: parsed.data.categoryId, isActive: true },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Locker category not found" }, { status: 404 });
    }
  }

  const locker = existing
    ? await db.locker.update({
        where: { id: existing.id },
        data: {
          ...parsed.data,
          isActive: true,
        },
      })
    : await db.locker.create({ data: parsed.data });
  return NextResponse.json(
    {
      ...locker,
      rate: Number(locker.rate),
      gstRate: asNumber((locker as unknown as Record<string, unknown>).gstRate, 18),
    },
    { status: 201 },
  );
}
