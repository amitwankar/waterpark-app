import { Skeleton } from "@/components/ui/Skeleton";

export interface KpiItem {
  label: string;
  value: string | number;
  sub?: string;
}

interface Props {
  items: KpiItem[];
  loading?: boolean;
}

export function ReportKpiRow({ items, loading }: Props) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-2"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-${Math.min(items.length, 4)}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <p className="text-sm text-[var(--color-muted)]">{item.label}</p>
          <p className="mt-1 text-2xl font-bold text-[var(--color-text)]">{item.value}</p>
          {item.sub && <p className="text-xs text-[var(--color-muted)]">{item.sub}</p>}
        </div>
      ))}
    </div>
  );
}
