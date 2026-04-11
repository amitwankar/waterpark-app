import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  category: z.string().min(1).max(60).default("General"),
  price: z.number().min(0),
  gstRate: z.number().min(0).max(100).default(18),
  minAge: z.number().int().min(0).nullable().default(null),
  maxAge: z.number().int().min(0).nullable().default(null),
  maxPerBooking: z.number().int().min(1).nullable().default(10),
  validDays: z.number().int().min(1).default(1),
  sortOrder: z.number().int().min(0).default(0),
  imageUrl: z.string().url().optional(),
  rideId: z.string().cuid().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("activeOnly") === "true";

  const types = await db.ticketType.findMany({
    where: { isDeleted: false, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      ride: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json(types.map((t) => ({
    ...t,
    price: Number(t.price),
    gstRate: Number(t.gstRate),
  })));
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 401 });

  try {
    const body = createSchema.parse(await req.json());
    const type = await db.ticketType.create({
      data: {
        ...body,
        price: body.price,
        gstRate: body.gstRate,
      },
      include: {
        ride: {
          select: { id: true, name: true },
        },
      },
    });
    return NextResponse.json({ ...type, price: Number(type.price), gstRate: Number(type.gstRate) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 422 });
    return NextResponse.json({ error: "Failed to create ticket type" }, { status: 500 });
  }
}
