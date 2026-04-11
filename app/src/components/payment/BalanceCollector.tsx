"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { SplitSummaryCard, type SplitSummaryRow } from "@/components/payment/SplitSummaryCard";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface BookingDetails {
  id: string;
  bookingNumber: string;
  guestName: string;
  status: string;
  totalAmount: number;
  notes?: string | null;
  transactions: Array<{
    id: string;
    method: "GATEWAY" | "MANUAL_UPI" | "CASH" | "WRISTBAND";
    amount: number;
    status: "PENDING" | "PAID" | "FAILED" | "REJECTED" | "REFUNDED";
    notes?: string | null;
  }>;
}

interface BalanceRow {
  id: string;
  method: "CASH" | "MANUAL_UPI" | "WRISTBAND";
  amount: number;
  upiRef?: string;
  notes?: string;
}

export interface BalanceCollectorProps {
  defaultBookingNumber?: string;
}

function parseBookingMeta(notes?: string | null): { balanceDue: number } {
  if (!notes) return { balanceDue: 0 };
  const line = notes
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.startsWith("PAYMENT_META:"));
  if (!line) return { balanceDue: 0 };

  try {
    const data = JSON.parse(line.slice("PAYMENT_META:".length)) as { balanceDue?: number };
    return { balanceDue: typeof data.balanceDue === "number" ? data.balanceDue : 0 };
  } catch {
    return { balanceDue: 0 };
  }
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function createRow(amount = 50): BalanceRow {
  return {
    id: crypto.randomUUID(),
    method: "CASH",
    amount,
    upiRef: "",
    notes: "",
  };
}

