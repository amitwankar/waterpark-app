"use client";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportChart } from "@/components/reports/ReportChart";
import { ReportTable } from "@/components/reports/ReportTable";
import { formatCurrency } from "@/lib/utils";

interface PaymentsData {
  kpi: { total: number; GATEWAY: number; MANUAL_UPI: number; CASH: number; COMPLIMENTARY: number; pendingVerify: number; refunded: number };
  daily: Array<{ date: string; total: number; gateway: number; upi: number; cash: number }>;
  transactionCount: number;
}

export default function PaymentsReportPage(): JSX.Element {
  return (
    <ReportPageLayout<PaymentsData>
      title="Payments Report"
      subtitle="Transaction breakdown by method, pending verification, and refunds."
      reportKey="payments"
      apiPath="/api/v1/analytics/payments"
      buildKpis={(data) => [
        { label: "Total Collected", value: formatCurrency(data.kpi.total) },
        { label: "Gateway (Online)", value: formatCurrency(data.kpi.GATEWAY) },
        { label: "UPI + Cash", value: formatCurrency(data.kpi.MANUAL_UPI + data.kpi.CASH) },
        { label: "Pending Verify", value: data.kpi.pendingVerify, sub: "Manual UPI unverified" },
      ]}
    >
      {(data, loading) => (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportChart
              type="bar"
              horizontal
              data={
                data
                  ? [
                      { method: "Gateway", amount: data.kpi.GATEWAY },
                      { method: "Manual UPI", amount: data.kpi.MANUAL_UPI },
                      { method: "Cash", amount: data.kpi.CASH },
                      { method: "Complimentary", amount: data.kpi.COMPLIMENTARY },
                    ]
                  : []
              }
              xKey="method"
              bars={[{ key: "amount", label: "Amount (₹)" }]}
              formatY={(v) => formatCurrency(v)}
              loading={loading}
              title="Revenue by Payment Method"
            />
            <ReportChart
              type="bar"
              data={data?.daily ?? []}
              xKey="date"
              bars={[
                { key: "gateway", label: "Gateway", stacked: true },
                { key: "upi", label: "UPI", color: "#f59e0b", stacked: true },
                { key: "cash", label: "Cash", color: "#10b981", stacked: true },
              ]}
              formatY={(v) => formatCurrency(v)}
              loading={loading}
              title="Daily Payment Trend"
            />
          </div>
          <ReportTable
            data={data?.daily ?? []}
            rowKey={(row) => String(row.date)}
            loading={loading}
            columns={[
              { key: "date", header: "Date" },
              { key: "total", header: "Total", render: (row) => formatCurrency(Number(row.total)) },
              { key: "gateway", header: "Gateway", render: (row) => formatCurrency(Number(row.gateway)) },
              { key: "upi", header: "UPI", render: (row) => formatCurrency(Number(row.upi)) },
              { key: "cash", header: "Cash", render: (row) => formatCurrency(Number(row.cash)) },
            ]}
          />
        </div>
      )}
    </ReportPageLayout>
  );
}
