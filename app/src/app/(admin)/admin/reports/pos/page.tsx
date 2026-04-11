"use client";

import { ReportChart } from "@/components/reports/ReportChart";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportTable } from "@/components/reports/ReportTable";
import { formatCurrency } from "@/lib/utils";

interface PosDailyPoint {
  date: string;
  total: number;
  cash: number;
  card: number;
  upi: number;
}

interface PosStaffPoint {
  staffId: string;
  staffName: string;
  collected: number;
  txCount: number;
  cash: number;
  card: number;
  upi: number;
  gateway: number;
  complimentary: number;
}

interface PosTerminalPoint {
  terminalId: string;
  collected: number;
  txCount: number;
}

interface PosReportData {
  kpi: {
    totalPosCollection: number;
    posTransactionCount: number;
    sessionsOpened: number;
    sessionsClosed: number;
    activeSessions: number;
    distinctStaff: number;
    CASH: number;
    CARD: number;
    MANUAL_UPI: number;
    GATEWAY: number;
    COMPLIMENTARY: number;
  };
  daily: PosDailyPoint[];
  staffBreakdown: PosStaffPoint[];
  terminalBreakdown: PosTerminalPoint[];
}

export default function PosReportPage(): JSX.Element {
  return (
    <ReportPageLayout<PosReportData>
      title="POS Report"
      subtitle="Staff-wise POS collection, payment method split, terminal performance, and session activity."
      reportKey="pos"
      apiPath="/api/v1/analytics/pos"
      buildKpis={(data) => [
        { label: "Total POS Collection", value: formatCurrency(data.kpi.totalPosCollection) },
        { label: "POS Transactions", value: data.kpi.posTransactionCount },
        { label: "Sessions Opened", value: data.kpi.sessionsOpened, sub: `Closed: ${data.kpi.sessionsClosed} · Active: ${data.kpi.activeSessions}` },
        { label: "POS Staff Used", value: data.kpi.distinctStaff },
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
                      { method: "Cash", amount: data.kpi.CASH },
                      { method: "Card", amount: data.kpi.CARD },
                      { method: "UPI", amount: data.kpi.MANUAL_UPI },
                      { method: "Gateway", amount: data.kpi.GATEWAY },
                      { method: "Complimentary", amount: data.kpi.COMPLIMENTARY },
                    ]
                  : []
              }
              xKey="method"
              bars={[{ key: "amount", label: "Amount (₹)" }]}
              formatY={(value) => formatCurrency(value)}
              loading={loading}
              title="POS Collection by Payment Method"
            />
            <ReportChart
              type="bar"
              data={data?.daily ?? []}
              xKey="date"
              bars={[
                { key: "cash", label: "Cash", stacked: true },
                { key: "card", label: "Card", color: "#3b82f6", stacked: true },
                { key: "upi", label: "UPI", color: "#f59e0b", stacked: true },
              ]}
              formatY={(value) => formatCurrency(value)}
              loading={loading}
              title="Daily POS Trend"
            />
          </div>

          <ReportTable<PosStaffPoint>
            data={data?.staffBreakdown ?? []}
            rowKey={(row) => row.staffId}
            loading={loading}
            columns={[
              { key: "staffName", header: "Staff" },
              { key: "collected", header: "Collected", render: (row) => formatCurrency(row.collected) },
              { key: "txCount", header: "Transactions" },
              { key: "cash", header: "Cash", render: (row) => formatCurrency(row.cash) },
              { key: "card", header: "Card", render: (row) => formatCurrency(row.card) },
              { key: "upi", header: "UPI", render: (row) => formatCurrency(row.upi) },
            ]}
          />

          <ReportTable<PosTerminalPoint>
            data={data?.terminalBreakdown ?? []}
            rowKey={(row) => row.terminalId}
            loading={loading}
            columns={[
              { key: "terminalId", header: "Terminal" },
              { key: "collected", header: "Collected", render: (row) => formatCurrency(row.collected) },
              { key: "txCount", header: "Transactions" },
            ]}
          />
        </div>
      )}
    </ReportPageLayout>
  );
}

