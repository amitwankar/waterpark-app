"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, XCircle, QrCode, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { DeviceQrScanner } from "@/components/scan/DeviceQrScanner";

interface RideOption {
  id: string;
  name: string;
  status: string;
  queueCount: number;
}

interface ScanResult {
  type: "success" | "error";
  bookingNumber: string;
  message: string;
  guestName?: string;
  allowedUses?: number;
  usedUses?: number;
  remainingUses?: number;
}

export default function RideScanPage(): JSX.Element {
  const [rides, setRides] = useState<RideOption[]>([]);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [selectedRideId, setSelectedRideId] = useState<string>("");
  const [manualInput, setManualInput] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/v1/rides");
        const data = (await res.json()) as { items?: RideOption[] };
        const active = (data.items ?? []).filter((r) => r.status === "ACTIVE");
        setRides(active);
        if (active.length === 1) setSelectedRideId(active[0]!.id);
      } finally {
        setRidesLoading(false);
      }
    })();
  }, []);

  // Auto-focus input after result clears
  useEffect(() => {
    if (!lastResult) {
      inputRef.current?.focus();
    }
  }, [lastResult]);

  async function handleScan(rawInput: string): Promise<void> {
    if (!selectedRideId) return;

    // Support scanning QR JSON payload or plain booking number
    let bookingNumber = rawInput.trim();
    try {
      const parsed = JSON.parse(rawInput) as { bookingNumber?: string };
      if (parsed.bookingNumber) bookingNumber = parsed.bookingNumber;
    } catch {
      // not JSON — use as-is
    }

    if (!bookingNumber) return;

    setScanning(true);
    setLastResult(null);
    try {
      const res = await fetch(`/api/v1/rides/${selectedRideId}/access-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingNumber, guestCount }),
      });
      const data = (await res.json()) as {
        verified?: boolean;
        message?: string;
        allowedUses?: number;
        usedUses?: number;
        remainingUses?: number;
        items?: Array<{ id: string }>;
      };

      if (res.ok && data.verified) {
        setLastResult({
          type: "success",
          bookingNumber,
          message: data.message ?? "Ticket verified",
          allowedUses: data.allowedUses,
          usedUses: data.usedUses,
          remainingUses: data.remainingUses,
        });
      } else {
        setLastResult({
          type: "error",
          bookingNumber,
          message: data.message ?? "Verification failed",
          allowedUses: data.allowedUses,
          usedUses: data.usedUses,
          remainingUses: data.remainingUses,
        });
      }
    } catch {
      setLastResult({ type: "error", bookingNumber, message: "Network error — try again" });
    } finally {
      setScanning(false);
      setManualInput("");
      // Auto-clear result after 6 seconds
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      resultTimerRef.current = setTimeout(() => setLastResult(null), 6000);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter" && manualInput.trim()) {
      void handleScan(manualInput);
    }
  }

  const selectedRide = rides.find((r) => r.id === selectedRideId);

  return (
    <div className="max-w-lg mx-auto space-y-5 py-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-100 mb-3">
          <QrCode className="h-6 w-6 text-blue-600" />
        </div>
        <h1 className="text-xl font-bold text-[var(--color-text)]">Ride QR Scanner</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Select a ride, then scan or type the booking number.
        </p>
      </div>

      {/* Ride selector */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Select Ride</h2>
        </CardHeader>
        <CardBody>
          {ridesLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {rides.map((ride) => (
                <button
                  key={ride.id}
                  type="button"
                  onClick={() => setSelectedRideId(ride.id)}
                  className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-all ${
                    selectedRideId === ride.id
                      ? "border-blue-500 bg-blue-50 text-blue-800"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-blue-300"
                  }`}
                >
                  <span className="block font-semibold">{ride.name}</span>
                  <span className="text-xs opacity-70">Queue: {ride.queueCount}</span>
                </button>
              ))}
              {rides.length === 0 && (
                <p className="text-sm text-[var(--color-text-muted)] col-span-2">No active rides found.</p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Scanner input */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            Scan / Enter Booking
            {selectedRide ? <span className="ml-2 text-blue-600">— {selectedRide.name}</span> : null}
          </h2>
        </CardHeader>
        <CardBody className="space-y-3">
          {!selectedRideId ? (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              Select a ride above before scanning.
            </p>
          ) : null}

          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              title="Booking number or QR scan"
              placeholder="Scan QR or type booking number…"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!selectedRideId || scanning}
              className="flex-1 border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              autoFocus
              autoComplete="off"
            />
            <Button
              onClick={() => void handleScan(manualInput)}
              disabled={!selectedRideId || !manualInput.trim() || scanning}
              loading={scanning}
            >
              Verify
            </Button>
          </div>

          <DeviceQrScanner
            onDetected={(value) => {
              if (!selectedRideId || scanning) return;
              setManualInput(value);
              void handleScan(value);
            }}
          />

          <div className="flex items-center gap-3">
            <label htmlFor="scan-guest-count" className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
              Guest count:
            </label>
            <input
              id="scan-guest-count"
              type="number"
              min={1}
              max={20}
              value={guestCount}
              onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value)))}
              className="w-20 border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              (for group entry — default 1)
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Result panel */}
      {lastResult ? (
        <div
          className={`rounded-2xl border-2 p-5 flex items-start gap-4 transition-all ${
            lastResult.type === "success"
              ? "border-emerald-400 bg-emerald-50"
              : "border-red-400 bg-red-50"
          }`}
        >
          {lastResult.type === "success" ? (
            <CheckCircle className="h-8 w-8 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-8 w-8 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p
              className={`text-lg font-bold ${
                lastResult.type === "success" ? "text-emerald-800" : "text-red-800"
              }`}
            >
              {lastResult.type === "success" ? "✓ Verified" : "✗ Denied"}
            </p>
            <p
              className={`text-sm mt-0.5 ${
                lastResult.type === "success" ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {lastResult.message}
            </p>
            <p className="text-xs text-gray-500 mt-1">Booking: {lastResult.bookingNumber}</p>
            {lastResult.allowedUses !== undefined ? (
              <p className="text-xs text-gray-500 mt-0.5">
                Uses: {lastResult.usedUses}/{lastResult.allowedUses} &nbsp;·&nbsp; Remaining:{" "}
                <span className={lastResult.remainingUses === 0 ? "text-red-600 font-semibold" : "font-semibold"}>
                  {lastResult.remainingUses}
                </span>
              </p>
            ) : null}
          </div>
          <button
            type="button"
            title="Dismiss"
            onClick={() => setLastResult(null)}
            className="text-gray-400 hover:text-gray-600 shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Instructions */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4 text-xs text-[var(--color-text-muted)] space-y-1.5">
        <p className="font-semibold text-[var(--color-text)]">How it works</p>
        <p>1. Select the ride the guest is entering.</p>
        <p>2. Scan their QR ticket or type the booking number and press Enter.</p>
        <p>3. Green = verified &amp; entry logged. Red = ticket invalid or limit reached.</p>
        <p>4. Each scan decrements the ride queue by the guest count.</p>
        <p>5. Ticket limits are enforced — if a booking purchased 5 ride entries, only 5 are allowed.</p>
      </div>
    </div>
  );
}
