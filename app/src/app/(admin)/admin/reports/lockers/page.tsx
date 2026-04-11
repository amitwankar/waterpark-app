"use client";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportChart } from "@/components/reports/ReportChart";
import { ReportTable } from "@/components/reports/ReportTable";
import { formatCurrency } from "@/lib/utils";

interface LockerRow {
  date: string; lockerZone: string; lockerSize: string; guestName: string;
  guestMobile: string; durationType: string; assignedAt: string; returnedAt: string | null; amount: number;
}
interface LockerData {
  kpi: { totalRevenue: number; totalAssignments: number; avgDurationHours: number; bySize: { SMALL: number; MEDIUM: number; LARGE: number } };
  daily: Array<{ date: string; assignments: number; revenue: number; SMALL: number; MEDIUM: number; LARGE: number }>;
  rows: LockerRow[];
}

export default function LockersReportPage(): JSX.Element {
  return (
    <ReportPageLayout<LockerData>
      title="Locker Report"
      subtitle="Assignments, revenue, and duration breakdown by locker size."
      reportKey="lockers"
      apiPath="/api/v1/analytics/lockers"
      buildKpis={(data) => [
        { label: "Total Revenue", value: formatCurrency(data.kpi.totalRevenue) },
        { label: "Assignments", value: data.kpi.totalAssignments },
        { label: "Avg Duration", value: `${data.kpi.avgDurationHours}h` },
        { label: "By Size", value: `S:${data.kpi.bySize.SMALL} M:${data.kpi.bySize.MEDIUM} L:${data.kpi.bySize.LARGE}` },
      ]}
    >
      {(data, loading) => (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportChart
              type="bar"
              data={data?.daily ?? []}
              xKey="date"
              bars={[
                { key: "SMALL", label: "Small", stacked: true },
                { key: "MEDIUM", label: "Medium", color: "#f59e0b", stacked: true },
                { key: "LARGE", label: "Large", color: "#3b82f6", stacked: true },
              ]}
              loading={loading}
              title="Daily Assignments by Size"
            />
            <ReportChart
              type="pie"
              data={
                data
                  ? [
                      { name: "Small", value: data.kpi.bySize.SMALL },
                      { name: "Medium", value: data.kpi.bySize.MEDIUM },
                      { name: "Large", value: data.kpi.bySize.LARGE },
                    ]
                  : []
              }
              nameKey="name"
              valueKey="value"
              loading={loading}
              title="Size Distribution"
            />
          </div>
          <ReportTable<LockerRow>
            data={data?.rows ?? []}
            rowKey={(row) => String(row.assignedAt)}
            loading={loading}
            columns={[
              { key: "date", header: "Date" },
              { key: "lockerZone", header: "Zone" },
              { key: "lockerSize", header: "Size" },
              { key: "guestName", header: "Guest" },
              { key: "guestMobile", header: "Mobile" },
              { key: "durationType", header: "Duration Type" },
              { key: "amount", header: "Amount", render: (row) => formatCurrency(Number(row.amount)) },
              { key: "returnedAt", header: "Status", render: (row) => row.returnedAt ? "Returned" : "Active" },
            ]}
          />
        </div>
      )}
    </ReportPageLayout>
  );
}
