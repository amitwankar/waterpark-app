"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/Button";

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

function currentMonth(): DateRange {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dateFrom: first.toISOString().slice(0, 10),
    dateTo: last.toISOString().slice(0, 10),
  };
}

const PRESETS: Array<{ label: string; range: () => DateRange }> = [
  {
    label: "Today",
    range: () => {
      const d = new Date().toISOString().slice(0, 10);
      return { dateFrom: d, dateTo: d };
    },
  },
  {
    label: "This Week",
    range: () => {
      const now = new Date();
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day - 1));
      return {
        dateFrom: monday.toISOString().slice(0, 10),
        dateTo: now.toISOString().slice(0, 10),
      };
    },
  },
  {
    label: "This Month",
    range: currentMonth,
  },
  {
    label: "Last Month",
    range: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        dateFrom: first.toISOString().slice(0, 10),
        dateTo: last.toISOString().slice(0, 10),
      };
    },
  },
  {
    label: "Last 3 Months",
    range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return {
        dateFrom: from.toISOString().slice(0, 10),
        dateTo: now.toISOString().slice(0, 10),
      };
    },
  },
];

export function DateRangeFilter({ value, onChange }: Props) {
  const [active, setActive] = useState<string | null>("This Month");

  function applyPreset(label: string, range: () => DateRange) {
    setActive(label);
    onChange(range());
  }

  function handleCustomChange(field: "dateFrom" | "dateTo") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setActive(null);
      onChange({ ...value, [field]: e.target.value });
    };
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarRange className="h-4 w-4 text-[var(--color-muted)] shrink-0" />

      {PRESETS.map(({ label, range }) => (
        <button
          key={label}
          type="button"
          onClick={() => applyPreset(label, range)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
            active === label
              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
              : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary)]"
          }`}
        >
          {label}
        </button>
      ))}

      <div className="flex items-center gap-1.5 text-sm">
        <input
          type="date"
          value={value.dateFrom}
          onChange={handleCustomChange("dateFrom")}
          className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)]"
        />
        <span className="text-[var(--color-muted)]">→</span>
        <input
          type="date"
          value={value.dateTo}
          onChange={handleCustomChange("dateTo")}
          className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)]"
        />
      </div>
    </div>
  );
}
