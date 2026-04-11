"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface ConversionMetricsProps {
  conversionRate: number;
  lossRate: number;
  stageBreakdown: Array<{ stage: string; count: number }>;
}

export function ConversionMetrics({ conversionRate, lossRate, stageBreakdown }: ConversionMetricsProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-[var(--color-text)]">Conversion Metrics</h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-600">Conversion: {conversionRate.toFixed(1)}%</span>
            <span className="text-red-600">Loss: {lossRate.toFixed(1)}%</span>
          </div>
        </div>
      </CardHeader>
      <CardBody className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stageBreakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#71717a" }} />
            <YAxis tick={{ fontSize: 11, fill: "#71717a" }} />
            <Tooltip />
            <Bar dataKey="count" fill="#0f766e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}
