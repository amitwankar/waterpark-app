"use client";

import { useState, useEffect, useCallback } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { DateRangeFilter, type DateRange } from "@/components/reports/DateRangeFilter";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { ReportKpiRow, type KpiItem } from "@/components/reports/ReportKpiRow";

function currentMonth(): DateRange {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dateFrom: first.toISOString().slice(0, 10),
    dateTo: last.toISOString().slice(0, 10),
  };
}

const DEFAULT_RANGE: DateRange = {
  dateFrom: "",
  dateTo: "",
};

interface Props<T> {
  title: string;
  subtitle: string;
  reportKey: string;
  apiPath: string;
  buildKpis: (data: T) => KpiItem[];
  children: (data: T, loading: boolean) => React.ReactNode;
}

export function ReportPageLayout<T>({
  title,
  subtitle,
  reportKey,
  apiPath,
  buildKpis,
  children,
}: Props<T>) {
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRange(currentMonth());
  }, []);

  const load = useCallback(async () => {
    if (!range.dateFrom || !range.dateTo) {
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
      });
      const res = await fetch(`${apiPath}?${q.toString()}`);
      if (res.ok) setData((await res.json()) as T);
    } finally {
      setLoading(false);
    }
  }, [apiPath, range]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={[
          {
            key: "export",
            element: (
              <ExportButtons
                report={reportKey}
                dateFrom={range.dateFrom}
                dateTo={range.dateTo}
              />
            ),
          },
        ]}
      />

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      <ReportKpiRow
        items={data ? buildKpis(data) : []}
        loading={loading}
      />

      {children(data as T, loading)}
    </div>
  );
}
