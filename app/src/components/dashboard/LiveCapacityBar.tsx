"use client";

import { useEffect, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

export interface LiveCapacityBarProps {
  initialGuests: number;
  capacity: number;
}

function progressColor(percent: number): string {
  if (percent > 90) return "bg-red-500";
  if (percent > 70) return "bg-amber-500";
  return "bg-[var(--color-success)]";
}

function wrapperColor(percent: number): string {
  if (percent > 90) return "text-red-600";
  if (percent > 70) return "text-amber-600";
  return "text-[var(--color-text)]";
}

export function LiveCapacityBar({ initialGuests, capacity }: LiveCapacityBarProps): JSX.Element {
  const [count, setCount] = useState(initialGuests);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCount(initialGuests);
  }, [initialGuests]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      startTransition(() => {
        void fetch("/api/v1/analytics/overview?preset=today")
          .then((response) => response.json())
          .then((payload: any) => {
            const next = Number(payload?.kpis?.guestsInPark?.value ?? initialGuests);
            if (Number.isFinite(next)) {
              setCount(next);
            }
          })
          .catch(() => undefined);
      });
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [initialGuests]);

  const percent = capacity > 0 ? Math.min(100, (count / capacity) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className={cn("flex items-center justify-between text-xs", wrapperColor(percent))}>
        <span>{count} / {capacity}</span>
        <span>{percent.toFixed(1)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <progress
          className={cn(
            "h-2 w-full appearance-none [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:transition-all [&::-webkit-progress-value]:duration-200 [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:rounded-full",
            progressColor(percent),
          )}
          value={percent}
          max={100}
        />
      </div>
      {isPending ? <p className="text-[10px] text-[var(--color-text-muted)]">Refreshing...</p> : null}
    </div>
  );
}
