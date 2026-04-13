"use client";

import { ReportChart } from "@/components/reports/ReportChart";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportTable } from "@/components/reports/ReportTable";
import { formatCurrency } from "@/lib/utils";

interface ParkingData {
  kpi: {
    dailyVehicleCount: number;
    exitedVehicleCount: number;
    activeVehicleCount: number;
    totalRevenue: number;
  };
  daily: Array<{ date: string; entries: number; exits: number; revenue: number }>;
  vehicleRevenue: Array<{ vehicleType: string; count: number; revenue: number }>;
  paymentSplit: Array<{ method: string; count: number; amount: number }>;
  rows: Array<{
    id: string;
    ticketNumber: string;
    vehicleNumber: string;
    vehicleType: string;
    hours: number | null;
    paymentMethod: string | null;
    totalAmount: number;
    entryAt: string;
    exitAt: string | null;
    issuedBy: string;
  }>;
}

export default function ParkingReportPage(): JSX.Element {
  return (
    <ReportPageLayout<ParkingData>
      title="Parking Report"
      subtitle="Daily vehicle count, revenue by vehicle type, and payment mode split."
      reportKey="parking"
      apiPath="/api/v1/analytics/parking"
      buildKpis={(data) => [
        { label: "Daily Vehicle Count", value: data.kpi.dailyVehicleCount },
        { label: "Exited Vehicles", value: data.kpi.exitedVehicleCount },
        { label: "Active Vehicles", value: data.kpi.activeVehicleCount },
        { label: "Parking Revenue", value: formatCurrency(data.kpi.totalRevenue) },
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
                { key: "entries", label: "Entries", stacked: true },
                { key: "exits", label: "Exits", color: "#3b82f6", stacked: true },
              ]}
              loading={loading}
              title="Daily Vehicle Count"
            />
            <ReportChart
              type="bar"
              horizontal
              data={data?.vehicleRevenue ?? []}
              xKey="vehicleType"
              bars={[{ key: "revenue", label: "Revenue (₹)" }]}
              formatY={(value) => formatCurrency(value)}
              loading={loading}
              title="Revenue by Vehicle Type"
            />
          </div>

          <ReportChart
            type="bar"
            horizontal
            data={data?.paymentSplit ?? []}
            xKey="method"
            bars={[{ key: "amount", label: "Amount (₹)", color: "#f59e0b" }]}
            formatY={(value) => formatCurrency(value)}
            loading={loading}
            title="Payment Mode Split"
          />

          <ReportTable<ParkingData["rows"][number]>
            data={data?.rows ?? []}
            rowKey={(row) => row.id}
            loading={loading}
            columns={[
              { key: "ticketNumber", header: "Ticket" },
              { key: "vehicleNumber", header: "Vehicle" },
              { key: "vehicleType", header: "Type", render: (row) => row.vehicleType.replaceAll("_", " ") },
              { key: "hours", header: "Hours", render: (row) => row.hours ?? "-" },
              { key: "paymentMethod", header: "Payment", render: (row) => row.paymentMethod ?? "-" },
              { key: "totalAmount", header: "Amount", render: (row) => formatCurrency(row.totalAmount) },
              { key: "issuedBy", header: "Issued By" },
              { key: "exitAt", header: "Exit Time", render: (row) => row.exitAt ? new Date(row.exitAt).toLocaleString("en-IN") : "-" },
            ]}
          />
        </div>
      )}
    </ReportPageLayout>
  );
}
