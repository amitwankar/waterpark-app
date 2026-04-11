"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
}

interface Props<T = Record<string, unknown>> {
  data: T[];
  columns: TableColumn<T>[];
  rowKey?: (row: T, index: number) => string;
  loading?: boolean;
  pageSize?: number;
  title?: string;
}

export function ReportTable<T = Record<string, unknown>>({
  data,
  columns,
  rowKey,
  loading,
  pageSize = 50,
  title,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = (a as Record<string, unknown>)[sortKey];
    const bv = (b as Record<string, unknown>)[sortKey];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-3">
      {title ? <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3> : null}
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={
                    col.align === "right"
                      ? "px-4 py-3 text-right font-medium text-[var(--color-muted)] whitespace-nowrap"
                      : col.align === "center"
                        ? "px-4 py-3 text-center font-medium text-[var(--color-muted)] whitespace-nowrap"
                        : "px-4 py-3 text-left font-medium text-[var(--color-muted)] whitespace-nowrap"
                  }
                >
                  {col.sortable !== false ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-1 hover:text-[var(--color-text)]"
                    >
                      {col.header}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ChevronUp className="h-3.5 w-3.5 opacity-30" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] bg-white">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-[var(--color-muted)]">
                  No data found.
                </td>
              </tr>
            ) : (
              paged.map((row, rowIndex) => (
                <tr
                  key={
                    rowKey
                      ? rowKey(row, rowIndex)
                      : String((row as { id?: string | number }).id ?? `row-${rowIndex}`)
                  }
                  className="hover:bg-[var(--color-surface)]"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={
                        col.align === "right"
                          ? "px-4 py-3 text-right text-[var(--color-text)]"
                          : col.align === "center"
                            ? "px-4 py-3 text-center text-[var(--color-text)]"
                            : "px-4 py-3 text-[var(--color-text)]"
                      }
                    >
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-[var(--color-muted)]">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
