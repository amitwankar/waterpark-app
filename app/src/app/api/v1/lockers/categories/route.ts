import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/session";

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(2).max(30).regex(/^[A-Z0-9_-]+$/),
  description: z.string().trim().max(500).optional(),
  size: z.enum(["SMALL", "MEDIUM", "LARGE"]).default("MEDIUM"),
  baseRate: z.number().nonnegative().default(299),
  gstRate: z.number().min(0).max(100).default(18),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

function asNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;

  const categories = await db.lockerCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          lockers: true,
          bookingEntitlements: true,
        },
      },
    },
  });

  return NextResponse.json(
    categories.map((item) => ({
      ...item,
      baseRate: asNumber(item.baseRate, 0),
      gstRate: asNumber(item.gstRate, 0),
    })),
  );
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const payload = {
    ...parsed.data,
    code: parsed.data.code.trim().toUpperCase(),
    description: parsed.data.description?.trim() || null,
  };
  const existing = await db.lockerCategory.findUnique({ where: { code: payload.code } });
  if (existing) {
    return NextResponse.json({ error: "Category code already exists" }, { status: 409 });
  }

  const category = await db.lockerCategory.create({ data: payload });
  return NextResponse.json(
    {
      ...category,
      baseRate: asNumber(category.baseRate, 0),
      gstRate: asNumber(category.gstRate, 0),
    },
    { status: 201 },
  );
}
