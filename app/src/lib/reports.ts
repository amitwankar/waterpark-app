/**
 * Shared utilities for the Reports & Analytics module.
 */

export interface DateRange {
  dateFrom: Date;
  dateTo: Date;
}

/** Parse dateFrom/dateTo from query params (YYYY-MM-DD). Falls back to current month. */
export function buildDateRange(
  fromParam?: string | null,
  toParam?: string | null
): DateRange {
  const now = new Date();

  const parseDate = (s: string, fallback: Date): Date => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? fallback : d;
  };

  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const dateFrom = fromParam
    ? startOfDay(parseDate(fromParam, defaultFrom))
    : defaultFrom;
  const dateTo = toParam
    ? endOfDay(parseDate(toParam, defaultTo))
    : defaultTo;

  return { dateFrom, dateTo };
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** Format as Indian currency string — ₹1,23,456.78 */
export function formatIndianCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Indian comma-separated number (e.g. 1,23,456) */
export function formatIndianNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

/**
 * Group an array of records by a date field, returning daily buckets.
 * Returns an array of { date: "YYYY-MM-DD", items: T[] }.
 */
export function groupByDate<T>(
  records: T[],
  dateField: keyof T
): Array<{ date: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const record of records) {
    const raw = record[dateField];
    const key =
      raw instanceof Date
        ? raw.toISOString().slice(0, 10)
        : String(raw).slice(0, 10);
    const bucket = map.get(key) ?? [];
    bucket.push(record);
    map.set(key, bucket);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }));
}

/** Day label for chart axis — "2024-01-15" → "15 Jan" */
export function shortDateLabel(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Parse integer query param with fallback */
export function queryInt(value: string | null, fallback: number): number {
  const n = parseInt(value ?? "", 10);
  return isNaN(n) ? fallback : n;
}
