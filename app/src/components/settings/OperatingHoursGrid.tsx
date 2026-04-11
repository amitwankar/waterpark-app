"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface OperatingDayRow {
  day: number;
  label: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface OperatingHoursGridProps {
  value: OperatingDayRow[];
  onSaved: (next: Record<string, unknown>) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function OperatingHoursGrid({ value, onSaved, onDirtyChange }: OperatingHoursGridProps): JSX.Element {
  const [rows, setRows] = useState<OperatingDayRow[]>(value);
  const [isPending, startTransition] = useTransition();

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(value), [rows, value]);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function update(index: number, patch: Partial<OperatingDayRow>): void {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  function applyToAll(fromIndex: number): void {
    const source = rows[fromIndex];
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        isOpen: source.isOpen,
        openTime: source.openTime,
        closeTime: source.closeTime,
      })),
    );
  }

  return (
    <section id="operating-hours">
      <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Operating Hours</h2>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/40">
              <tr>
                <th className="px-3 py-2 text-left">Day</th>
                <th className="px-3 py-2 text-left">Open</th>
                <th className="px-3 py-2 text-left">Open Time</th>
                <th className="px-3 py-2 text-left">Close Time</th>
                <th className="px-3 py-2 text-left">Quick</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {rows.map((row, index) => (
                <tr key={row.day}>
                  <td className="px-3 py-2 font-medium text-[var(--color-text)]">{row.label}</td>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={row.isOpen} onChange={(event) => update(index, { isOpen: event.target.checked })} />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      disabled={!row.isOpen}
                      value={row.openTime}
                      onChange={(event) => update(index, { openTime: event.target.value })}
                      className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      disabled={!row.isOpen}
                      value={row.closeTime}
                      onChange={(event) => update(index, { closeTime: event.target.value })}
                      className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="ghost" onClick={() => applyToAll(index)}>
                      Apply to all
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button
          loading={isPending}
          onClick={() => {
            startTransition(() => {
              void fetch("/api/v1/settings/operating-hours", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ operatingHours: rows }),
              })
                .then((res) => res.json())
                .then((next) => onSaved(next));
            });
          }}
        >
          Save Operating Hours
        </Button>
      </CardBody>
      </Card>
    </section>
  );
}
