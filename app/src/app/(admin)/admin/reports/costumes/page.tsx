"use client";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportChart } from "@/components/reports/ReportChart";
import { ReportTable } from "@/components/reports/ReportTable";
import { formatCurrency } from "@/lib/utils";

interface CostumeData {
  kpi: {
    totalRentals: number;
    totalRevenue: number;
    totalDeposits: number;
    activeRentals: number;
    inventory: Record<string, number>;
  };
  series: Array<{ date: string; count: number; revenue: number; deposits: number }>;
  topItems: Array<{ itemId: string; name: string; category: string; count: number; revenue: number }>;
}

export default function CostumeReportPage(): JSX.Element {
  return (
    <ReportPageLayout<CostumeData>
      title="Costume Rental Report"
      subtitle="Rental volumes, revenue, and top-performing costume items."
      reportKey="costumes"
      apiPath="/api/v1/analytics/costumes"
      buildKpis={(data) => [
        { label: "Total Rentals", value: data.kpi.totalRentals },
        { label: "Rental Revenue", value: formatCurrency(data.kpi.totalRevenue) },
        { label: "Deposits Collected", value: formatCurrency(data.kpi.totalDeposits) },
        {
          label: "Currently Out",
          value: data.kpi.activeRentals,
          sub: `${data.kpi.inventory?.AVAILABLE ?? 0} available`,
        },
      ]}
    >
      {(data, loading) => (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportChart
              type="bar"
              data={data?.series ?? []}
              xKey="date"
              bars={[
                { key: "count", label: "Rentals" },
                { key: "revenue", label: "Revenue (₹)", color: "#a855f7" },
              ]}
              loading={loading}
              title="Daily Rentals & Revenue"
            />
            <ReportChart
              type="bar"
              horizontal
              data={(data?.topItems ?? []).slice(0, 10)}
              xKey="name"
              bars={[{ key: "count", label: "Times Rented", color: "#8b5cf6" }]}
              loading={loading}
              title="Top 10 Costumes by Usage"
            />
          </div>

          {/* Inventory status */}
          {data?.kpi.inventory && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(data.kpi.inventory).map(([status, count]) => (
                <div key={status} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{status.charAt(0) + status.slice(1).toLowerCase()}</p>
                </div>
              ))}
            </div>
          )}

          <ReportTable
            title="Top Costume Items"
            data={data?.topItems ?? []}
            loading={loading}
            columns={[
              { key: "name", header: "Costume" },
              { key: "category", header: "Category" },
              { key: "count", header: "Rentals", align: "right" },
              {
                key: "revenue",
                header: "Revenue",
                align: "right",
                render: (row) => formatCurrency(Number(row.revenue)),
              },
            ]}
          />
        </div>
      )}
    </ReportPageLayout>
  );
}
