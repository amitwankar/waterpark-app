"use client";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportChart } from "@/components/reports/ReportChart";

interface MaintenanceData {
  assets?: {
    total?: number;
    dueSoon?: number;
    overdue?: number;
    active?: number;
  };
  workOrders?: {
    total?: number;
    overdueOpen?: number;
    completedToday?: number;
    byPriority?: Array<{ priority: string; count: number }>;
    byStatus?: Array<{ status: string; count: number }>;
  };
}

export default function MaintenanceReportPage(): JSX.Element {
  return (
    <ReportPageLayout<MaintenanceData>
      title="Maintenance Cost Report"
      subtitle="Work order status, asset health, and cost breakdown."
      reportKey="maintenance"
      apiPath="/api/v1/analytics/maintenance"
      buildKpis={(data) => {
        const openCount =
          (Number(data.workOrders?.byStatus?.find((entry) => entry.status === "OPEN")?.count ?? 0)) +
          (Number(data.workOrders?.byStatus?.find((entry) => entry.status === "IN_PROGRESS")?.count ?? 0));
        return [
          { label: "Open Work Orders", value: openCount },
          { label: "Overdue Assets", value: Number(data.assets?.overdue ?? 0) },
          { label: "Due Soon Assets", value: Number(data.assets?.dueSoon ?? 0) },
          { label: "Completed Today", value: Number(data.workOrders?.completedToday ?? 0) },
        ];
      }}
    >
      {(data, loading) => (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportChart
              type="bar"
              horizontal
              data={[
                { label: "Total Assets", count: Number(data?.assets?.total ?? 0) },
                { label: "Active Assets", count: Number(data?.assets?.active ?? 0) },
                { label: "Due Soon", count: Number(data?.assets?.dueSoon ?? 0) },
                { label: "Overdue", count: Number(data?.assets?.overdue ?? 0) },
              ]}
              xKey="label"
              bars={[{ key: "count", label: "Assets" }]}
              loading={loading}
              title="Asset Health Overview"
            />
            <ReportChart
              type="pie"
              data={data?.workOrders?.byPriority ?? []}
              nameKey="priority"
              valueKey="count"
              loading={loading}
              title="Work Orders by Priority"
            />
          </div>
        </div>
      )}
    </ReportPageLayout>
  );
}
