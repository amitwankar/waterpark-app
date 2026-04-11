import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function parseRange(url: URL): { start: Date; end: Date; granularity: "hourly" | "daily" } {
  const preset = url.searchParams.get("preset") ?? "today";
  const now = new Date();

  let start = startOfDay(now);
  let end = endOfDay(now);
  let granularity: "hourly" | "daily" = "hourly";

  if (preset === "week") {
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day - 1));
    start = startOfDay(monday);
    end = endOfDay(now);
    granularity = "daily";
  }

  if (preset === "month") {
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    end = endOfDay(now);
    granularity = "daily";
  }

  if (preset === "custom") {
    const startRaw = url.searchParams.get("start");
    const endRaw = url.searchParams.get("end");
    if (startRaw && endRaw) {
      const customStart = new Date(startRaw);
      const customEnd = new Date(endRaw);
      if (!Number.isNaN(customStart.getTime()) && !Number.isNaN(customEnd.getTime())) {
        start = startOfDay(customStart);
        end = endOfDay(customEnd);
      }
    }
    const diffDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    granularity = diffDays <= 1 ? "hourly" : "daily";
  }

  return { start, end, granularity };
}

function bucketKey(date: Date, granularity: "hourly" | "daily"): string {
  if (granularity === "hourly") {
    return `${String(date.getHours()).padStart(2, "0")}:00`;
  }
  return date.toISOString().slice(0, 10);
}

function bucketSortValue(label: string, granularity: "hourly" | "daily"): number {
  if (granularity === "hourly") {
    return Number(label.split(":")[0]);
  }
  return new Date(label).getTime();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (getRole(session) !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { start, end, granularity } = parseRange(request.nextUrl);

  const transactions = await db.transaction.findMany({
    where: {
      status: "PAID",
      createdAt: { gte: start, lte: end },
    },
    select: {
      createdAt: true,
      amount: true,
      method: true,
    },
  });

  const buckets = new Map<string, { total: number; gateway: number; upiCash: number }>();

  for (const tx of transactions) {
    const key = bucketKey(tx.createdAt, granularity);
    const current = buckets.get(key) ?? { total: 0, gateway: 0, upiCash: 0 };
    const amount = Number(tx.amount);

    current.total += amount;
    if (tx.method === "GATEWAY") {
      current.gateway += amount;
    }
    if (tx.method === "MANUAL_UPI" || tx.method === "CASH") {
      current.upiCash += amount;
    }

    buckets.set(key, current);
  }

  const series = Array.from(buckets.entries())
    .sort((a, b) => bucketSortValue(a[0], granularity) - bucketSortValue(b[0], granularity))
    .map(([label, values]) => ({
      label,
      total: Number(values.total.toFixed(2)),
      gateway: Number(values.gateway.toFixed(2)),
      upiCash: Number(values.upiCash.toFixed(2)),
    }));

  return NextResponse.json({
    granularity,
    series,
  });
}
