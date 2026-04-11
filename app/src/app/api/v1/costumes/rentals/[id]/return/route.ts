import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const returnSchema = z.object({
  condition: z.string().max(500).optional(),
  depositRefunded: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireStaff();
  if (error) return error;
  const { id } = await params;

  try {
    const body = returnSchema.parse(await req.json());

    const rental = await db.costumeRental.findUnique({
      where: { id },
      include: { costumeItem: true },
    });
    if (!rental) return NextResponse.json({ error: "Rental not found" }, { status: 404 });
    if (rental.returnedAt)
      return NextResponse.json({ error: "Already returned" }, { status: 409 });

    const now = new Date();

    await db.$transaction([
      db.costumeRental.update({
        where: { id },
        data: {
          returnedAt: now,
          returnedById: user.id,
          condition: body.condition,
          depositRefundedAt: body.depositRefunded ? now : undefined,
          notes: body.notes ?? rental.notes,
        },
      }),
      db.costumeItem.update({
        where: { id: rental.costumeItemId },
        data: { status: "AVAILABLE" },
      }),
    ]);

    await logAudit({
      userId: user.id,
      action: "COSTUME_RETURNED",
      entity: "CostumeRental",
      entityId: id,
      newValue: {
        itemId: rental.costumeItemId,
        condition: body.condition,
        depositRefunded: body.depositRefunded,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 422 });
    return NextResponse.json({ error: "Return failed" }, { status: 500 });
  }
}
