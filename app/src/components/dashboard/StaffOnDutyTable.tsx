import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface StaffDutyRow {
  id: string;
  name: string;
  role: string;
  shift: string;
  clockIn: string | null;
  status: "Present" | "Absent" | "Not Started";
}

export interface StaffOnDutyTableProps {
  rows: StaffDutyRow[];
}

function statusVariant(status: StaffDutyRow["status"]): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "Present") return "success";
  if (status === "Absent") return "danger";
  return "warning";
}

export function StaffOnDutyTable({ rows }: StaffOnDutyTableProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--color-text)]">Staff On Duty Today</h3>
          <Link href="/admin/staff" className="text-xs text-[var(--color-primary)] underline">
            View all
          </Link>
        </div>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
              <th className="py-2 pr-2">Name</th>
              <th className="py-2 pr-2">Role</th>
              <th className="py-2 pr-2">Shift</th>
              <th className="py-2 pr-2">Clock-in</th>
              <th className="py-2 pr-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--color-border)] last:border-b-0">
                <td className="py-2 pr-2 text-[var(--color-text)]">{row.name}</td>
                <td className="py-2 pr-2">{row.role}</td>
                <td className="py-2 pr-2">{row.shift}</td>
                <td className="py-2 pr-2">{row.clockIn ?? "-"}</td>
                <td className="py-2 pr-2"><Badge variant={statusVariant(row.status)}>{row.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
