import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireStaff, requireSubRole } from "@/lib/session";

const createSchema = z.object({
  outletId: z.string().min(1),
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().default(0),
});

export async function GET(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const outletId = searchParams.get("outletId");

  const categories = await db.foodCategory.findMany({
    where: {
      isActive: true,
      ...(outletId ? { outletId } : {}),
    },
    orderBy: [{ outletId: "asc" }, { sortOrder: "asc" }],
    include: { _count: { select: { items: true } } },
  });

  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const category = await db.foodCategory.create({ data: parsed.data });
  return NextResponse.json(category, { status: 201 });
}
