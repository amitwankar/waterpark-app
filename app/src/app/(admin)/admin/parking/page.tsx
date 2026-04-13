"use client";

import { useEffect, useState } from "react";
import { CarFront } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";

interface ParkingRate {
  id: string;
  vehicleType: "TWO_WHEELER" | "FOUR_WHEELER" | "BUS" | "OTHER";
  label: string;
  baseRate: number;
  gstRate: number;
  isActive: boolean;
}

interface ParkingTicket {
  id: string;
  ticketNumber: string;
  vehicleNumber: string;
  vehicleType: string;
  status: "ACTIVE" | "EXITED" | "CANCELLED";
  hours: number | null;
  totalAmount: number;
  entryAt: string;
  exitAt: string | null;
  paymentMethod: string | null;
}

function money(v: number): string {
  return `₹${Number(v || 0).toFixed(2)}`;
}

export default function AdminParkingPage(): JSX.Element {
  const [rates, setRates] = useState<ParkingRate[]>([]);
  const [tickets, setTickets] = useState<ParkingTicket[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAll(): Promise<void> {
    const [ratesRes, ticketsRes] = await Promise.all([
      fetch("/api/v1/parking/rates"),
      fetch("/api/v1/parking/tickets"),
    ]);

    if (ratesRes.ok) setRates((await ratesRes.json()) as ParkingRate[]);
    if (ticketsRes.ok) setTickets((await ticketsRes.json()) as ParkingTicket[]);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function saveRate(rate: ParkingRate): Promise<void> {
    setSavingId(rate.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/parking/rates/${rate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: rate.label,
          baseRate: Number(rate.baseRate || 0),
          gstRate: Number(rate.gstRate || 0),
          isActive: rate.isActive,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Failed to update rate");
        return;
      }
      await loadAll();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Parking Management"
        subtitle="Configure parking rates and monitor parking billing."
      />

      {error ? <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Rate Master</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rates.map((rate) => (
            <div key={rate.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{rate.vehicleType.replaceAll("_", " ")}</p>
              <input
                value={rate.label}
                onChange={(e) =>
                  setRates((prev) => prev.map((row) => (row.id === rate.id ? { ...row, label: e.target.value } : row)))
                }
                className="w-full rounded border border-[var(--color-border)] px-2 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={rate.baseRate}
                  onChange={(e) =>
                    setRates((prev) => prev.map((row) => (row.id === rate.id ? { ...row, baseRate: Number(e.target.value || 0) } : row)))
                  }
                  className="rounded border border-[var(--color-border)] px-2 py-2 text-sm"
                  placeholder="Rate"
                />
                <input
                  type="number"
                  value={rate.gstRate}
                  onChange={(e) =>
                    setRates((prev) => prev.map((row) => (row.id === rate.id ? { ...row, gstRate: Number(e.target.value || 0) } : row)))
                  }
                  className="rounded border border-[var(--color-border)] px-2 py-2 text-sm"
                  placeholder="GST"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <input
                  type="checkbox"
                  checked={rate.isActive}
                  onChange={(e) =>
                    setRates((prev) => prev.map((row) => (row.id === rate.id ? { ...row, isActive: e.target.checked } : row)))
                  }
                />
                Active
              </label>
              <Button size="sm" onClick={() => void saveRate(rate)} disabled={savingId === rate.id}>
                {savingId === rate.id ? "Saving..." : "Save"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Recent Parking Tickets</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                <th className="py-2">Ticket</th>
                <th className="py-2">Vehicle</th>
                <th className="py-2">Type</th>
                <th className="py-2">Status</th>
                <th className="py-2">Hours</th>
                <th className="py-2">Payment</th>
                <th className="py-2">Total</th>
                <th className="py-2">Entry</th>
                <th className="py-2">Exit</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="border-b border-[var(--color-border)]">
                  <td className="py-2 font-medium">{ticket.ticketNumber}</td>
                  <td className="py-2">{ticket.vehicleNumber}</td>
                  <td className="py-2">{ticket.vehicleType.replaceAll("_", " ")}</td>
                  <td className="py-2">{ticket.status}</td>
                  <td className="py-2">{ticket.hours ?? "-"}</td>
                  <td className="py-2">{ticket.paymentMethod ?? "-"}</td>
                  <td className="py-2">{money(ticket.totalAmount)}</td>
                  <td className="py-2">{new Date(ticket.entryAt).toLocaleString("en-IN")}</td>
                  <td className="py-2">{ticket.exitAt ? new Date(ticket.exitAt).toLocaleString("en-IN") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tickets.length === 0 ? (
          <div className="mt-4 rounded border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
            <CarFront className="mx-auto mb-2 h-5 w-5" />
            No parking tickets yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}
