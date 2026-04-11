"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface FootfallPoint {
  label: string;
  adults: number;
  children: number;
  total: number;
}

export interface FootfallChartProps {
  data: FootfallPoint[];
}

export function FootfallChart({ data }: FootfallChartProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Footfall Mix</h3>
      </CardHeader>
      <CardBody className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 12 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="adults" stackId="a" fill="#0f766e" name="Adults" radius={[6, 6, 0, 0]} />
            <Bar dataKey="children" stackId="a" fill="#f59e0b" name="Children" radius={[6, 6, 0, 0]} />
            <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} name="Total" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}
