"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface BookingStatusDatum {
  status: string;
  count: number;
}

export interface BookingStatusDonutProps {
  data: BookingStatusDatum[];
}

const COLORS: Record<string, string> = {
  CONFIRMED: "#22c55e",
  PENDING: "#f59e0b",
  PARTIALLY_PAID: "#f97316",
  CHECKED_IN: "#0f766e",
  CANCELLED: "#ef4444",
  COMPLETED: "#2563eb",
};

export function BookingStatusDonut({ data }: BookingStatusDonutProps): JSX.Element {
  const total = data.reduce((acc, item) => acc + item.count, 0);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Booking Status</h3>
      </CardHeader>
      <CardBody className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              cx="40%"
              cy="50%"
              innerRadius={65}
              outerRadius={100}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.status} fill={COLORS[entry.status] ?? "#64748b"} />
              ))}
            </Pie>
            <Tooltip />
            <Legend layout="vertical" verticalAlign="middle" align="right" />
            <text x="40%" y="48%" textAnchor="middle" className="fill-[var(--color-text)] text-sm font-semibold">
              {total}
            </text>
            <text x="40%" y="56%" textAnchor="middle" className="fill-[var(--color-text-muted)] text-xs">
              Bookings
            </text>
          </PieChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}
