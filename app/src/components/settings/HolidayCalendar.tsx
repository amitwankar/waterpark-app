"use client";

import { useMemo, useState } from "react";

import { HolidayDrawer, type HolidayItem } from "@/components/settings/HolidayDrawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface HolidayCalendarProps {
  initialHolidays: HolidayItem[];
}

export type { HolidayItem };

function dateToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthStart(base: Date, offset: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}

function tone(type: HolidayItem["type"]): "danger" | "warning" | "info" {
  if (type === "CLOSED") return "danger";
  if (type === "SPECIAL_HOURS") return "warning";
  return "info";
}

export function HolidayCalendar({ initialHolidays }: HolidayCalendarProps): JSX.Element {
  const [holidays, setHolidays] = useState<HolidayItem[]>(initialHolidays);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const holidayMap = useMemo(() => {
    const map = new Map<string, HolidayItem>();
    for (const holiday of holidays) {
      map.set(String(holiday.date).slice(0, 10), holiday);
    }
    return map;
  }, [holidays]);

  async function reload(): Promise<void> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString().slice(0, 10);
    const response = await fetch(`/api/v1/settings/holidays?start=${start}&end=${end}`);
    const data = (await response.json()) as HolidayItem[];
    setHolidays(data);
  }

  return (
    <section id="holidays">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Holiday Management</h2>
            <Button size="sm" onClick={() => setDrawerOpen(true)}>Add / Edit Date</Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((offset) => {
              const start = monthStart(new Date(), offset);
              const year = start.getFullYear();
              const month = start.getMonth();
              const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
              const totalDays = new Date(year, month + 1, 0).getDate();

              return (
                <div key={offset} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
                  <p className="mb-3 text-sm font-semibold text-[var(--color-text)]">
                    {start.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                  </p>
                  <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--color-text-muted)]">
                    {["M", "T", "W", "T", "F", "S", "S"].map((day, dayIndex) => (
                      <span key={`weekday-${offset}-${dayIndex}`}>{day}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstWeekday }).map((_, idx) => (
                      <div key={`empty-${offset}-${idx}`} className="h-8" />
                    ))}
                    {Array.from({ length: totalDays }).map((_, idx) => {
                      const date = new Date(year, month, idx + 1);
                      const key = dateToKey(date);
                      const holiday = holidayMap.get(key);
                      const isSelected = selectedDate === key;

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setSelectedDate(key);
                            setDrawerOpen(true);
                          }}
                          className={`h-8 rounded text-xs transition ${
                            holiday
                              ? holiday.type === "CLOSED"
                                ? "bg-red-100 text-red-700"
                                : holiday.type === "SPECIAL_HOURS"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-cyan-100 text-cyan-700"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                          } ${isSelected ? "ring-2 ring-[var(--color-primary)]" : ""}`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            {holidays.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">No holidays configured.</p> : null}
            {holidays.map((holiday) => (
              <div key={holiday.id} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{holiday.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{String(holiday.date).slice(0, 10)}</p>
                </div>
                <Badge variant={tone(holiday.type)}>{holiday.type}</Badge>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <HolidayDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selectedDate={selectedDate}
        holiday={holidayMap.get(selectedDate) ?? null}
        onSaved={() => {
          void reload();
        }}
      />
    </section>
  );
}
