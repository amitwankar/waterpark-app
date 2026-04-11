"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CreditCard, DollarSign, Landmark, ShoppingCart, Wallet } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { normalizePaymentMethod, paymentMethodLabel } from "@/lib/payment-methods";

interface PaymentSummary {
  today: {
    totalCollected: number;
    gateway: number;
    manualUpi: number;
    cash: number;
    card: number;
    wristband: number;
    complimentary: number;
    bookingCollection: number;
    posCollection: number;
    bookingAdvance: number;
    transactionCount: number;
  };
  upiQueue: {
    pending: number;
    pendingAmount: number;
  };
  recentTransactions: {
    id: string;
    bookingNumber: string | null;
    guestName: string | null;
    amount: number;
    method: string;
    status: string;
    createdAt: string;
    source: "POS" | "BOOKING";
    isAdvance: boolean;
  }[];
}

const METHOD_BADGE: Record<string, string> = {
  GATEWAY: "info",
  MANUAL_UPI: "warning",
  CASH: "success",
  CARD: "info",
  WRISTBAND: "info",
  COMPLIMENTARY: "default",
};

const STATUS_BADGE: Record<string, string> = {
  PAID: "success",
  PENDING: "warning",
  FAILED: "danger",
  REFUNDED: "info",
  REJECTED: "danger",
};

type RangePreset = "today" | "7d" | "30d" | "custom";

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function presetRange(preset: Exclude<RangePreset, "custom">): { from: string; to: string } {
  const today = new Date();
  const to = toDateInput(today);
  const fromDate = new Date(today);
  if (preset === "7d") {
    fromDate.setDate(fromDate.getDate() - 6);
  } else if (preset === "30d") {
    fromDate.setDate(fromDate.getDate() - 29);
  }
  return { from: toDateInput(fromDate), to };
}

