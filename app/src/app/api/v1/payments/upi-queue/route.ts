import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseTransactionMeta } from "@/lib/payment";
import { redis } from "@/lib/redis";

const QUEUE_LIST_KEY = "upi:queue";
const QUEUE_ITEM_PREFIX = "upi:queue:item:";

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (getRole(session) !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const ids = await redis.lrange(QUEUE_LIST_KEY, 0, -1);
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const staleIds: string[] = [];
  for (const id of uniqueIds) {
    const alive = await redis.exists(`${QUEUE_ITEM_PREFIX}${id}`);
    if (!alive) {
      staleIds.push(id);
    }
  }
  for (const stale of staleIds) {
    await redis.lrem(QUEUE_LIST_KEY, 0, stale);
  }

  const effectiveIds = uniqueIds.filter((id) => !staleIds.includes(id));
  if (effectiveIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const transactions = await db.transaction.findMany({
    where: {
      id: { in: effectiveIds },
      method: "MANUAL_UPI",
      status: "PENDING",
    },
    include: {
      booking: {
        select: {
          id: true,
          bookingNumber: true,
          guestName: true,
          guestMobile: true,
          visitDate: true,
          totalAmount: true,
          notes: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    items: transactions.map((item: any) => {
      const meta = parseTransactionMeta(item.notes);
      const bookingMetaLine = (item.booking.notes ?? "")
        .split("\n")
        .find((line: string) => line.startsWith("PAYMENT_META:"));

      let bookingBalanceDue: number | null = null;
      if (bookingMetaLine) {
        try {
          const bookingMeta = JSON.parse(bookingMetaLine.slice("PAYMENT_META:".length)) as {
            balanceDue?: number;
          };
          bookingBalanceDue = typeof bookingMeta.balanceDue === "number" ? bookingMeta.balanceDue : null;
        } catch {
          bookingBalanceDue = null;
        }
      }

      return {
        id: item.id,
        bookingId: item.bookingId,
        bookingNumber: item.booking.bookingNumber,
        guestName: item.booking.guestName,
        guestMobile: item.booking.guestMobile,
        amount: Number(item.amount),
        visitDate: item.booking.visitDate,
        submittedAt: item.createdAt,
        screenshot: item.upiScreenshot,
        notes: item.notes,
        paymentType: meta?.paymentType === "BALANCE" ? "SPLIT" : (meta?.paymentType ?? "FULL"),
        splitPortion: meta?.splitPortion ?? Number(item.amount),
        splitIndex: meta?.splitIndex ?? null,
        splitGroup: meta?.splitGroup ?? null,
        bookingBalanceDue,
      };
    }),
  });
}

