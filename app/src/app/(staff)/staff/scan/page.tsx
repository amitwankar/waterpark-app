"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ScanLine,
  ChevronDown,
  RotateCcw,
  User,
  Phone,
  Calendar,
  Ticket,
  Waves,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { DeviceQrScanner } from "@/components/scan/DeviceQrScanner";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanMode = "gate" | "ride" | "locker" | "costume" | "info";

interface RideOption {
  id: string;
  name: string;
  status: string;
  queueCount: number;
}

interface TicketLine {
  id: string;
  ticketTypeName: string;
  ticketTypeId: string;
  rideId: string | null;
  quantity: number;
  unitPrice: number;
}

interface BookingDetails {
  id: string;
  bookingNumber: string;
  guestName: string;
  guestMobile: string;
  visitDate: string;
  status: string;
  totalAmount: number;
  checkedInAt: string | null;
  tickets: TicketLine[];
}

interface LookupResult {
  booking: BookingDetails;
  validity: {
    isValidDate: boolean;
    isValidStatus: boolean;
    gateUsed: boolean;
    canEnterGate: boolean;
  };
  rideUsage: Record<string, { used: number; allowed: number }>;
}

type ActionState =
  | { phase: "idle" }
  | { phase: "confirmed"; type: "success" | "warn"; message: string; subText?: string }
  | { phase: "confirmed"; type: "error"; message: string; subText?: string };

const MODE_LABELS: Record<ScanMode, string> = {
  gate: "Gate Entry",
  ride: "Ride Access",
  locker: "Locker Verify",
  costume: "Costume Verify",
  info: "Info Only",
};

const MODE_COLORS: Record<ScanMode, string> = {
  gate: "emerald",
  ride: "blue",
  locker: "indigo",
  costume: "purple",
  info: "gray",
};

