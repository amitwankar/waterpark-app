"use client";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportChart } from "@/components/reports/ReportChart";
import { ReportTable } from "@/components/reports/ReportTable";

interface Day { label: string; adults: number; children: number; total: number }
interface FootfallData { granularity: string; series: Day[] }

export default function FootfallReportPage(): JSX.Element {
  return (
    <ReportPageLayout<FootfallData>
      title="Footfall Report"
      subtitle="Total visitor attendance — adults and children — over the selected period."
      reportKey="footfall"
      apiPath="/api/v1/analytics/footfall"
      buildKpis={(data) => {
        const totalAdults = data.series.reduce((s, d) => s + d.adults, 0);
        const totalChildren = data.series.reduce((s, d) => s + d.children, 0);
        const totalVisitors = totalAdults + totalChildren;
        const peak = data.series.reduce((max, d) => (d.total > max.total ? d : max), data.series[0] ?? { label: "—", total: 0 });
        return [
          { label: "Total Visitors", value: totalVisitors.toLocaleString("en-IN") },
          { label: "Adults", value: totalAdults.toLocaleString("en-IN") },
          { label: "Children", value: totalChildren.toLocaleString("en-IN") },
          { label: "Peak Day", value: peak.label, sub: `${peak.total} visitors` },
        ];
      }}
    >
      {(data, loading) => (
        <div className="space-y-6">
          <ReportChart
            type="bar"
            data={data?.series ?? []}
            xKey="label"
            bars={[
              { key: "adults", label: "Adults", stacked: true },
              { key: "children", label: "Children", color: "#f59e0b", stacked: true },
            ]}
            loading={loading}
            title="Visitor Trend (Stacked)"
          />
          <ReportTable<Day>
            data={data?.series ?? []}
            rowKey={(row) => String(row.label)}
            loading={loading}
            columns={[
              { key: "label", header: "Period" },
              { key: "adults", header: "Adults" },
              { key: "children", header: "Children" },
              { key: "total", header: "Total" },
            ]}
          />
        </div>
      )}
    </ReportPageLayout>
  );
}
