import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  totalPages: number;
  perPage: number;
  perPageOptions?: number[];
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  perPage,
  perPageOptions = [10, 20, 50],
  onPageChange,
  onPerPageChange,
  className,
}: PaginationProps): JSX.Element {
  const current = Math.min(Math.max(1, page), Math.max(1, totalPages));
  const start = Math.max(1, current - 2);
  const end = Math.min(totalPages, start + 4);
  const pages = Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);

  return (
    <div className={cn("flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(current - 1)} disabled={current <= 1}>
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <div className="flex items-center gap-1">
          {pages.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onPageChange(value)}
              className={cn(
                "h-8 min-w-8 rounded-[var(--radius-sm)] px-2 text-sm font-medium transition duration-150",
                value === current
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-muted)] hover:bg-zinc-100 hover:text-[var(--color-text)] dark:hover:bg-zinc-800",
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => onPageChange(current + 1)} disabled={current >= totalPages}>
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <span>Rows per page</span>
        <select
          value={perPage}
          onChange={(event) => onPerPageChange?.(Number(event.target.value))}
          className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 outline-none"
        >
          {perPageOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}