const CONFIRM_BTN: Record<ScanMode, string> = {
  gate: "Grant Entry",
  ride: "Grant Ride Access",
  locker: "Mark Locker Used",
  costume: "Mark Costume Used",
  info: "Acknowledged",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string): JSX.Element {
  const classes: Record<string, string> = {
    CONFIRMED: "bg-emerald-100 text-emerald-800",
    CHECKED_IN: "bg-blue-100 text-blue-800",
    PENDING: "bg-amber-100 text-amber-800",
    CANCELLED: "bg-red-100 text-red-800",
    COMPLETED: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${classes[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ScanPage(): JSX.Element {
  const [mode, setMode] = useState<ScanMode>("gate");
  const [rides, setRides] = useState<RideOption[]>([]);
  const [ridesLoading, setRidesLoading] = useState(false);
  const [selectedRideId, setSelectedRideId] = useState("");
  const [guestCount, setGuestCount] = useState(1);

  const [scanInput, setScanInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [actionState, setActionState] = useState<ActionState>({ phase: "idle" });

  const inputRef = useRef<HTMLInputElement>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load rides when mode = ride
  useEffect(() => {
    if (mode !== "ride") return;
    setRidesLoading(true);
    void fetch("/api/v1/rides")
      .then((r) => r.json() as Promise<{ items?: RideOption[] }>)
      .then((d) => {
        const active = (d.items ?? []).filter((r) => r.status === "ACTIVE");
        setRides(active);
        if (active.length === 1) setSelectedRideId(active[0]!.id);
      })
      .finally(() => setRidesLoading(false));
  }, [mode]);

  // Reset lookup/action when mode changes
  const reset = useCallback(() => {
    setLookupResult(null);
    setLookupError(null);
    setActionState({ phase: "idle" });
    setScanInput("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => { reset(); }, [mode, reset]);

  // Auto-clear action result
  function scheduleReset(): void {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(reset, 7000);
  }

  // Lookup booking
  const doLookup = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q) return;

    setLooking(true);
    setLookupResult(null);
    setLookupError(null);
    setActionState({ phase: "idle" });

    try {
      const res = await fetch(`/api/v1/scan/lookup?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as LookupResult & { message?: string };
      if (!res.ok) {
        setLookupError(data.message ?? "Booking not found");
        return;
      }
      setLookupResult(data);
    } catch {
      setLookupError("Network error — check connection");
    } finally {
      setLooking(false);
    }
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter" && scanInput.trim()) {
      void doLookup(scanInput);
    }
  }

  // Confirm action
  async function handleConfirm(): Promise<void> {
    if (!lookupResult) return;
    const { booking } = lookupResult;
    setConfirming(true);

    try {
      if (mode === "gate" || mode === "info") {
        const res = await fetch("/api/v1/scan/gate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingNumber: booking.bookingNumber }),
        });
        const data = (await res.json()) as { success?: boolean; message?: string; reEntry?: boolean };

        if (!res.ok) {
          setActionState({ phase: "confirmed", type: "error", message: data.message ?? "Entry denied" });
        } else if (data.reEntry) {
          setActionState({ phase: "confirmed", type: "warn", message: "Re-entry scan", subText: data.message });
        } else {
          setActionState({ phase: "confirmed", type: "success", message: "Entry granted ✓", subText: `${booking.guestName} — ${booking.bookingNumber}` });
        }
      } else if (mode === "ride") {
        if (!selectedRideId) {
          setActionState({ phase: "confirmed", type: "error", message: "Select a ride first" });
          setConfirming(false);
          return;
        }
        const res = await fetch(`/api/v1/rides/${selectedRideId}/access-log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingNumber: booking.bookingNumber, guestCount }),
        });
        const data = (await res.json()) as {
          verified?: boolean;
          message?: string;
          remainingUses?: number;
          allowedUses?: number;
        };

        if (!res.ok || !data.verified) {
          setActionState({ phase: "confirmed", type: "error", message: data.message ?? "Access denied" });
        } else {
          const remaining = data.remainingUses ?? 0;
          setActionState({
            phase: "confirmed",
            type: "success",
            message: "Ride access granted ✓",
            subText: `${remaining} ride ${remaining === 1 ? "entry" : "entries"} remaining for this booking`,
          });
          // Update the local ride usage
          setLookupResult((prev) => {
            if (!prev) return prev;
            const updated = { ...prev.rideUsage };
            if (updated[selectedRideId]) {
              updated[selectedRideId] = {
                ...updated[selectedRideId],
                used: (updated[selectedRideId].used ?? 0) + guestCount,
              };
            }
            return { ...prev, rideUsage: updated };
          });
        }
      } else {
        // locker / costume — just show info
        setActionState({ phase: "confirmed", type: "success", message: "Scan acknowledged" });
      }
    } catch {
      setActionState({ phase: "confirmed", type: "error", message: "Network error" });
    } finally {
      setConfirming(false);
      scheduleReset();
    }
  }

  const colorSet = MODE_COLORS[mode];
  const accentCls = {
    emerald: { btn: "bg-emerald-600 hover:bg-emerald-700", badge: "bg-emerald-100 text-emerald-800", border: "border-emerald-500" },
    blue: { btn: "bg-blue-600 hover:bg-blue-700", badge: "bg-blue-100 text-blue-800", border: "border-blue-500" },
    indigo: { btn: "bg-indigo-600 hover:bg-indigo-700", badge: "bg-indigo-100 text-indigo-800", border: "border-indigo-500" },
    purple: { btn: "bg-purple-600 hover:bg-purple-700", badge: "bg-purple-100 text-purple-800", border: "border-purple-500" },
    gray: { btn: "bg-gray-600 hover:bg-gray-700", badge: "bg-gray-100 text-gray-700", border: "border-gray-400" },
  }[colorSet] ?? { btn: "bg-gray-600 hover:bg-gray-700", badge: "bg-gray-100 text-gray-700", border: "border-gray-400" };

  const canConfirm = (() => {
    if (!lookupResult) return false;
    const { validity } = lookupResult;
    if (mode === "gate") return validity.canEnterGate;
    if (mode === "ride") return selectedRideId.length > 0 && validity.isValidStatus;
    return true;
  })();

  const validityWarning = (() => {
    if (!lookupResult) return null;
    const { validity } = lookupResult;
    if (!validity.isValidDate) return "Ticket is NOT for today's date";
    if (!validity.isValidStatus) return `Booking status is ${lookupResult.booking.status} — entry not allowed`;
    if (mode === "gate" && validity.gateUsed) return "Already checked in — re-entry scan";
    return null;
  })();

  return (
    <div className="max-w-2xl mx-auto space-y-5 py-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentCls.badge}`}>
          <ScanLine className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">QR Scanner</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Scan or type a booking number to verify</p>
        </div>
      </div>

      {/* Mode + Ride selector row */}
      <Card>
        <CardBody className="space-y-3">
          <div>
            <label htmlFor="scan-mode" className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
              Scan Mode
            </label>
            <div className="relative">
              <select
                id="scan-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as ScanMode)}
                className="w-full appearance-none border border-[var(--color-border)] rounded-xl px-4 py-2.5 pr-10 text-sm font-medium bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="gate">🚪  Gate Entry — mark CHECKED_IN on first scan</option>
                <option value="ride">🎢  Ride Access — verify &amp; decrement ride ticket count</option>
                <option value="locker">🔐  Locker — verify locker assignment</option>
                <option value="costume">👘  Costume — verify costume rental</option>
                <option value="info">ℹ️  Info Only — show booking without any action</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
            </div>
          </div>

          {/* Ride selector */}
          {mode === "ride" && (
            <div className="space-y-2">
              <label htmlFor="scan-ride" className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                Select Ride
              </label>
              {ridesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <>
                  <div className="relative">
                    <select
                      id="scan-ride"
                      value={selectedRideId}
                      onChange={(e) => setSelectedRideId(e.target.value)}
                      className="w-full appearance-none border border-[var(--color-border)] rounded-xl px-4 py-2.5 pr-10 text-sm bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Choose a ride —</option>
                      {rides.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}  (Queue: {r.queueCount})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
                  </div>
                  {rides.length === 0 && (
                    <p className="text-xs text-amber-600">No active rides found.</p>
                  )}
                  <div className="flex items-center gap-2">
                    <label htmlFor="scan-guest-count" className="text-xs text-[var(--color-text-muted)]">Guests entering:</label>
                    <input
                      id="scan-guest-count"
                      type="number"
                      min={1}
                      max={20}
                      value={guestCount}
                      onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value)))}
                      className="w-16 border border-[var(--color-border)] rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Scan input */}
      <Card>
        <CardBody>
          <label htmlFor="scan-input" className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
            Scan QR or Enter Booking Number
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id="scan-input"
              type="text"
              autoComplete="off"
              autoFocus
              placeholder="Scan QR code or type booking number…"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={looking}
              className="flex-1 border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono disabled:opacity-50"
            />
            <Button
              onClick={() => void doLookup(scanInput)}
              disabled={!scanInput.trim() || looking}
              loading={looking}
            >
              Look up
            </Button>
            {(lookupResult || lookupError) && (
              <button
                type="button"
                title="Reset"
                onClick={reset}
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-zinc-100 transition-colors shrink-0"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
            Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">Enter</kbd> to look up immediately
          </p>
          <div className="mt-3">
            <DeviceQrScanner
              onDetected={(value) => {
                if (looking) return;
                setScanInput(value);
                void doLookup(value);
              }}
            />
          </div>
        </CardBody>
      </Card>

      {/* Error state */}
      {lookupError && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-red-300 bg-red-50 px-5 py-4">
          <XCircle className="h-6 w-6 text-red-600 shrink-0" />
          <p className="text-sm font-semibold text-red-800">{lookupError}</p>
        </div>
      )}

      {/* Booking details card */}
      {lookupResult && actionState.phase === "idle" && (
        <Card className={`border-2 ${accentCls.border}`}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-base font-bold text-[var(--color-text)]">{lookupResult.booking.guestName}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{lookupResult.booking.bookingNumber}</p>
            </div>
            {statusBadge(lookupResult.booking.status)}
          </CardHeader>
          <CardBody className="space-y-4">
            {/* Validity warning */}
            {validityWarning && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-sm font-medium text-amber-800">{validityWarning}</p>
              </div>
            )}

            {/* Guest info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <User className="h-4 w-4 shrink-0" />
                <span className="truncate">{lookupResult.booking.guestName}</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{lookupResult.booking.guestMobile}</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <Calendar className="h-4 w-4 shrink-0" />
                <span className={lookupResult.validity.isValidDate ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"}>
                  {formatDate(new Date(lookupResult.booking.visitDate))}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <span className="font-semibold text-[var(--color-text)]">{formatCurrency(lookupResult.booking.totalAmount)}</span>
              </div>
            </div>

            {/* Ticket lines */}
            <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {lookupResult.booking.tickets.map((t) => {
                const usage = t.rideId ? lookupResult.rideUsage[t.rideId] : null;
                return (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      {t.rideId ? (
                        <Waves className="h-4 w-4 text-blue-500 shrink-0" />
                      ) : (
                        <Ticket className="h-4 w-4 text-teal-500 shrink-0" />
                      )}
                      <span className="text-[var(--color-text)]">{t.ticketTypeName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className="text-[var(--color-text-muted)]">× {t.quantity}</span>
                      {usage !== null && usage !== undefined ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          usage.used >= usage.allowed ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                        }`}>
                          {usage.used}/{usage.allowed} used
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Ride usage summary for ride mode */}
            {mode === "ride" && selectedRideId && lookupResult.rideUsage[selectedRideId] !== undefined && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-center justify-between">
                <p className="text-sm font-medium text-blue-800">Ride entries for this booking</p>
                <div className="text-right">
                  {(() => {
                    const u = lookupResult.rideUsage[selectedRideId]!;
                    const remaining = u.allowed - u.used;
                    return (
                      <p className={`text-xl font-bold ${remaining > 0 ? "text-blue-700" : "text-red-700"}`}>
                        {remaining} <span className="text-sm font-normal">remaining</span>
                      </p>
                    );
                  })()}
                  <p className="text-xs text-blue-600">{lookupResult.rideUsage[selectedRideId]!.used} / {lookupResult.rideUsage[selectedRideId]!.allowed} used</p>
                </div>
              </div>
            )}

            {mode === "ride" && selectedRideId && !lookupResult.rideUsage[selectedRideId] && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm font-semibold text-red-800">This booking has no tickets for the selected ride</p>
              </div>
            )}

            {/* Confirm button */}
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={confirming || !canConfirm}
              className={`w-full text-white font-bold py-3.5 rounded-xl transition-colors text-base disabled:opacity-40 ${accentCls.btn}`}
            >
              {confirming ? "Processing…" : CONFIRM_BTN[mode]}
            </button>

            {!canConfirm && !validityWarning && mode === "ride" && !selectedRideId && (
              <p className="text-xs text-center text-amber-600">Select a ride above to enable confirm</p>
            )}
          </CardBody>
        </Card>
      )}

      {/* Action result */}
      {actionState.phase === "confirmed" && (
        <div
          className={`rounded-2xl border-2 p-6 text-center space-y-2 ${
            actionState.type === "success"
              ? "border-emerald-400 bg-emerald-50"
              : actionState.type === "warn"
              ? "border-amber-400 bg-amber-50"
              : "border-red-400 bg-red-50"
          }`}
        >
          {actionState.type === "success" ? (
            <CheckCircle2 className="h-14 w-14 text-emerald-600 mx-auto" />
          ) : actionState.type === "warn" ? (
            <AlertTriangle className="h-14 w-14 text-amber-600 mx-auto" />
          ) : (
            <XCircle className="h-14 w-14 text-red-600 mx-auto" />
          )}
          <p
            className={`text-2xl font-bold ${
              actionState.type === "success" ? "text-emerald-800" :
              actionState.type === "warn" ? "text-amber-800" : "text-red-800"
            }`}
          >
            {actionState.message}
          </p>
          {actionState.subText && (
            <p className={`text-sm ${
              actionState.type === "success" ? "text-emerald-700" :
              actionState.type === "warn" ? "text-amber-700" : "text-red-700"
            }`}>
              {actionState.subText}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <RotateCcw className="h-4 w-4" />
            Scan next
          </button>
          <p className="text-xs text-gray-400">Auto-resets in 7 seconds</p>
        </div>
      )}

      {/* Instructions */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs text-[var(--color-text-muted)] space-y-1">
        <p className="font-semibold text-[var(--color-text)] mb-1">How to use</p>
        <p><span className="font-medium text-emerald-700">Gate Entry:</span> First-time scan marks booking CHECKED_IN. Re-scan shows a warning but still succeeds.</p>
        <p><span className="font-medium text-blue-700">Ride Access:</span> Select the ride, then scan. Each confirm uses 1 ride entry. Limit = tickets purchased for that ride.</p>
        <p><span className="font-medium text-indigo-700">Locker / Costume:</span> Shows booking details for staff to cross-reference assignment records.</p>
        <p><span className="font-medium text-gray-600">Info Only:</span> Shows all booking details without changing any status.</p>
      </div>
    </div>
  );
}
