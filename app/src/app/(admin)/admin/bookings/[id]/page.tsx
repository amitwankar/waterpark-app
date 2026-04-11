"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { BookingQR } from "@/components/booking/BookingQR";
import { BookingStatusBadge } from "@/components/booking/BookingStatusBadge";
import { ParticipantTable } from "@/components/booking/ParticipantTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BookingDetail {
  id: string;
  bookingNumber: string;
  bookedBy?: {
    id: string;
    name: string;
    role: string;
    subRole: string | null;
  } | null;
  guestName: string;
  guestMobile: string;
  guestEmail: string | null;
  visitDate: string;
  adults: number;
  children: number;
  idProofType: string | null;
  idProofLabel: string | null;
  idProofMasked: string | null;
  subtotal: number;
  gstAmount: number;
  discountAmount: number;
  totalAmount: number;
  status: string;
  qrCode: string;
  notes: string | null;
  bookingTickets: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    ticketType: {
      id: string;
      name: string;
      description: string | null;
    };
  }>;
  participants: Array<{
    id: string;
    name: string;
    gender: "MALE" | "FEMALE" | "OTHER" | null;
    age: number | null;
    isLeadGuest: boolean;
    ticketType: {
      name: string;
    };
  }>;
  transactions: Array<{
    id: string;
    method: string;
    status: string;
    amount: number;
    createdAt: string;
    paymentId: string | null;
    gatewayRef: string | null;
  }>;
}

function AdminBookingDetailContent(): JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [booking, setBooking] = useState<BookingDetail | null>(null);

  async function loadDetail(): Promise<void> {
    if (!params?.id) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/bookings/${params.id}`, { method: "GET" });
      const payload = (await response.json().catch(() => null)) as { booking?: BookingDetail } | null;
      if (!response.ok || !payload?.booking) {
        throw new Error("Could not load booking");
      }
      setBooking(payload.booking);
    } catch (error) {
      pushToast({
        title: "Failed to load booking",
        message: (error as Error).message,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id]);

  if (loading || !booking) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title={`Booking ${booking.bookingNumber}`} subtitle="Booking detail, tickets, payments, and actions." />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Booking Details</h2>
            <BookingStatusBadge status={booking.status} />
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-3 text-sm text-[var(--color-text-muted)] sm:grid-cols-2">
              <InfoRow label="Guest Name" value={booking.guestName} />
              <InfoRow label="Booked By" value={booking.bookedBy?.name ?? "System"} />
              <InfoRow label="Mobile" value={booking.guestMobile} />
              <InfoRow label="Email" value={booking.guestEmail ?? "N/A"} />
              <InfoRow label="Visit Date" value={formatDate(booking.visitDate)} />
              <InfoRow label="Adults" value={String(booking.adults)} />
              <InfoRow label="Children" value={String(booking.children)} />
              <InfoRow
                label="ID Proof"
                value={
                  booking.idProofMasked
                    ? `${booking.idProofLabel ? `${booking.idProofLabel} ` : ""}${booking.idProofMasked}`
                    : "Not provided"
                }
              />
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
              <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Ticket Breakdown</h3>
              <div className="space-y-2">
                {booking.bookingTickets.map((line) => (
                  <div key={line.id} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-muted)]">
                      {line.ticketType.name} x {line.quantity}
                    </span>
                    <span className="font-medium text-[var(--color-text)]">{formatCurrency(line.totalPrice)}</span>
                  </div>
                ))}
              </div>
            </div>

            <ParticipantTable participants={booking.participants} />

            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
              <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Amount Summary</h3>
              <div className="space-y-2 text-sm">
                <SummaryRow label="Subtotal" value={formatCurrency(booking.subtotal)} />
                <SummaryRow label="GST" value={formatCurrency(booking.gstAmount)} />
                <SummaryRow label="Discount" value={formatCurrency(booking.discountAmount)} />
                <SummaryRow label="Total" value={formatCurrency(booking.totalAmount)} highlight />
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
              <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Transaction History</h3>
              <div className="space-y-2 text-sm">
                {booking.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] p-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[var(--color-text)]">
                        {transaction.method} / {transaction.status}
                      </span>
                      <span className="text-[var(--color-text-muted)]">{formatCurrency(transaction.amount)}</span>
                    </div>
                    <span className="text-[var(--color-text-muted)]">{new Date(transaction.createdAt).toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <BookingQR value={booking.qrCode} bookingNumber={booking.bookingNumber} size={220} />

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--color-text)]">Actions</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                Check-in is handled only from POS. Share booking number/mobile at counter.
              </p>

              <Input
                label="Cancel Reason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Enter reason to cancel booking"
              />
              <Button
                variant="danger"
                className="w-full"
                disabled={actionLoading || cancelReason.trim().length < 3 || booking.status === "CANCELLED"}
                loading={actionLoading && cancelReason.trim().length >= 3}
                onClick={async () => {
                  setActionLoading(true);
                  try {
                    const response = await fetch(`/api/v1/bookings/${booking.id}/cancel`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ reason: cancelReason }),
                    });
                    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
                    if (!response.ok) {
                      throw new Error(payload?.message ?? "Cancellation failed");
                    }
                    pushToast({ title: "Booking cancelled", variant: "success" });
                    await loadDetail();
                  } catch (error) {
                    pushToast({
                      title: "Cancellation failed",
                      message: (error as Error).message,
                      variant: "error",
                    });
                  } finally {
                    setActionLoading(false);
                  }
                }}
              >
                Cancel Booking
              </Button>

              {booking.status === "CANCELLED" ? (
                <Button
                  variant="ghost"
                  className="w-full text-red-600"
                  disabled={actionLoading}
                  onClick={async () => {
                    const ok = window.confirm("Delete this cancelled booking permanently?");
                    if (!ok) return;
                    setActionLoading(true);
                    try {
                      const response = await fetch(`/api/v1/bookings/${booking.id}`, { method: "DELETE" });
                      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
                      if (!response.ok) {
                        throw new Error(payload?.message ?? "Delete failed");
                      }
                      pushToast({ title: "Booking deleted", variant: "success" });
                      router.push("/admin/bookings");
                    } catch (error) {
                      pushToast({
                        title: "Delete failed",
                        message: (error as Error).message,
                        variant: "error",
                      });
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                >
                  Delete Booking
                </Button>
              ) : null}

              <Button variant="outline" className="w-full" onClick={() => router.push("/admin/bookings")}>
                Back to Bookings
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AdminBookingDetailPage(): JSX.Element {
  return (
    <Suspense fallback={<div className="space-y-3"><Skeleton className="h-10 w-72" /><Skeleton className="h-80 w-full" /></div>}>
      <AdminBookingDetailContent />
    </Suspense>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps): JSX.Element {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 font-medium text-[var(--color-text)]">{value}</p>
    </div>
  );
}

interface SummaryRowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function SummaryRow({ label, value, highlight }: SummaryRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className={highlight ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}>{label}</span>
      <span className={highlight ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-text)]"}>{value}</span>
    </div>
  );
}
