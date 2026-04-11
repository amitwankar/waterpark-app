"use client";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportChart } from "@/components/reports/ReportChart";
import { ReportTable } from "@/components/reports/ReportTable";
import { Badge } from "@/components/ui/Badge";

interface StaffSummary { id: string; name: string; subRole: string | null; present: number; total: number; hours: number }
interface HeatPoint { date: string; present: number; absent: number; total: number }
interface AttendanceData {
  kpi: { totalStaff: number; presentShifts: number; absentShifts: number; avgHoursPerDay: number };
  heatmap: HeatPoint[];
  staffSummary: StaffSummary[];
}

export default function StaffAttendanceReportPage(): JSX.Element {
  return (
    <ReportPageLayout<AttendanceData>
      title="Staff Attendance Report"
      subtitle="Daily attendance heatmap and per-staff summary."
      reportKey="staff-attendance"
      apiPath="/api/v1/analytics/staff-attendance"
      buildKpis={(data) => [
        { label: "Total Active Staff", value: data.kpi.totalStaff },
        { label: "Present Shifts", value: data.kpi.presentShifts },
        { label: "Absent Shifts", value: data.kpi.absentShifts },
        { label: "Avg Hours / Day", value: `${data.kpi.avgHoursPerDay}h` },
      ]}
    >
      {(data, loading) => (
        <div className="space-y-6">
          <ReportChart
            type="bar"
            data={data?.heatmap ?? []}
            xKey="date"
            bars={[
              { key: "present", label: "Present", color: "#10b981", stacked: true },
              { key: "absent", label: "Absent", color: "#ef4444", stacked: true },
            ]}
            loading={loading}
            title="Daily Attendance"
          />
          <ReportTable<StaffSummary>
            data={data?.staffSummary ?? []}
            rowKey={(row) => String(row.id)}
            loading={loading}
            columns={[
              { key: "name", header: "Staff Member" },
              { key: "subRole", header: "Role", render: (row) => row.subRole ?? "—" },
              { key: "present", header: "Present Days" },
              { key: "total", header: "Total Shifts" },
              { key: "attendance", header: "Attendance %", render: (row) => {
                const pct = row.total > 0 ? Math.round((Number(row.present) / Number(row.total)) * 100) : 0;
                return (
                  <Badge variant={pct >= 80 ? "success" : pct >= 60 ? "warning" : "danger"}>
                    {pct}%
                  </Badge>
                );
              }},
              { key: "hours", header: "Total Hours", render: (row) => `${Math.round(Number(row.hours) * 10) / 10}h` },
            ]}
          />
        </div>
      )}
    </ReportPageLayout>
  );
}
