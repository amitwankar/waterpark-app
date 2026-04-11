"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";

export type DatePreset = "today" | "week" | "month" | "custom";

export interface DateRangeFilterProps {
  preset: DatePreset;
  start?: string;
  end?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DateRangeFilter({ preset, start, end }: DateRangeFilterProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = useTransition();
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>(preset);
  const [customStart, setCustomStart] = useState(start ?? todayIso());
  const [customEnd, setCustomEnd] = useState(end ?? todayIso());

  useEffect(() => {
    setSelectedPreset(preset);
    if (start) setCustomStart(start);
    if (end) setCustomEnd(end);
  }, [preset, start, end]);

  const presets = useMemo(
    () => [
      { key: "today", label: "Today" },
      { key: "week", label: "This Week" },
      { key: "month", label: "This Month" },
      { key: "custom", label: "Custom Range" },
    ] as Array<{ key: DatePreset; label: string }>,
    [],
  );

  function updateQuery(nextPreset: DatePreset, nextStart?: string, nextEnd?: string): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set("preset", nextPreset);
    if (nextPreset === "custom") {
      if (nextStart) params.set("start", nextStart);
      if (nextEnd) params.set("end", nextEnd);
    } else {
      params.delete("start");
      params.delete("end");
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
      router.refresh();
    });
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <div className="sticky top-0 z-20 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={selectedPreset === item.key ? "primary" : "outline"}
            onClick={() => {
              setSelectedPreset(item.key);
              updateQuery(item.key, customStart, customEnd);
            }}
          >
            {item.label}
          </Button>
        ))}

        {selectedPreset === "custom" ? (
          <>
            <input
              type="date"
              value={customStart}
              className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 text-xs"
              onChange={(event) => setCustomStart(event.target.value)}
            />
            <input
              type="date"
              value={customEnd}
              className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 text-xs"
              onChange={(event) => setCustomEnd(event.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={() => updateQuery("custom", customStart, customEnd)}>
              Apply
            </Button>
          </>
        ) : null}

        {isPending ? <p className="text-xs text-[var(--color-text-muted)]">Refreshing...</p> : null}
      </div>
    </div>
  );
}
