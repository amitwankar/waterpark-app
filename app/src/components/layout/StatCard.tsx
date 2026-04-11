import { TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardBody } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  trend?: {
    value: string;
    direction: "up" | "down";
  };
  className?: string;
}

export function StatCard({ icon: Icon, label, value, trend, className }: StatCardProps): JSX.Element {
  return (
    <Card className={cn("h-full", className)}>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--color-text-muted)]">{label}</p>
          <span className="rounded-[var(--radius-md)] bg-[var(--color-primary-light)] p-2 text-[var(--color-primary)]">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="text-2xl font-semibold text-[var(--color-text)]">{value}</p>
        {trend ? (
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
              trend.direction === "up"
                ? "bg-green-100 text-green-700 dark:bg-green-900/35 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/35 dark:text-red-300",
            )}
          >
            {trend.direction === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {trend.value}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}