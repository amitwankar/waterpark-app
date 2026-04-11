import Link from "next/link";

import { Card, CardBody } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  title: string;
  value: string;
  trend?: number;
  subLabel?: string;
  href?: string;
  alert?: "none" | "warning" | "danger";
  badge?: React.ReactNode;
}

function trendLabel(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function InnerCard({ title, value, trend, subLabel, alert, badge }: Omit<KpiCardProps, "href">): JSX.Element {
  return (
    <Card className={cn(alert === "warning" && "border-amber-300", alert === "danger" && "border-red-300")}>
      <CardBody className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-[var(--color-text-muted)]">{title}</p>
          {badge}
        </div>
        <p className="text-2xl font-semibold text-[var(--color-text)]">{value}</p>
        <div className="flex items-center justify-between gap-2 text-xs">
          {typeof trend === "number" ? (
            <span className={cn(trend >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
              {trendLabel(trend)}
            </span>
          ) : (
            <span className="text-transparent">.</span>
          )}
          {subLabel ? <span className="text-[var(--color-text-muted)]">{subLabel}</span> : null}
        </div>
      </CardBody>
    </Card>
  );
}

export function KpiCard(props: KpiCardProps): JSX.Element {
  if (props.href) {
    return (
      <Link href={props.href} className="block transition-opacity hover:opacity-95">
        <InnerCard {...props} />
      </Link>
    );
  }

  return <InnerCard {...props} />;
}
