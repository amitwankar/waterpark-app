import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { withRequestContext } from "@/lib/logger";
import { requireSubRole } from "@/lib/session";

type PosPreload = {
  packageLines?: Array<{ packageId: string; quantity: number }>;
  foodLines?: Array<{ foodItemId: string; foodVariantId?: string; quantity: number }>;
  lockerLines?: Array<{ lockerId: string; quantity: number }>;
  costumeLines?: Array<{ costumeItemId: string; quantity: number }>;
  rideLines?: Array<{ rideId: string; quantity: number }>;
  customDiscountType?: "NONE" | "PERCENTAGE" | "AMOUNT";
  customDiscountValue?: number;
  customDiscountAmount?: number;
};

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { error } = await requireSubRole("TICKET_COUNTER", "SALES_EXECUTIVE");
  if (error) return error;

  const requestLogger = withRequestContext({
    requestId,
    method: req.method,
    path: req.nextUrl.pathname,
  });

  const searchParams = new URL(req.url).searchParams;
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    requestLogger.warn({ queryLength: q?.length ?? 0 }, "POS queue lookup query too short");
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  requestLogger.info({ query: q.slice(0, 16) }, "POS queue lookup started");

  const todayIst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todayDate = new Date(`${todayIst}T00:00:00.000Z`);

  const rows = await db.queueRequest.findMany({
    where: {
      visitDate: todayDate,
      status: "PENDING",
      OR: [
        { id: q },
        { queueCode: { contains: q, mode: "insensitive" } },
        { guestMobile: { contains: q } },
        { guestName: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 10,
    orderBy: { createdAt: "asc" },
  });

  const results = rows.map((row) => {
    const items = row.items as unknown as { tickets?: any[]; posPreload?: PosPreload };
    const tickets = Array.isArray(items?.tickets) ? items.tickets : [];
    const posPreload = (items?.posPreload ?? null) as PosPreload | null;
    const total = Number(row.totalAmount);

    return {
      id: row.id,
      bookingNumber: row.queueCode,
      sourceType: "QUEUE" as const,
      guestName: row.guestName,
      guestMobile: row.guestMobile ?? "",
      visitDate: row.visitDate.toISOString().slice(0, 10),
      status: row.status,
      totalAmount: total,
      paid: 0,
      balance: total,
      tickets: tickets.map((t) => ({
        ticketTypeId: String(t.ticketTypeId ?? ""),
        name: String(t.name ?? ""),
        quantity: Number(t.quantity ?? 0),
        unitPrice: Number(t.unitPrice ?? 0),
        gstRate: Number(t.gstRate ?? 0),
      })),
      posPreload,
    };
  });

  requestLogger.info({ count: results.length }, "POS queue lookup completed");
  return NextResponse.json(results);
}

