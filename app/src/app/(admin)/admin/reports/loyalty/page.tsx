"use client";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportChart } from "@/components/reports/ReportChart";
import { ReportTable } from "@/components/reports/ReportTable";

interface LoyaltyData {
  kpi: { issued: number; redeemed: number; expired: number; activeMembers: number };
  tierBreakdown: Array<{ tier: string; count: number }>;
  monthlyTrend: Array<{ month: string; issued: number; redeemed: number }>;
}

export default function LoyaltyReportPage(): JSX.Element {
  return (
    <ReportPageLayout<LoyaltyData>
      title="Guest Loyalty Report"
      subtitle="Points issued, redeemed, expired, and tier distribution."
      reportKey="loyalty"
      apiPath="/api/v1/analytics/loyalty"
      buildKpis={(data) => [
        { label: "Points Issued", value: data.kpi.issued.toLocaleString("en-IN") },
        { label: "Points Redeemed", value: data.kpi.redeemed.toLocaleString("en-IN") },
        { label: "Points Expired", value: data.kpi.expired.toLocaleString("en-IN") },
        { label: "Active Members", value: data.kpi.activeMembers.toLocaleString("en-IN") },
      ]}
    >
      {(data, loading) => (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportChart
              type="bar"
              data={data?.monthlyTrend ?? []}
              xKey="month"
              bars={[
                { key: "issued", label: "Issued", color: "#0f766e" },
                { key: "redeemed", label: "Redeemed", color: "#f59e0b" },
              ]}
              formatX={(v) => {
                const d = new Date(`${v}-01`);
                return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
              }}
              loading={loading}
              title="Monthly Points Issued vs Redeemed"
            />
            <ReportChart
              type="pie"
              data={data?.tierBreakdown ?? []}
              nameKey="tier"
              valueKey="count"
              loading={loading}
              title="Members by Tier"
            />
          </div>
          <ReportTable
            data={data?.tierBreakdown ?? []}
            rowKey={(row) => String(row.tier)}
            loading={loading}
            columns={[
              { key: "tier", header: "Loyalty Tier" },
              { key: "count", header: "Members" },
            ]}
          />
        </div>
      )}
    </ReportPageLayout>
  );
}
