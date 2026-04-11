"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";

export interface QueueCounterProps {
  rideId: string;
  initialCount: number;
  waitTimeMin: number;
  canReset?: boolean;
  onUpdated?: (nextCount: number, waitMin: number) => void;
}

export function QueueCounter({ rideId, initialCount, waitTimeMin, canReset = false, onUpdated }: QueueCounterProps): JSX.Element {
  const [count, setCount] = useState(initialCount);
  const [wait, setWait] = useState(waitTimeMin);
  const [isPending, startTransition] = useTransition();

  function apply(action: "INCREMENT" | "DECREMENT" | "RESET"): void {
    startTransition(() => {
      void fetch(`/api/v1/rides/${rideId}/queue`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
        .then((res) => res.json())
        .then((payload: { queueCount?: number; waitTimeMin?: number }) => {
          const nextCount = Number(payload.queueCount ?? count);
          const nextWait = Number(payload.waitTimeMin ?? wait);
          setCount(nextCount);
          setWait(nextWait);
          onUpdated?.(nextCount, nextWait);
        });
    });
  }

  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
      <p className="text-xs text-[var(--color-text-muted)]">Queue</p>
      <p className="text-2xl font-semibold text-[var(--color-text)]">{count}</p>
      <p className="text-xs text-[var(--color-text-muted)]">~ {wait} min wait</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => apply("DECREMENT")} loading={isPending}>−</Button>
        <Button size="sm" onClick={() => apply("INCREMENT")} loading={isPending}>＋</Button>
        {canReset ? <Button size="sm" variant="ghost" onClick={() => apply("RESET")} loading={isPending}>Reset</Button> : null}
      </div>
    </div>
  );
}
