import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  costumeItemId: z.string().cuid().optional(),
  costumeItemIds: z.array(z.string().cuid()).min(1).optional(),
  bookingId: z.string().cuid().optional(),
  posSessionId: z.string().cuid().optional(),
  guestName: z.string().min(1).max(120),
  guestMobile: z.string().regex(/^\d{10}$/).optional(),
  paymentMethod: z.enum(["CASH", "MANUAL_UPI", "CARD", "COMPLIMENTARY"]).default("CASH"),
  depositAmount: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
}).refine((value) => Boolean(value.costumeItemId || (value.costumeItemIds && value.costumeItemIds.length > 0)), {
  message: "At least one costume item is required",
  path: ["costumeItemIds"],
});

export async function GET(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const active = searchParams.get("active") === "true";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const take = 30;

  const [items, total] = await db.$transaction([
    db.costumeRental.findMany({
      where: active ? { returnedAt: null } : {},
      orderBy: { rentedAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: {
        costumeItem: { include: { category: { select: { name: true } } } },
        rentedBy: { select: { name: true } },
      },
    }),
    db.costumeRental.count({ where: active ? { returnedAt: null } : {} }),
  ]);

  return NextResponse.json({ items, total, page, pages: Math.ceil(total / take) });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireStaff();
  if (error) return error;

  try {
    const body = createSchema.parse(await req.json());
    if (body.bookingId) {
      const booking = await db.booking.findUnique({ where: { id: body.bookingId }, select: { status: true } });
      if (!booking) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
      if (booking.status !== "CHECKED_IN") {
        return NextResponse.json({ error: "Booking must be checked in before issuing costumes" }, { status: 409 });
      }
    }
    const itemIds = body.costumeItemIds?.length
      ? Array.from(new Set(body.costumeItemIds))
      : body.costumeItemId
        ? [body.costumeItemId]
        : [];
    if (itemIds.length === 0) {
      return NextResponse.json({ error: "No costume item selected" }, { status: 422 });
    }

    const items = await db.costumeItem.findMany({ where: { id: { in: itemIds } } });
    if (items.length !== itemIds.length) {
      return NextResponse.json({ error: "One or more costume items not found" }, { status: 404 });
    }
    const notAvailable = items.find((item) => item.status !== "AVAILABLE");
    if (notAvailable) {
      return NextResponse.json(
        { error: `Item ${notAvailable.tagNumber} is not available (status: ${notAvailable.status})` },
        { status: 409 },
      );
    }

    const now = new Date();
    const dueAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    const rentals = await db.$transaction(async (tx) => {
      const created = [];
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const rentalAmount = Math.round(
          Number(item.rentalRate) * (1 + Number(item.gstRate) / 100) * 100,
        ) / 100;
        const rental = await tx.costumeRental.create({
          data: {
            costumeItemId: item.id,
            bookingId: body.bookingId,
            posSessionId: body.posSessionId,
            guestName: body.guestName,
            guestMobile: body.guestMobile,
            rentedById: user.id,
            rentedAt: now,
            dueAt,
            rentalAmount,
            depositAmount: index === 0 ? body.depositAmount : 0,
            depositPaid: index === 0 ? body.depositAmount > 0 : false,
            paymentMethod: body.paymentMethod,
            notes: body.notes,
          },
        });
        created.push(rental);
      }
      await tx.costumeItem.updateMany({
        where: { id: { in: itemIds } },
        data: { status: "RENTED" },
      });
      return created;
    });

    await logAudit({
      userId: user.id,
      action: "COSTUME_RENTED",
      entity: "CostumeRental",
      entityId: rentals[0]?.id ?? "",
      newValue: { itemIds, quantity: itemIds.length, guestName: body.guestName },
    });

    return NextResponse.json(
      {
        ok: true,
        quantity: rentals.length,
        rentalIds: rentals.map((r) => r.id),
        firstRentalId: rentals[0]?.id ?? null,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 422 });
    return NextResponse.json({ error: "Failed to create rental" }, { status: 500 });
  }
}
