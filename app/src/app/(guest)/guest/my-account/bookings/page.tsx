"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { BookingStatusBadge } from "@/components/booking/BookingStatusBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Ticket } from "lucide-react";

interface BookingItem {
  id: string;
  bookingNumber: string;
  visitDate: string;
  status: string;
  adults: number;
  children: number;
  totalAmount: number;
}

export default function GuestBookingsPage(): JSX.Element {
  const [loading, setLoading] = useState<boolean>(true);
  const [bookings, setBookings] = useState<BookingItem[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/v1/bookings?page=1&limit=50", { method: "GET" });
        const payload = (await response.json().catch(() => ({ items: [] }))) as { items: BookingItem[] };
        if (response.ok) {
          setBookings(payload.items ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={Ticket}
        title="No bookings yet"
        message="Your upcoming and past bookings will appear here."
        action={
          <Link href="/booking">
            <Button>Book Now</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <Card key={booking.id}>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-[var(--color-text)]">{booking.bookingNumber}</p>
              <p className="text-sm text-[var(--color-text-muted)]">Visit Date: {formatDate(booking.visitDate)}</p>
            </div>
            <BookingStatusBadge status={booking.status} />
          </CardHeader>
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-[var(--color-text-muted)]">
              <p>Adults: {booking.adults}</p>
              <p>Children: {booking.children}</p>
              <p className="font-semibold text-[var(--color-text)]">{formatCurrency(booking.totalAmount)}</p>
            </div>
            <Link href={`/booking/confirmation/${booking.bookingNumber}`}>
              <Button variant="outline">View Details</Button>
            </Link>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

