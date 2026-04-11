import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = getRole(session);
  if (role !== "ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const [totalLeads, bookedLeads, lostLeads, stageCounts, dueNow, overdueDay] = await Promise.all([
    db.lead.count({ where: { isDeleted: false } }),
    db.lead.count({ where: { isDeleted: false, stage: "BOOKED" as any } }),
    db.lead.count({ where: { isDeleted: false, stage: "LOST" as any } }),
    db.lead.groupBy({ by: ["stage"], where: { isDeleted: false }, _count: { _all: true } }),
    db.lead.count({
      where: {
        isDeleted: false,
        stage: { notIn: ["BOOKED", "LOST"] as any },
        followUpAt: { lte: new Date() },
      },
    }),
    db.lead.count({
      where: {
        isDeleted: false,
        stage: { notIn: ["BOOKED", "LOST"] as any },
        followUpAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const conversionRate = totalLeads > 0 ? Number(((bookedLeads / totalLeads) * 100).toFixed(1)) : 0;
  const lossRate = totalLeads > 0 ? Number(((lostLeads / totalLeads) * 100).toFixed(1)) : 0;

  return NextResponse.json({
    summary: {
      totalLeads,
      bookedLeads,
      lostLeads,
      conversionRate,
      lossRate,
      followUpDueNow: dueNow,
      overdueMoreThanOneDay: overdueDay,
    },
    stageBreakdown: stageCounts.map((row: any) => ({ stage: row.stage, count: row._count._all })),
  });
}
