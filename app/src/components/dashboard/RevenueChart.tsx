"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface RevenuePoint {
  label: string;
  total: number;
  gateway: number;
  upiCash: number;
}

export interface RevenueChartProps {
  data: RevenuePoint[];
}

export function RevenueChart({ data }: RevenueChartProps): JSX.Element {
  const points = useMemo(() => data, [data]);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Revenue Trend</h3>
      </CardHeader>
      <CardBody className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 12 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="total" name="Total" stroke="#0f766e" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="gateway" name="Gateway" stroke="#2563eb" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="upiCash" name="UPI+Cash" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}
