import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { buildDateRange } from "@/lib/reports";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { dateFrom, dateTo } = buildDateRange(
    searchParams.get("dateFrom"),
    searchParams.get("dateTo")
  );

  const leads = await db.lead.findMany({
    where: {
      isDeleted: false,
      createdAt: { gte: dateFrom, lte: dateTo },
    },
    select: {
      id: true,
      stage: true,
      source: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const total = leads.length;
  const converted = leads.filter((l) => l.stage === "BOOKED").length;
  const lost = leads.filter((l) => l.stage === "LOST").length;
  const conversionRate = total > 0 ? Math.round((converted / total) * 1000) / 10 : 0;

  // Avg days to convert (BOOKED leads only)
  const bookedLeads = leads.filter((l) => l.stage === "BOOKED");
  const avgDaysToConvert =
    bookedLeads.length > 0
      ? Math.round(
          bookedLeads.reduce(
            (s, l) =>
              s + (l.updatedAt.getTime() - l.createdAt.getTime()) / 86_400_000,
            0
          ) / bookedLeads.length
        )
      : 0;

  // Stage funnel
  const stageOrder = ["NEW", "CONTACTED", "INTERESTED", "PROPOSAL_SENT", "BOOKED", "LOST"];
  const stageFunnel = stageOrder.map((stage) => ({
    stage,
    count: leads.filter((l) => l.stage === stage).length,
  }));

  // Source breakdown
  const sourceMap = new Map<string, number>();
  for (const lead of leads) {
    sourceMap.set(lead.source, (sourceMap.get(lead.source) ?? 0) + 1);
  }
  const bySource = Array.from(sourceMap.entries()).map(([source, count]) => ({
    source,
    count,
  }));

  return NextResponse.json({
    kpi: { total, converted, lost, conversionRate, avgDaysToConvert },
    stageFunnel,
    bySource,
  });
}
