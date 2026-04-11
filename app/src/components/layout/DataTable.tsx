import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

export interface DataTableColumn<TData> {
  key: string;
  header: React.ReactNode;
  render: (row: TData) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<TData> {
  data: TData[];
  columns: Array<DataTableColumn<TData>>;
  loading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  className?: string;
  rowKey?: (row: TData, index: number) => string;
}

export function DataTable<TData>({
  data,
  columns,
  loading,
  emptyTitle = "No data found",
  emptyMessage = "Try adjusting your filters or create a new record.",
  className,
  rowKey,
}: DataTableProps<TData>): JSX.Element {
  const getRowKey = (row: TData, index: number): string => {
    if (rowKey) {
      return rowKey(row, index);
    }
    const maybeId = (row as { id?: string | number } | null)?.id;
    if (maybeId !== undefined && maybeId !== null) {
      return String(maybeId);
    }
    return `row-${index}`;
  };

  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState icon={SearchX} title={emptyTitle} message={emptyMessage} className={className} />;
  }

  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]", className)}>
      <table className="min-w-full divide-y divide-[var(--color-border)] bg-[var(--color-surface)] text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-900/40">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn("px-4 py-3 text-left font-semibold text-[var(--color-text)]", column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {data.map((row, rowIndex) => (
            <tr key={getRowKey(row, rowIndex)} className="transition-colors duration-150 hover:bg-zinc-50 dark:hover:bg-zinc-900/35">
              {columns.map((column) => (
                <td key={`${column.key}-${rowIndex}`} className={cn("px-4 py-3 text-[var(--color-text-muted)]", column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
