import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireSubRole } from "@/lib/session";

const checkoutSchema = z.object({
  hours: z.number().int().min(1).max(48),
  paymentMethod: z.enum(["CASH", "CARD", "MANUAL_UPI", "COMPLIMENTARY"]).default("CASH"),
  notes: z.string().max(300).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { error } = await requireSubRole("PARKING_ATTENDANT", "SECURITY_STAFF", "TICKET_COUNTER");
  if (error) return error;

  const payload = await req.json();
  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const { id } = await params;
  const ticket = await db.parkingTicket.findUnique({
    where: { id },
    include: { rate: true, issuedBy: { select: { id: true, name: true } } },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Parking ticket not found" }, { status: 404 });
  }
  if (ticket.status !== "ACTIVE") {
    return NextResponse.json({ error: "Parking ticket is already closed" }, { status: 409 });
  }

  const quantity = Math.max(1, ticket.quantity);
  const baseAmount = Number(ticket.rate.baseRate) * parsed.data.hours * quantity;
  const gstAmount = baseAmount * (Number(ticket.rate.gstRate) / 100);
  const totalAmount = baseAmount + gstAmount;

  const updated = await db.parkingTicket.update({
    where: { id },
    data: {
      status: "EXITED",
      hours: parsed.data.hours,
      baseAmount,
      gstAmount,
      totalAmount,
      paymentMethod: parsed.data.paymentMethod,
      notes: [ticket.notes, parsed.data.notes].filter(Boolean).join("\n") || null,
      exitAt: new Date(),
    },
    include: {
      rate: true,
      issuedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    ...updated,
    baseAmount: Number(updated.baseAmount),
    gstAmount: Number(updated.gstAmount),
    totalAmount: Number(updated.totalAmount),
    rate: {
      ...updated.rate,
      baseRate: Number(updated.rate.baseRate),
      gstRate: Number(updated.rate.gstRate),
    },
  });
}