export function BalanceCollector({ defaultBookingNumber }: BalanceCollectorProps): JSX.Element {
  const [bookingNumber, setBookingNumber] = useState(defaultBookingNumber ?? "");
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [rows, setRows] = useState<BalanceRow[]>([createRow()]);

  const bookingBalanceDue = useMemo(() => parseBookingMeta(booking?.notes).balanceDue, [booking?.notes]);
  const rowTotal = useMemo(() => rows.reduce((acc, row) => acc + row.amount, 0), [rows]);

  async function loadBooking(): Promise<void> {
    if (!bookingNumber.trim()) {
      setError("Enter booking number");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/v1/bookings/${encodeURIComponent(bookingNumber.trim())}?by=bookingNumber`);
      const payload = (await response.json().catch(() => null)) as { message?: string; booking?: any } | null;
      if (!response.ok || !payload?.booking) {
        throw new Error(payload?.message ?? "Booking not found");
      }

      const details: BookingDetails = {
        id: payload.booking.id,
        bookingNumber: payload.booking.bookingNumber,
        guestName: payload.booking.guestName,
        status: payload.booking.status,
        totalAmount: Number(payload.booking.totalAmount),
        notes: payload.booking.notes,
        transactions: (payload.booking.transactions ?? []).map((tx: any) => ({
          id: tx.id,
          method: tx.method,
          amount: Number(tx.amount),
          status: tx.status,
          notes: tx.notes,
        })),
      };

      setBooking(details);
      const due = parseBookingMeta(details.notes).balanceDue;
      setRows([createRow(due > 0 ? due : 50)]);
    } catch (fetchError) {
      setError((fetchError as Error).message);
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }

  function updateRow(id: string, patch: Partial<BalanceRow>): void {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow(): void {
    if (rows.length >= 4) return;
    setRows((current) => [...current, createRow(50)]);
  }

  function removeRow(id: string): void {
    if (rows.length <= 1) return;
    setRows((current) => current.filter((row) => row.id !== id));
  }

  async function submitCollection(): Promise<void> {
    if (!booking) {
      setError("Search booking first");
      return;
    }

    if (rows.some((row) => row.amount <= 0)) {
      setError("Each row amount must be greater than 0");
      return;
    }

    if (rows.some((row) => row.method === "MANUAL_UPI" && (!row.upiRef || row.upiRef.trim().length < 6))) {
      setError("UPI reference required for MANUAL_UPI rows");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/v1/bookings/${booking.id}/collect-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payments: rows.map((row) => ({
            method: row.method,
            amount: row.amount,
            upiRef: row.method === "MANUAL_UPI" ? row.upiRef?.trim() : undefined,
            notes: row.notes?.trim() || undefined,
          })),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string; bookingStatus?: string; promptCheckIn?: boolean } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Collection failed");
      }

      setMessage(
        payload?.promptCheckIn
          ? "Balance collected. Booking fully paid, proceed to check-in."
          : "Balance collection submitted.",
      );

      await loadBooking();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const summaryRows: SplitSummaryRow[] = (booking?.transactions ?? []).map((tx) => ({
    id: tx.id,
    method: tx.method,
    amount: tx.amount,
    status: tx.status,
    splitIndex: null,
  }));

  const paid = summaryRows
    .filter((row) => row.status === "PAID")
    .reduce((acc, row) => acc + row.amount, 0);

  return (
    <Card>
      <CardHeader>
        <h1 className="text-lg font-semibold text-[var(--color-text)]">Collect Balance at Gate</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Add one or more payment rows (Cash + UPI combination supported).</p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            label="Booking Number"
            value={bookingNumber}
            onChange={(event) => setBookingNumber(event.target.value.trim().toUpperCase())}
            placeholder="AWP-BOOK-001"
            className="flex-1"
          />
          <div className="sm:pt-7">
            <Button loading={loading} onClick={() => void loadBooking()}>
              Find Booking
            </Button>
          </div>
        </div>

        {booking ? (
          <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
            <div className="grid gap-2 text-sm text-[var(--color-text-muted)] sm:grid-cols-2">
              <p>Guest: <span className="font-medium text-[var(--color-text)]">{booking.guestName}</span></p>
              <p>Status: <span className="font-medium text-[var(--color-text)]">{booking.status}</span></p>
              <p>Total: <span className="font-medium text-[var(--color-text)]">{formatInr(booking.totalAmount)}</span></p>
              <p>Remaining: <span className="font-medium text-[var(--color-text)]">{formatInr(bookingBalanceDue)}</span></p>
            </div>

            {summaryRows.length > 0 ? (
              <SplitSummaryCard
                rows={summaryRows}
                totalAmount={booking.totalAmount}
                totalPaid={paid}
                balanceDue={bookingBalanceDue}
              />
            ) : null}

            <div className="space-y-2">
              {rows.map((row, index) => (
                <div key={row.id} className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                  <Select
                    label={`Method ${index + 1}`}
                    options={[
                      { label: "Cash", value: "CASH" },
                      { label: "Manual UPI", value: "MANUAL_UPI" },
                      { label: "Wristband", value: "WRISTBAND" },
                    ]}
                    value={row.method}
                    onChange={(event) => updateRow(row.id, { method: event.target.value as BalanceRow["method"] })}
                  />

                  <Input
                    label="Amount"
                    type="number"
                    value={String(row.amount)}
                    onChange={(event) => updateRow(row.id, { amount: Number(event.target.value) || 0 })}
                  />

                  {row.method === "MANUAL_UPI" ? (
                    <Input
                      label="UPI Ref"
                      value={row.upiRef ?? ""}
                      onChange={(event) => updateRow(row.id, { upiRef: event.target.value.toUpperCase() })}
                    />
                  ) : (
                    <Input
                      label="Notes"
                      value={row.notes ?? ""}
                      onChange={(event) => updateRow(row.id, { notes: event.target.value })}
                    />
                  )}

                  <Button variant="ghost" onClick={() => removeRow(row.id)} disabled={rows.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={addRow} disabled={rows.length >= 4}>
                  <Plus className="h-4 w-4" />
                  Add Row
                </Button>
                <p className="text-sm text-[var(--color-text-muted)]">Current rows total: {formatInr(rowTotal)}</p>
              </div>
            </div>

            <Button loading={submitting} onClick={() => void submitCollection()}>
              Confirm Collection
            </Button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--color-success)]">{message}</p> : null}
      </CardBody>
    </Card>
  );
}