export default function AdminPaymentsPage() {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<RangePreset>("today");
  const [dateFrom, setDateFrom] = useState<string>(presetRange("today").from);
  const [dateTo, setDateTo] = useState<string>(presetRange("today").to);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (dateFrom) query.set("dateFrom", dateFrom);
      if (dateTo) query.set("dateTo", dateTo);
      const res = await fetch(`/api/v1/analytics/payments?${query.toString()}`);
      if (res.ok) setSummary(await res.json());
      else setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyPreset(nextPreset: Exclude<RangePreset, "custom">): void {
    const range = presetRange(nextPreset);
    setPreset(nextPreset);
    setDateFrom(range.from);
    setDateTo(range.to);
  }

  const safeSummary = {
    today: {
      totalCollected: Number(summary?.today?.totalCollected ?? 0),
      gateway: Number(summary?.today?.gateway ?? 0),
      manualUpi: Number(summary?.today?.manualUpi ?? 0),
      cash: Number(summary?.today?.cash ?? 0),
      card: Number(summary?.today?.card ?? 0),
      wristband: Number(summary?.today?.wristband ?? 0),
      complimentary: Number(summary?.today?.complimentary ?? 0),
      bookingCollection: Number(summary?.today?.bookingCollection ?? 0),
      posCollection: Number(summary?.today?.posCollection ?? 0),
      bookingAdvance: Number(summary?.today?.bookingAdvance ?? 0),
      transactionCount: Number(summary?.today?.transactionCount ?? 0),
    },
    upiQueue: {
      pending: Number(summary?.upiQueue?.pending ?? 0),
      pendingAmount: Number(summary?.upiQueue?.pendingAmount ?? 0),
    },
    recentTransactions: Array.isArray(summary?.recentTransactions) ? summary!.recentTransactions : [],
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Transaction overview and payment management"
      />

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-[var(--color-text)]">Collection Period</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={preset === "today" ? "primary" : "outline"}
              onClick={() => applyPreset("today")}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant={preset === "7d" ? "primary" : "outline"}
              onClick={() => applyPreset("7d")}
            >
              Last 7 Days
            </Button>
            <Button
              size="sm"
              variant={preset === "30d" ? "primary" : "outline"}
              onClick={() => applyPreset("30d")}
            >
              Last 30 Days
            </Button>
            <Button
              size="sm"
              variant={preset === "custom" ? "primary" : "outline"}
              onClick={() => setPreset("custom")}
            >
              Custom
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-[180px_180px_auto]">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setPreset("custom");
                setDateFrom(event.target.value);
              }}
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)]"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setPreset("custom");
                setDateTo(event.target.value);
              }}
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)]"
            />
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={!dateFrom || !dateTo || dateFrom > dateTo}
            >
              Apply Range
            </Button>
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: DollarSign, label: "Total Collected", value: `₹${safeSummary.today.totalCollected.toFixed(2)}`, color: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/25" },
              { icon: CreditCard, label: "Transactions", value: safeSummary.today.transactionCount, color: "text-cyan-700 bg-cyan-50 dark:text-cyan-300 dark:bg-cyan-900/25" },
              { icon: ShoppingCart, label: "POS Collection", value: `₹${safeSummary.today.posCollection.toFixed(2)}`, color: "text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-900/25" },
              { icon: Landmark, label: "Pre-booking Collection", value: `₹${safeSummary.today.bookingCollection.toFixed(2)}`, color: "text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-900/25" },
              { icon: Wallet, label: "Booking Advance", value: `₹${safeSummary.today.bookingAdvance.toFixed(2)}`, color: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/25" },
              { icon: CreditCard, label: "Cash + Card", value: `₹${(safeSummary.today.cash + safeSummary.today.card).toFixed(2)}`, color: "text-teal-700 bg-teal-50 dark:text-teal-300 dark:bg-teal-900/25" },
            ].map((kpi) => (
              <div key={kpi.label} className={`rounded-xl border border-[var(--color-border)] p-4 flex items-center gap-3 ${kpi.color}`}>
                <kpi.icon className="w-6 h-6 shrink-0" />
                <div>
                  <p className="text-xl font-bold text-[var(--color-text)]">{kpi.value}</p>
                  <p className="text-xs font-medium mt-0.5 text-[var(--color-text-muted)]">{kpi.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Payment method breakdown */}
          {summary && (
            <Card>
              <CardHeader><h3 className="font-semibold text-[var(--color-text)]">Collection by Method</h3></CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: "Gateway", value: safeSummary.today.gateway },
                    { label: "UPI", value: safeSummary.today.manualUpi },
                    { label: "Cash", value: safeSummary.today.cash },
                    { label: "Card", value: safeSummary.today.card },
                    { label: "Wristband", value: safeSummary.today.wristband },
                    { label: "Complimentary", value: safeSummary.today.complimentary },
                  ].map((m) => (
                    <div key={m.label} className="text-center bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)] p-3">
                      <p className="text-lg font-bold text-[var(--color-text)]">₹{m.value.toFixed(2)}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{m.label}</p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Recent transactions */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-[var(--color-text)]">Recent Transactions</h3>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {!safeSummary.recentTransactions.length ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2" />
                  <p className="text-sm text-[var(--color-text-muted)]">No transactions in selected period</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {safeSummary.recentTransactions.map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {txn.bookingNumber && (
                            <span className="font-mono text-xs text-[var(--color-text-muted)]">{txn.bookingNumber}</span>
                          )}
                          <Badge variant={txn.source === "POS" ? "info" : "default"}>
                            {txn.source}
                          </Badge>
                          {txn.isAdvance ? <Badge variant="warning">Advance</Badge> : null}
                          <Badge variant={(METHOD_BADGE[normalizePaymentMethod(txn.method) ?? ""] as "default" | "success" | "warning" | "danger" | "info") ?? "default"}>
                            {paymentMethodLabel(txn.method)}
                          </Badge>
                          <Badge variant={(STATUS_BADGE[txn.status] as "default" | "success" | "warning" | "danger" | "info") ?? "default"}>
                            {txn.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-[var(--color-text)] mt-0.5">{txn.guestName ?? "—"}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{new Date(txn.createdAt).toLocaleTimeString()}</p>
                      </div>
                      <p className="font-bold text-[var(--color-text)]">₹{Number(txn.amount).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
