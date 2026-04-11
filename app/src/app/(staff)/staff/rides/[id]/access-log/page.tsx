"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";

import { AccessLogTable } from "@/components/rides/AccessLogTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";

interface AccessLogItem {
  id: string;
  scannedAt: string;
  booking: {
    bookingNumber: string;
    guestName: string;
    guestMobile: string;
  };
}

interface AccessLogResponse {
  items: AccessLogItem[];
}

export default function StaffRideAccessLogPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const rideId = String(params.id ?? "");

  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [bookingNumber, setBookingNumber] = useState("");
  const [guestCount, setGuestCount] = useState("1");
  const [rideName, setRideName] = useState("Ride");
  const [items, setItems] = useState<AccessLogItem[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadLogs(): Promise<void> {
    if (!rideId) return;
    setLoading(true);
    try {
      const [logsResponse, rideResponse] = await Promise.all([
        fetch(`/api/v1/rides/${rideId}/access-log`, { method: "GET" }),
        fetch(`/api/v1/rides/${rideId}`, { method: "GET" }),
      ]);

      const logsPayload = (await logsResponse.json().catch(() => ({ items: [] }))) as AccessLogResponse;
      const ridePayload = (await rideResponse.json().catch(() => null)) as { ride?: { name?: string } } | null;

      if (logsResponse.ok) {
        setItems(logsPayload.items ?? []);
      }
      if (rideResponse.ok && ridePayload?.ride?.name) {
        setRideName(ridePayload.ride.name);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [rideId]);

  return (
    <div className="space-y-5">
      <PageHeader title={`${rideName} Access Log`} subtitle="Log ride entries and review today's scans." />

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-[var(--color-text)]">Quick Log Entry</h2>
        </CardHeader>
        <CardBody className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
          <Input
            label="Booking number"
            value={bookingNumber}
            onChange={(event) => setBookingNumber(event.target.value.toUpperCase())}
            placeholder="WPXXXX"
          />
          <Input
            label="Guest count"
            type="number"
            min={1}
            max={20}
            value={guestCount}
            onChange={(event) => setGuestCount(event.target.value)}
          />
          <div className="flex items-end">
            <Button
              loading={isPending}
              className="w-full"
              onClick={() => {
                if (!bookingNumber.trim()) return;
                startTransition(() => {
                  void fetch(`/api/v1/rides/${rideId}/access-log`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bookingNumber: bookingNumber.trim(), guestCount: Number(guestCount || "1") }),
                  })
                    .then(async (response) => {
                      const payload = (await response.json().catch(() => null)) as
                        | { message?: string; remainingUses?: number }
                        | null;
                      if (!response.ok) {
                        setFeedback({ type: "error", text: payload?.message ?? "Verification failed" });
                        return;
                      }
                      const remain = payload?.remainingUses;
                      setFeedback({
                        type: "success",
                        text: remain !== undefined
                          ? `Verified. Remaining uses: ${remain}`
                          : "Verified successfully",
                      });
                      setBookingNumber("");
                      setGuestCount("1");
                      loadLogs();
                    })
                    .catch(() => {
                      setFeedback({ type: "error", text: "Verification failed" });
                    });
                });
              }}
            >
              Add Log
            </Button>
          </div>
        </CardBody>
      </Card>
      {feedback ? (
        <p className={`text-sm ${feedback.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
          {feedback.text}
        </p>
      ) : null}

      {loading ? <Skeleton className="h-72 w-full" /> : null}

      {!loading ? (
        <AccessLogTable
          rows={items.map((item) => ({
            id: item.id,
            scannedAt: item.scannedAt,
            bookingNumber: item.booking.bookingNumber,
            guestName: item.booking.guestName,
            guestMobile: item.booking.guestMobile,
            rideName,
          }))}
        />
      ) : null}
    </div>
  );
}
