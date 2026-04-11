"use client";

import { useEffect, useMemo, useState } from "react";
import { ReceiptModal } from "./ReceiptModal";
import { SessionCloser } from "./SessionCloser";

interface LockerRow {
  id: string;
  number: string;
  size: "SMALL" | "MEDIUM" | "LARGE";
  status: "AVAILABLE" | "ASSIGNED" | "RETURNED" | "MAINTENANCE";
  rate: number;
  gstRate?: number;
  zone: { id: string; name: string };
}

interface ActiveAssignment {
  id: string;
  lockerId: string;
  lockerNumber: string;
  guestName: string;
  guestMobile: string;
  assignedAt: string;
  dueAt: string;
  amount: number;
  notes?: string | null;
}

interface ServiceBooking {
  id: string;
  bookingNumber: string;
  guestName: string;
  guestMobile: string;
  services?: {
    locker?: { pending: number; delivered: number };
    costume?: { pending: number; delivered: number };
    food?: { pendingQty: number };
  };
}

interface LockerTerminalProps {
  sessionId: string;
  terminalId: string;
  cashierName: string;
  onSessionClosed: () => void;
}

type Tab = "assign" | "release";

export function LockerTerminal({
  sessionId,
  terminalId,
  cashierName,
  onSessionClosed,
}: LockerTerminalProps) {
  const [tab, setTab] = useState<Tab>("assign");
  const [lockers, setLockers] = useState<LockerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLockerId, setSelectedLockerId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestMobile, setGuestMobile] = useState("");
  const [durationType, setDurationType] = useState<"HOURLY" | "FULL_DAY">("FULL_DAY");
  const [durationHours, setDurationHours] = useState("4");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [bookingQuery, setBookingQuery] = useState("");
  const [bookingLookupError, setBookingLookupError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);
  const [deliverQty, setDeliverQty] = useState("1");
  const [assigning, setAssigning] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCloser, setShowCloser] = useState(false);
  const [receiptRef, setReceiptRef] = useState<string | null>(null);

  const availableLockers = useMemo(
    () => lockers.filter((locker) => locker.status === "AVAILABLE"),
    [lockers],
  );
  const assignedLockers = useMemo(
    () => lockers.filter((locker) => locker.status === "ASSIGNED"),
    [lockers],
  );
  const selectedLocker = useMemo(
    () => availableLockers.find((locker) => locker.id === selectedLockerId) ?? null,
    [availableLockers, selectedLockerId],
  );
  const computedAmount = useMemo(() => {
    if (!selectedLocker) return 0;
    const baseRate = Number(selectedLocker.rate || 0);
    const gstRate = Number(selectedLocker.gstRate ?? 18);
    if (durationType === "HOURLY") {
      const hours = Math.max(1, Number(durationHours || "1"));
      return Math.round(baseRate * hours * (1 + gstRate / 100) * 100) / 100;
    }
    return Math.round(baseRate * (1 + gstRate / 100) * 100) / 100;
  }, [selectedLocker, durationType, durationHours]);

  async function lookupBooking() {
    const query = bookingQuery.trim();
    if (query.length < 3) {
      setBookingLookupError("Enter at least 3 characters.");
      return;
    }
    setBookingLookupError(null);
    const res = await fetch(`/api/v1/pos/booking-lookup?q=${encodeURIComponent(query)}&purpose=service`);
    const data = (await res.json().catch(() => [])) as ServiceBooking[] | { error?: string };
    if (!res.ok) {
      setBookingLookupError((data as { error?: string }).error ?? "Failed to lookup booking.");
      return;
    }
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) {
      setBookingLookupError("No checked-in booking found.");
      return;
    }
    setSelectedBooking(first);
    setGuestName(first.guestName);
    setGuestMobile(first.guestMobile);
    setBookingLookupError(null);
  }

  async function deliverBookedLocker() {
    if (!selectedBooking) return;
    const quantity = Math.max(1, Number(deliverQty || "1"));
    setError(null);
    const res = await fetch("/api/v1/lockers/deliver-booked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: selectedBooking.id, quantity }),
    });
    const payload = (await res.json().catch(() => null)) as { error?: string; delivered?: number } | null;
    if (!res.ok) {
      setError(payload?.error ?? "Failed to mark booked locker as delivered.");
      return;
    }
    await lookupBooking();
  }

  async function loadLockers() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/lockers");
      if (!res.ok) return;
      const payload = (await res.json()) as LockerRow[];
      setLockers(payload);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLockers();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadLockers();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  async function handleAssign() {
    setError(null);
    if (!selectedLockerId) {
      setError("Select a locker.");
      return;
    }
    if (!guestName.trim() || !/^[6-9]\d{9}$/.test(guestMobile.trim())) {
      setError("Guest name and valid 10-digit mobile are required.");
      return;
    }
    setAssigning(true);
    try {
      const res = await fetch(`/api/v1/lockers/${selectedLockerId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: selectedBooking?.id,
          guestName: guestName.trim(),
          guestMobile: guestMobile.trim(),
          durationType,
          durationHours: durationType === "HOURLY" ? Math.max(1, Number(durationHours || "1")) : undefined,
          amount: computedAmount,
          paymentMethod,
          notes: `POS session ${sessionId}`,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok) {
        setError(payload?.error ?? "Failed to assign locker.");
        return;
      }
      setReceiptRef(payload?.id ?? null);
      setSelectedLockerId("");
      setGuestName("");
      setGuestMobile("");
      void loadLockers();
    } finally {
      setAssigning(false);
    }
  }

  async function handleRelease(lockerId: string) {
    setError(null);
    setReleasing(true);
    try {
      const detailRes = await fetch(`/api/v1/lockers/${lockerId}`);
      const detail = (await detailRes.json().catch(() => null)) as
        | { assignments?: Array<{ id: string; guestName: string; guestMobile: string; assignedAt: string; dueAt: string; amount: number; notes?: string | null }> }
        | null;
      const assignment = detail?.assignments?.find((row) => !row.notes?.includes("PREBOOKED:PENDING"));
      if (!assignment) {
        setError("No delivered assignment found for this locker.");
        return;
      }

      const res = await fetch(`/api/v1/lockers/${lockerId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignment.id,
          notes: `Released via POS session ${sessionId}`,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string; id?: string } | null;
      if (!res.ok) {
        setError(payload?.error ?? "Failed to release locker.");
        return;
      }
      setReceiptRef(payload?.id ?? assignment.id);
      void loadLockers();
    } finally {
      setReleasing(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-indigo-700 text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-sm">🔐</div>
          <div>
            <p className="font-bold text-sm leading-none">Locker Counter</p>
            <p className="text-xs text-indigo-200 mt-0.5">{terminalId} · {cashierName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCloser(true)}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors"
        >
          Close Session
        </button>
      </header>

      <div className="bg-white border-b border-gray-200 px-4 flex gap-4 shrink-0">
        {(["assign", "release"] as const).map((currentTab) => (
          <button
            key={currentTab}
            type="button"
            onClick={() => setTab(currentTab)}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === currentTab
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {currentTab === "assign" ? "Assign Locker" : "Release Locker"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="max-w-2xl mx-auto bg-white rounded-xl p-5 text-sm text-gray-500">Loading lockers…</div>
        ) : tab === "assign" ? (
          <div className="max-w-2xl mx-auto bg-white rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Assign Locker</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2 rounded border border-gray-200 p-3 space-y-2">
                <label className="block text-xs text-gray-500">Checked-in Booking (optional)</label>
                <div className="flex gap-2">
                  <input
                    value={bookingQuery}
                    onChange={(event) => setBookingQuery(event.target.value)}
                    placeholder="Booking number / mobile"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void lookupBooking()}
                    className="px-3 py-2 text-xs rounded bg-gray-900 text-white"
                  >
                    Load
                  </button>
                </div>
                {bookingLookupError ? <p className="text-xs text-red-600">{bookingLookupError}</p> : null}
                {selectedBooking ? (
                  <div className="rounded bg-gray-50 border border-gray-200 px-3 py-2 text-xs space-y-1">
                    <p className="font-medium text-gray-800">{selectedBooking.bookingNumber} · {selectedBooking.guestName}</p>
                    <p className="text-gray-600">Locker booked pending: {selectedBooking.services?.locker?.pending ?? 0}</p>
                    {(selectedBooking.services?.locker?.pending ?? 0) > 0 ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={selectedBooking.services?.locker?.pending ?? 1}
                          value={deliverQty}
                          onChange={(event) => setDeliverQty(event.target.value)}
                          className="w-20 border border-gray-200 rounded px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => void deliverBookedLocker()}
                          className="px-2 py-1 text-xs rounded bg-indigo-600 text-white"
                        >
                          Deliver Booked
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <label htmlFor="locker-select" className="block text-xs text-gray-500 mb-1">Locker</label>
                <select
                  id="locker-select"
                  value={selectedLockerId}
                  onChange={(event) => setSelectedLockerId(event.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select locker</option>
                  {availableLockers.map((locker) => (
                    <option key={locker.id} value={locker.id}>
                      {locker.number} · {locker.zone.name} · {locker.size} · ₹{Number(locker.rate).toFixed(2)} + {Number(locker.gstRate ?? 18).toFixed(1)}% GST
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="locker-guest-name" className="block text-xs text-gray-500 mb-1">Guest Name</label>
                <input
                  id="locker-guest-name"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  readOnly={Boolean(selectedBooking)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="locker-guest-mobile" className="block text-xs text-gray-500 mb-1">Guest Mobile</label>
                <input
                  id="locker-guest-mobile"
                  value={guestMobile}
                  onChange={(event) => setGuestMobile(event.target.value)}
                  maxLength={10}
                  readOnly={Boolean(selectedBooking)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="locker-duration-type" className="block text-xs text-gray-500 mb-1">Duration Type</label>
                <select
                  id="locker-duration-type"
                  value={durationType}
                  onChange={(event) => setDurationType(event.target.value as "HOURLY" | "FULL_DAY")}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="FULL_DAY">Full Day</option>
                  <option value="HOURLY">Hourly</option>
                </select>
              </div>
              <div>
                <label htmlFor="locker-duration-hours" className="block text-xs text-gray-500 mb-1">Hours (hourly only)</label>
                <input
                  id="locker-duration-hours"
                  type="number"
                  min={1}
                  max={12}
                  value={durationHours}
                  onChange={(event) => setDurationHours(event.target.value)}
                  disabled={durationType !== "HOURLY"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="locker-amount" className="block text-xs text-gray-500 mb-1">Amount</label>
                <input
                  id="locker-amount"
                  type="text"
                  readOnly
                  value={computedAmount.toFixed(2)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Auto-calculated from locker configured rate{durationType === "HOURLY" ? " × hours" : ""}.
                </p>
              </div>
              <div>
                <label htmlFor="locker-payment-method" className="block text-xs text-gray-500 mb-1">Payment Method</label>
                <select
                  id="locker-payment-method"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="CASH">Cash</option>
                  <option value="MANUAL_UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="COMPLIMENTARY">Complimentary</option>
                </select>
              </div>
            </div>
            {error ? <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p> : null}
            <button
              type="button"
              onClick={() => void handleAssign()}
              disabled={assigning}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg"
            >
              {assigning ? "Assigning…" : "Assign Locker"}
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto bg-white rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Release Assigned Locker</h3>
            {assignedLockers.length === 0 ? (
              <p className="text-sm text-gray-500">No assigned lockers found.</p>
            ) : (
              assignedLockers.map((locker) => (
                <div key={locker.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{locker.number}</p>
                    <p className="text-xs text-gray-500">{locker.zone.name} · {locker.size}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRelease(locker.id)}
                    disabled={releasing}
                    className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded"
                  >
                    Release
                  </button>
                </div>
              ))
            )}
            {error ? <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p> : null}
          </div>
        )}
      </div>

      {receiptRef ? (
        <ReceiptModal receiptId={receiptRef} type="locker" onClose={() => setReceiptRef(null)} />
      ) : null}
      {showCloser ? (
        <SessionCloser sessionId={sessionId} onClosed={onSessionClosed} onCancel={() => setShowCloser(false)} />
      ) : null}
    </div>
  );
}
