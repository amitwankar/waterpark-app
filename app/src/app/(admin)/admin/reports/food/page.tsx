"use client";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportChart } from "@/components/reports/ReportChart";
import { ReportTable } from "@/components/reports/ReportTable";
import { formatCurrency } from "@/lib/utils";

interface FoodData {
  kpi: { totalRevenue: number; totalOrders: number; avgOrderValue: number; preBookOrders: number; walkInOrders: number };
  byOutlet: Array<{ name: string; revenue: number; orders: number }>;
  topItems: Array<{ name: string; qty: number; revenue: number }>;
  daily: Array<{ date: string; orders: number; revenue: number }>;
}

export default function FoodReportPage(): JSX.Element {
  return (
    <ReportPageLayout<FoodData>
      title="Food & Beverage Report"
      subtitle="Outlet revenue, top-selling items, and daily order volumes."
      reportKey="food"
      apiPath="/api/v1/analytics/food"
      buildKpis={(data) => [
        { label: "Total Revenue", value: formatCurrency(data.kpi.totalRevenue) },
        { label: "Total Orders", value: data.kpi.totalOrders },
        { label: "Avg Order Value", value: formatCurrency(data.kpi.avgOrderValue) },
        { label: "Pre-book Orders", value: data.kpi.preBookOrders, sub: `${data.kpi.walkInOrders} walk-in` },
      ]}
    >
      {(data, loading) => (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportChart
              type="bar"
              horizontal
              data={data?.byOutlet ?? []}
              xKey="name"
              bars={[{ key: "revenue", label: "Revenue (₹)" }]}
              formatY={(v) => formatCurrency(v)}
              loading={loading}
              title="Revenue by Outlet"
            />
            <ReportChart
              type="bar"
              horizontal
              data={(data?.topItems ?? []).slice(0, 10)}
              xKey="name"
              bars={[{ key: "revenue", label: "Revenue (₹)" }]}
              formatY={(v) => formatCurrency(v)}
              loading={loading}
              title="Top 10 Items by Revenue"
            />
          </div>
          <ReportChart
            type="line"
            data={data?.daily ?? []}
            xKey="date"
            lines={[
              { key: "orders", label: "Orders" },
              { key: "revenue", label: "Revenue (₹)", color: "#f59e0b" },
            ]}
            loading={loading}
            title="Daily Orders & Revenue"
          />
          <ReportTable
            data={data?.topItems ?? []}
            rowKey={(row) => String(row.name)}
            loading={loading}
            columns={[
              { key: "name", header: "Item" },
              { key: "qty", header: "Quantity Sold" },
              { key: "revenue", header: "Revenue", render: (row) => formatCurrency(Number(row.revenue)) },
            ]}
          />
        </div>
      )}
    </ReportPageLayout>
  );
}
