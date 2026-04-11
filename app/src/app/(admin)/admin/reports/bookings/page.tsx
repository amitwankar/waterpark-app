"use client";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportChart } from "@/components/reports/ReportChart";
import { ReportTable } from "@/components/reports/ReportTable";
import { formatCurrency } from "@/lib/utils";

interface BookingRow {
  bookingNumber: string; guestName: string; guestMobile: string;
  visitDate: string; adults: number; children: number;
  totalAmount: number; status: string; createdAt: string;
}
interface DailyPoint { date: string; total: number; confirmed: number; cancelled: number; revenue: number }
interface BookingsData {
  kpi: { total: number; confirmed: number; checkedIn: number; completed: number; cancelled: number; pending: number; conversionRate: number };
  daily: DailyPoint[];
  rows: BookingRow[];
}

export default function BookingsReportPage(): JSX.Element {
  return (
    <ReportPageLayout<BookingsData>
      title="Bookings Report"
      subtitle="Booking volume, status distribution, and daily trend."
      reportKey="bookings"
      apiPath="/api/v1/analytics/bookings"
      buildKpis={(data) => [
        { label: "Total Bookings", value: data.kpi.total },
        { label: "Confirmed", value: data.kpi.confirmed },
        { label: "Cancelled", value: data.kpi.cancelled },
        { label: "Conversion Rate", value: `${data.kpi.conversionRate}%` },
      ]}
    >
      {(data, loading) => (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportChart
              type="line"
              data={data?.daily ?? []}
              xKey="date"
              lines={[
                { key: "total", label: "Total" },
                { key: "confirmed", label: "Confirmed", color: "#10b981" },
                { key: "cancelled", label: "Cancelled", color: "#ef4444" },
              ]}
              loading={loading}
              title="Daily Bookings Trend"
            />
            <ReportChart
              type="pie"
              data={
                data
                  ? [
                      { name: "Confirmed", value: data.kpi.confirmed },
                      { name: "Pending", value: data.kpi.pending },
                      { name: "Checked In", value: data.kpi.checkedIn },
                      { name: "Completed", value: data.kpi.completed },
                      { name: "Cancelled", value: data.kpi.cancelled },
                    ].filter((d) => d.value > 0)
                  : []
              }
              nameKey="name"
              valueKey="value"
              loading={loading}
              title="Status Distribution"
            />
          </div>
          <ReportTable<BookingRow>
            data={data?.rows ?? []}
            rowKey={(row) => String(row.bookingNumber)}
            loading={loading}
            columns={[
              { key: "bookingNumber", header: "Booking #" },
              { key: "guestName", header: "Guest" },
              { key: "guestMobile", header: "Mobile" },
              { key: "visitDate", header: "Visit Date" },
              { key: "adults", header: "Adults" },
              { key: "children", header: "Children" },
              { key: "totalAmount", header: "Amount", render: (row) => formatCurrency(Number(row.totalAmount)) },
              { key: "status", header: "Status" },
            ]}
          />
        </div>
      )}
    </ReportPageLayout>
  );
}
