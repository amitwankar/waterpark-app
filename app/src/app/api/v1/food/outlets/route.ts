import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  location: z.string().optional(),
  isOpen: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;

  const outlets = await db.foodOutlet.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { categories: true, orders: true } },
    },
  });

  return NextResponse.json(outlets);
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

  const outlet = await db.foodOutlet.create({ data: parsed.data });
  return NextResponse.json(outlet, { status: 201 });
}
