"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, CreditCard, Ticket } from "lucide-react";

import { BookingStatusBadge } from "@/components/booking/BookingStatusBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PendingBooking {
  id: string;
  bookingNumber: string;
  visitDate: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
}

export default function GuestPaymentIndexPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<PendingBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/bookings?status=PENDING&limit=20");
        if (res.ok) {
          const data = await res.json();
          setBookings(data.items ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-teal-100 mb-3">
            <CreditCard className="w-7 h-7 text-teal-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Complete Payment</h1>
          <p className="text-gray-500 mt-1">Select a pending booking to complete payment</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardBody className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-40" />
                </CardBody>
              </Card>
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={Ticket}
                title="No pending payments"
                message="You don't have any bookings awaiting payment."
                action={
                  <Link href="/booking">
                    <Button icon={Calendar}>Book Tickets</Button>
                  </Link>
                }
              />
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <Card key={b.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">{b.bookingNumber}</p>
                        <BookingStatusBadge status={b.status} />
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Visit: {formatDate(b.visitDate)}
                      </p>
                      <div className="mt-2 space-y-0.5 text-sm">
                        <p className="text-gray-600">Total: <span className="font-medium">{formatCurrency(b.totalAmount)}</span></p>
                        {b.paidAmount > 0 && (
                          <p className="text-green-600">Paid: <span className="font-medium">{formatCurrency(b.paidAmount)}</span></p>
                        )}
                        <p className="text-red-600 font-semibold">Due: {formatCurrency(b.balanceDue)}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => router.push(`/guest/payment/${b.id}`)}
                      className="shrink-0"
                    >
                      Pay Now
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center">
          <Link href="/guest/my-account/bookings" className="text-sm text-teal-600 hover:underline">
            View all bookings
          </Link>
        </div>
      </div>
    </div>
  );
}
