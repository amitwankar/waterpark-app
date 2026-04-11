"use client";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportChart } from "@/components/reports/ReportChart";
import { ReportTable } from "@/components/reports/ReportTable";

interface RidesData {
  statusCounts?: Array<{ status: string; count: number }>;
  rides?: Array<{ id: string; name: string; zone?: { name?: string | null } | null; queueCount?: number; waitTimeMin?: number; _count?: { rideAccessLogs?: number } }>;
}
type RideSeriesPoint = { label: string; accesses: number };

export default function RidesReportPage(): JSX.Element {
  return (
    <ReportPageLayout<RidesData>
      title="Ride Popularity Report"
      subtitle="Ride access counts over the selected period."
      reportKey="rides"
      apiPath="/api/v1/analytics/rides"
      buildKpis={(data) => {
        const series: RideSeriesPoint[] = (data.rides ?? []).map((ride) => ({
          label: ride.name,
          accesses: Number(ride._count?.rideAccessLogs ?? 0),
        }));
        const total = series.reduce((sum, point) => sum + point.accesses, 0);
        const peak = series.reduce(
          (max, point) => (point.accesses > max.accesses ? point : max),
          series[0] ?? { label: "—", accesses: 0 },
        );
        return [
          { label: "Total Accesses", value: total.toLocaleString("en-IN") },
          { label: "Most Popular", value: peak.label, sub: `${peak.accesses} accesses` },
          { label: "Rides Tracked", value: series.length },
          { label: "Avg per Ride", value: series.length > 0 ? Math.round(total / series.length) : 0 },
        ];
      }}
    >
      {(data, loading) => (
        <div className="space-y-6">
          <ReportChart
            type="bar"
            horizontal
            data={(data?.rides ?? [])
              .map((ride) => ({ label: ride.name, accesses: Number(ride._count?.rideAccessLogs ?? 0) }))
              .sort((a, b) => b.accesses - a.accesses)}
            xKey="label"
            bars={[{ key: "accesses", label: "Accesses" }]}
            loading={loading}
            title="Accesses per Ride"
            height={350}
          />
          <ReportTable<RideSeriesPoint>
            data={(data?.rides ?? [])
              .map((ride) => ({ label: ride.name, accesses: Number(ride._count?.rideAccessLogs ?? 0) }))
              .sort((a, b) => b.accesses - a.accesses)}
            rowKey={(row) => String(row.label)}
            loading={loading}
            columns={[
              { key: "label", header: "Ride" },
              { key: "accesses", header: "Total Accesses" },
            ]}
          />
        </div>
      )}
    </ReportPageLayout>
  );
}
