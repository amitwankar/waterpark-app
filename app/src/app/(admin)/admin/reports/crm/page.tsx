"use client";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportChart } from "@/components/reports/ReportChart";
import { ReportTable } from "@/components/reports/ReportTable";

interface CrmData {
  kpi: { total: number; converted: number; lost: number; conversionRate: number; avgDaysToConvert: number };
  stageFunnel: Array<{ stage: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
}

export default function CrmReportPage(): JSX.Element {
  return (
    <ReportPageLayout<CrmData>
      title="CRM / Lead Conversion Report"
      subtitle="Lead pipeline funnel, source breakdown, and conversion metrics."
      reportKey="crm"
      apiPath="/api/v1/analytics/crm"
      buildKpis={(data) => [
        { label: "Total Leads", value: data.kpi.total },
        { label: "Converted", value: data.kpi.converted },
        { label: "Conversion Rate", value: `${data.kpi.conversionRate}%` },
        { label: "Avg Days to Convert", value: data.kpi.avgDaysToConvert },
      ]}
    >
      {(data, loading) => (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportChart
              type="bar"
              horizontal
              data={data?.stageFunnel ?? []}
              xKey="stage"
              bars={[{ key: "count", label: "Leads" }]}
              loading={loading}
              title="Pipeline Funnel"
            />
            <ReportChart
              type="bar"
              horizontal
              data={data?.bySource ?? []}
              xKey="source"
              bars={[{ key: "count", label: "Leads" }]}
              loading={loading}
              title="Leads by Source"
            />
          </div>
          <ReportTable
            data={data?.stageFunnel ?? []}
            rowKey={(row) => String(row.stage)}
            loading={loading}
            columns={[
              { key: "stage", header: "Stage" },
              { key: "count", header: "Leads" },
            ]}
          />
        </div>
      )}
    </ReportPageLayout>
  );
}
