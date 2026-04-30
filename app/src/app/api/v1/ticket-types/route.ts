import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const nullableInt = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.number().int().nullable().optional(),
);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  category: z.string().min(1).max(60).default("General"),
  price: z.coerce.number().min(0),
  gstRate: z.coerce.number().min(0).max(100).default(18),
  minAge: z.coerce.number().int().min(0).nullable().optional().default(null),
  maxAge: z.coerce.number().int().min(0).nullable().optional().default(null),
  maxPerBooking: nullableInt.default(10),
  validDays: z.coerce.number().int().min(1).default(1),
  sortOrder: z.coerce.number().int().min(0).default(0),
  imageUrl: z.string().url().optional().nullable(),
  rideId: z.preprocess((value) => (value === "" ? null : value), z.string().cuid().nullable().optional()),
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
    if (body.maxPerBooking !== null && body.maxPerBooking !== undefined && body.maxPerBooking < 1) {
      return NextResponse.json({ error: "maxPerBooking must be at least 1 or null for unlimited" }, { status: 422 });
    }
    const type = await db.ticketType.create({
      data: {
        ...body,
        description: body.description ?? null,
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
