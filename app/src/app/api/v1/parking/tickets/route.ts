import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireSubRole } from "@/lib/session";

const createSchema = z.object({
  vehicleNumber: z.string().min(3).max(30),
  vehicleType: z.enum(["TWO_WHEELER", "FOUR_WHEELER", "BUS", "OTHER"]),
  quantity: z.number().int().min(1).max(20).default(1),
  notes: z.string().max(300).optional(),
  posSessionId: z.string().optional(),
});

function dateCode(): string {
  const now = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return now.replaceAll("-", "");
}

function randomCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

async function generateTicketNumber(): Promise<string> {
  const prefix = `PRK-${dateCode()}`;
  for (let i = 0; i < 12; i += 1) {
    const candidate = `${prefix}-${randomCode()}`;
    const existing = await db.parkingTicket.findUnique({ where: { ticketNumber: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { error } = await requireSubRole("PARKING_ATTENDANT", "SECURITY_STAFF", "TICKET_COUNTER");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const rows = await db.parkingTicket.findMany({
    where: {
      ...(status ? { status: status as "ACTIVE" | "EXITED" | "CANCELLED" } : {}),
    },
    orderBy: { entryAt: "desc" },
    take: 200,
    include: {
      rate: true,
      issuedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(rows.map((row) => ({
    ...row,
    baseAmount: Number(row.baseAmount),
    gstAmount: Number(row.gstAmount),
    totalAmount: Number(row.totalAmount),
    rate: {
      ...row.rate,
      baseRate: Number(row.rate.baseRate),
      gstRate: Number(row.rate.gstRate),
    },
  })));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, error } = await requireSubRole("PARKING_ATTENDANT", "SECURITY_STAFF", "TICKET_COUNTER");
  if (error) return error;

  const payload = await req.json();
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const rate = await db.parkingRate.findFirst({
    where: { vehicleType: parsed.data.vehicleType, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!rate) {
    return NextResponse.json({ error: "No active parking rate configured for selected vehicle type" }, { status: 409 });
  }

  const ticketNumber = await generateTicketNumber();

  const created = await db.parkingTicket.create({
    data: {
      ticketNumber,
      vehicleNumber: parsed.data.vehicleNumber.trim().toUpperCase(),
      vehicleType: parsed.data.vehicleType,
      quantity: parsed.data.quantity,
      notes: parsed.data.notes?.trim() || null,
      issuedById: user!.id,
      posSessionId: parsed.data.posSessionId,
      rateId: rate.id,
      status: "ACTIVE",
    },
    include: {
      rate: true,
      issuedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    ...created,
    baseAmount: Number(created.baseAmount),
    gstAmount: Number(created.gstAmount),
    totalAmount: Number(created.totalAmount),
    rate: {
      ...created.rate,
      baseRate: Number(created.rate.baseRate),
      gstRate: Number(created.rate.gstRate),
    },
  }, { status: 201 });
}
