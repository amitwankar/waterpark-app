"use client";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportChart } from "@/components/reports/ReportChart";
import { ReportTable } from "@/components/reports/ReportTable";
import { formatCurrency } from "@/lib/utils";

interface DailyPoint { label: string; total: number; gateway: number; upiCash: number }
interface RevenueData {
  granularity: string;
  series: DailyPoint[];
}

export default function RevenueReportPage(): JSX.Element {
  return (
    <ReportPageLayout<RevenueData>
      title="Revenue Report"
      subtitle="Total revenue breakdown by payment method over the selected period."
      reportKey="revenue"
      apiPath="/api/v1/analytics/revenue"
      buildKpis={(data) => {
        const total = data.series.reduce((s, d) => s + d.total, 0);
        const gateway = data.series.reduce((s, d) => s + d.gateway, 0);
        const upiCash = data.series.reduce((s, d) => s + d.upiCash, 0);
        return [
          { label: "Total Revenue", value: formatCurrency(total) },
          { label: "Gateway (Online)", value: formatCurrency(gateway) },
          { label: "UPI / Cash", value: formatCurrency(upiCash) },
          { label: "Data Points", value: data.series.length },
        ];
      }}
    >
      {(data, loading) => (
        <div className="space-y-6">
          <ReportChart
            type="line"
            data={data?.series ?? []}
            xKey="label"
            lines={[
              { key: "total", label: "Total" },
              { key: "gateway", label: "Gateway" },
              { key: "upiCash", label: "UPI / Cash", color: "#f59e0b" },
            ]}
            formatY={(v) => formatCurrency(v)}
            loading={loading}
            title="Revenue Trend"
          />
          <ReportTable<DailyPoint>
            data={data?.series ?? []}
            rowKey={(row) => String(row.label)}
            loading={loading}
            columns={[
              { key: "label", header: "Period" },
              { key: "total", header: "Total (₹)", render: (row) => formatCurrency(Number(row.total)) },
              { key: "gateway", header: "Gateway (₹)", render: (row) => formatCurrency(Number(row.gateway)) },
              { key: "upiCash", header: "UPI / Cash (₹)", render: (row) => formatCurrency(Number(row.upiCash)) },
            ]}
          />
        </div>
      )}
    </ReportPageLayout>
  );
}
