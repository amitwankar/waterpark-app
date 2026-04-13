"use client";

import { useEffect, useMemo, useState } from "react";

import { SessionCloser } from "@/components/pos/SessionCloser";

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
  vehicleType: ParkingRate["vehicleType"];
  quantity: number;
  status: "ACTIVE" | "EXITED" | "CANCELLED";
  hours: number | null;
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
  paymentMethod: "CASH" | "CARD" | "MANUAL_UPI" | "COMPLIMENTARY" | null;
  notes: string | null;
  entryAt: string;
  exitAt: string | null;
  rate: ParkingRate;
  issuedBy: { id: string; name: string };
}

interface ParkingTerminalProps {
  sessionId: string;
  terminalId: string;
  cashierName: string;
  onSessionClosed: () => void;
}

const VEHICLE_LABELS: Record<ParkingRate["vehicleType"], string> = {
  TWO_WHEELER: "Two Wheeler",
  FOUR_WHEELER: "Four Wheeler",
  BUS: "Bus",
  OTHER: "Other",
};

function money(value: number): string {
  return `₹${Number(value || 0).toFixed(2)}`;
}

export function ParkingTerminal({ sessionId, terminalId, cashierName, onSessionClosed }: ParkingTerminalProps): JSX.Element {
  const [rates, setRates] = useState<ParkingRate[]>([]);
  const [tickets, setTickets] = useState<ParkingTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCloser, setShowCloser] = useState(false);

  const [vehicleType, setVehicleType] = useState<ParkingRate["vehicleType"]>("FOUR_WHEELER");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [entryNotes, setEntryNotes] = useState("");

  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [hours, setHours] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "MANUAL_UPI" | "COMPLIMENTARY">("CASH");
  const [checkoutNotes, setCheckoutNotes] = useState("");

  const activeTickets = useMemo(() => tickets.filter((ticket) => ticket.status === "ACTIVE"), [tickets]);
  const closedTickets = useMemo(() => tickets.filter((ticket) => ticket.status === "EXITED"), [tickets]);

  const selectedRate = useMemo(
    () => rates.find((rate) => rate.vehicleType === vehicleType && rate.isActive) ?? null,
    [rates, vehicleType],
  );

  const selectedTicket = useMemo(() => activeTickets.find((ticket) => ticket.id === selectedTicketId) ?? null, [activeTickets, selectedTicketId]);

  const previewBase = selectedTicket
    ? Number(selectedTicket.rate.baseRate) * Math.max(1, Number(hours || 1)) * Math.max(1, selectedTicket.quantity)
    : 0;
  const previewGst = selectedTicket ? (previewBase * Number(selectedTicket.rate.gstRate)) / 100 : 0;
  const previewTotal = previewBase + previewGst;

  async function loadAll(): Promise<void> {
    setLoading(true);
    try {
      const [ratesRes, ticketsRes] = await Promise.all([
        fetch("/api/v1/parking/rates"),
        fetch("/api/v1/parking/tickets"),
      ]);

      if (ratesRes.ok) {
        const data = (await ratesRes.json()) as ParkingRate[];
        setRates(data);
      }
      if (ticketsRes.ok) {
        const data = (await ticketsRes.json()) as ParkingTicket[];
        setTickets(data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!selectedTicketId && activeTickets.length > 0) {
      setSelectedTicketId(activeTickets[0].id);
    }
    if (selectedTicketId && !activeTickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(activeTickets[0]?.id ?? "");
    }
  }, [activeTickets, selectedTicketId]);

  function printReceipt(ticket: ParkingTicket): void {
    const win = window.open("", "_blank", "width=420,height=640");
    if (!win) return;

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Parking Receipt ${ticket.ticketNumber}</title>
<style>
body { font-family: Arial, sans-serif; padding: 12px; }
h2 { margin: 0 0 8px; }
.row { display:flex; justify-content:space-between; margin:4px 0; }
hr { margin:10px 0; }
.small { color:#555; font-size:12px; }
</style>
</head>
<body>
  <h2>Parking Receipt</h2>
  <div class="small">Terminal: ${terminalId}</div>
  <div class="small">Cashier: ${cashierName}</div>
  <div class="small">Ticket: ${ticket.ticketNumber}</div>
  <hr />
  <div class="row"><span>Vehicle</span><strong>${ticket.vehicleNumber}</strong></div>
  <div class="row"><span>Type</span><strong>${VEHICLE_LABELS[ticket.vehicleType]}</strong></div>
  <div class="row"><span>Qty</span><strong>${ticket.quantity}</strong></div>
  <div class="row"><span>Hours</span><strong>${ticket.hours ?? "-"}</strong></div>
  <hr />
  <div class="row"><span>Base</span><strong>${money(ticket.baseAmount)}</strong></div>
  <div class="row"><span>GST</span><strong>${money(ticket.gstAmount)}</strong></div>
  <div class="row"><span>Total</span><strong>${money(ticket.totalAmount)}</strong></div>
  <div class="row"><span>Payment</span><strong>${ticket.paymentMethod ?? "-"}</strong></div>
  <hr />
  <div class="small">Entry: ${new Date(ticket.entryAt).toLocaleString("en-IN")}</div>
  <div class="small">Exit: ${ticket.exitAt ? new Date(ticket.exitAt).toLocaleString("en-IN") : "-"}</div>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  async function createEntry(): Promise<void> {
    if (!vehicleNumber.trim()) {
      setError("Vehicle number is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/v1/parking/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleType,
          vehicleNumber: vehicleNumber.trim().toUpperCase(),
          quantity: Math.max(1, Number(quantity || "1")),
          notes: entryNotes.trim() || undefined,
          posSessionId: sessionId,
        }),
      });

      const payload = (await res.json().catch(() => null)) as { error?: string; ticketNumber?: string } | ParkingTicket | null;
      if (!res.ok) {
        setError((payload as { error?: string } | null)?.error ?? "Failed to create parking entry");
        return;
      }

      setSuccess(`Parking entry created (${(payload as ParkingTicket).ticketNumber}).`);
      setVehicleNumber("");
      setQuantity("1");
      setEntryNotes("");
      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  async function checkoutTicket(): Promise<void> {
    if (!selectedTicket) {
      setError("Select active parking ticket first.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/v1/parking/tickets/${selectedTicket.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hours: Math.max(1, Number(hours || "1")),
          paymentMethod,
          notes: checkoutNotes.trim() || undefined,
        }),
      });

      const payload = (await res.json().catch(() => null)) as { error?: string } | ParkingTicket | null;
      if (!res.ok) {
        setError((payload as { error?: string } | null)?.error ?? "Checkout failed");
        return;
      }

      const closed = payload as ParkingTicket;
      setSuccess(`Parking checkout completed (${closed.ticketNumber}).`);
      setCheckoutNotes("");
      await loadAll();
      printReceipt(closed);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-muted)]">Loading parking terminal...</div>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-text)]">Parking POS</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Manage parking entry/exit and print bills.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCloser(true)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text)] hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Close Session
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Parking Entry</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Vehicle Type</label>
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as ParkingRate["vehicleType"])} className="w-full rounded border border-[var(--color-border)] px-2 py-2 text-sm">
                {rates.filter((rate) => rate.isActive).map((rate) => (
                  <option key={rate.id} value={rate.vehicleType}>{rate.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Quantity</label>
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min={1} max={20} className="w-full rounded border border-[var(--color-border)] px-2 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Vehicle Number</label>
            <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="MH12AB1234" className="w-full rounded border border-[var(--color-border)] px-2 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Entry Notes</label>
            <textarea value={entryNotes} onChange={(e) => setEntryNotes(e.target.value)} rows={2} className="w-full rounded border border-[var(--color-border)] px-2 py-2 text-sm" />
          </div>
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            Current rate: {selectedRate ? `${money(selectedRate.baseRate)} / hour · GST ${selectedRate.gstRate}%` : "No active rate"}
          </div>
          <button onClick={() => void createEntry()} disabled={saving} className="w-full rounded bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Saving..." : "Create Parking Entry"}
          </button>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Parking Exit & Bill</h2>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Active Ticket</label>
            <select value={selectedTicketId} onChange={(e) => setSelectedTicketId(e.target.value)} className="w-full rounded border border-[var(--color-border)] px-2 py-2 text-sm">
              <option value="">Select active ticket</option>
              {activeTickets.map((ticket) => (
                <option key={ticket.id} value={ticket.id}>{ticket.ticketNumber} · {ticket.vehicleNumber}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Hours</label>
              <input value={hours} onChange={(e) => setHours(e.target.value)} type="number" min={1} max={48} className="w-full rounded border border-[var(--color-border)] px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Payment</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "CARD" | "MANUAL_UPI" | "COMPLIMENTARY")} className="w-full rounded border border-[var(--color-border)] px-2 py-2 text-sm">
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="MANUAL_UPI">UPI</option>
                <option value="COMPLIMENTARY">Complimentary</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Exit Notes</label>
            <textarea value={checkoutNotes} onChange={(e) => setCheckoutNotes(e.target.value)} rows={2} className="w-full rounded border border-[var(--color-border)] px-2 py-2 text-sm" />
          </div>
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs text-[var(--color-text-muted)] space-y-1">
            <p>Base: {money(previewBase)}</p>
            <p>GST: {money(previewGst)}</p>
            <p className="font-semibold text-[var(--color-text)]">Total: {money(previewTotal)}</p>
          </div>
          <button onClick={() => void checkoutTicket()} disabled={saving || !selectedTicket} className="w-full rounded bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Processing..." : "Checkout & Print Bill"}
          </button>
        </div>
      </section>

      {error ? <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p> : null}

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Today Tickets</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                <th className="py-2">Ticket</th>
                <th className="py-2">Vehicle</th>
                <th className="py-2">Type</th>
                <th className="py-2">Status</th>
                <th className="py-2">Hours</th>
                <th className="py-2">Total</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="border-b border-[var(--color-border)]">
                  <td className="py-2 font-medium">{ticket.ticketNumber}</td>
                  <td className="py-2">{ticket.vehicleNumber}</td>
                  <td className="py-2">{VEHICLE_LABELS[ticket.vehicleType]}</td>
                  <td className="py-2">{ticket.status}</td>
                  <td className="py-2">{ticket.hours ?? "-"}</td>
                  <td className="py-2">{money(ticket.totalAmount)}</td>
                  <td className="py-2">
                    {ticket.status === "EXITED" ? (
                      <button type="button" className="text-[var(--color-primary)] hover:underline" onClick={() => printReceipt(ticket)}>
                        Reprint
                      </button>
                    ) : <span className="text-[var(--color-text-muted)]">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {closedTickets.length === 0 && activeTickets.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">No parking tickets yet.</p>
        ) : null}
      </section>

      {showCloser ? (
        <SessionCloser
          sessionId={sessionId}
          onClosed={() => {
            setShowCloser(false);
            onSessionClosed();
          }}
          onCancel={() => setShowCloser(false)}
        />
      ) : null}
    </div>
  );
}
