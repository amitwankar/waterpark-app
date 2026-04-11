"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { Skeleton } from "@/components/ui/Skeleton";
import { shortDateLabel } from "@/lib/reports";

const COLORS = [
  "#0f766e", "#f59e0b", "#3b82f6", "#ef4444",
  "#8b5cf6", "#10b981", "#f97316", "#06b6d4",
];

interface BaseChartProps<T extends object = Record<string, unknown>> {
  data: T[];
  loading?: boolean;
  height?: number;
  title?: string;
}

interface LineChartProps<T extends object = Record<string, unknown>> extends BaseChartProps<T> {
  type: "line";
  xKey: string;
  lines: Array<{ key: string; label: string; color?: string }>;
  formatX?: (v: string) => string;
  formatY?: (v: number) => string;
}

interface BarChartProps<T extends object = Record<string, unknown>> extends BaseChartProps<T> {
  type: "bar";
  xKey: string;
  bars: Array<{ key: string; label: string; color?: string; stacked?: boolean }>;
  horizontal?: boolean;
  formatX?: (v: string) => string;
  formatY?: (v: number) => string;
}

interface PieChartProps<T extends object = Record<string, unknown>> extends BaseChartProps<T> {
  type: "pie";
  nameKey: string;
  valueKey: string;
  formatValue?: (v: number) => string;
}

type Props<T extends object = Record<string, unknown>> =
  | LineChartProps<T>
  | BarChartProps<T>
  | PieChartProps<T>;

function ChartSkeleton({ height }: { height: number }) {
  return <Skeleton className="w-full rounded-[var(--radius-card)]" style={{ height }} />;
}

function ChartWrapper({ title, height, children }: { title?: string; height: number; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      {title && <h3 className="text-sm font-semibold text-[var(--color-text)] mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export function ReportChart<T extends object = Record<string, unknown>>(props: Props<T>) {
  const height = props.height ?? 280;

  if (props.loading || !props.data?.length) {
    return <ChartSkeleton height={height} />;
  }

  if (props.type === "line") {
    const formatX = props.formatX ?? ((v: string) => shortDateLabel(v));
    return (
      <ChartWrapper title={props.title} height={height}>
        <LineChart data={props.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey={props.xKey} tickFormatter={formatX} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={props.formatY} />
          <Tooltip formatter={props.formatY ? (v: unknown) => props.formatY!(v as number) : undefined} />
          <Legend />
          {props.lines.map((line, i) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.label}
              stroke={line.color ?? COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ChartWrapper>
    );
  }

  if (props.type === "bar") {
    const formatX = props.formatX ?? ((v: string) => (props.horizontal ? v : shortDateLabel(v)));
    return (
      <ChartWrapper title={props.title} height={height}>
        {props.horizontal ? (
          <BarChart data={props.data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={props.formatY} />
            <YAxis dataKey={props.xKey} type="category" tick={{ fontSize: 11 }} width={120} tickFormatter={formatX} />
            <Tooltip formatter={props.formatY ? (v: unknown) => props.formatY!(v as number) : undefined} />
            <Legend />
            {props.bars.map((bar, i) => (
              <Bar
                key={bar.key}
                dataKey={bar.key}
                name={bar.label}
                fill={bar.color ?? COLORS[i % COLORS.length]}
                stackId={bar.stacked ? "stack" : undefined}
                radius={[0, 4, 4, 0]}
              />
            ))}
          </BarChart>
        ) : (
          <BarChart data={props.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey={props.xKey} tickFormatter={formatX} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={props.formatY} />
            <Tooltip formatter={props.formatY ? (v: unknown) => props.formatY!(v as number) : undefined} />
            <Legend />
            {props.bars.map((bar, i) => (
              <Bar
                key={bar.key}
                dataKey={bar.key}
                name={bar.label}
                fill={bar.color ?? COLORS[i % COLORS.length]}
                stackId={bar.stacked ? "stack" : undefined}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ChartWrapper>
    );
  }

  if (props.type === "pie") {
    return (
      <ChartWrapper title={props.title} height={height}>
        <PieChart>
          <Pie
            data={props.data}
            dataKey={props.valueKey}
            nameKey={props.nameKey}
            cx="50%"
            cy="50%"
            outerRadius={Math.min(height / 2 - 30, 100)}
            label={({ name, percent }: { name: string; percent: number }) =>
              `${name} ${(percent * 100).toFixed(1)}%`
            }
            labelLine={false}
          >
            {props.data.map((_entry, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={
              props.formatValue
                ? (v: unknown) => props.formatValue!(v as number)
                : undefined
            }
          />
          <Legend />
        </PieChart>
      </ChartWrapper>
    );
  }

  return null;
}
