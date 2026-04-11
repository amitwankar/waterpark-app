import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingQR } from "@/components/booking/BookingQR";
import { BookingStatusBadge } from "@/components/booking/BookingStatusBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ConfirmationPageProps {
  params: Promise<{ bookingNumber: string }> | { bookingNumber: string };
}

export default async function BookingConfirmationPage({ params }: ConfirmationPageProps): Promise<JSX.Element> {
  const resolved = await Promise.resolve(params);
  const bookingNumber = resolved.bookingNumber;

  const booking = await db.booking.findUnique({
    where: { bookingNumber },
    include: {
      bookingTickets: {
        include: {
          ticketType: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!booking) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text)]">Booking Confirmed</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Booking number: {booking.bookingNumber}</p>
          </div>
          <BookingStatusBadge status={booking.status} />
        </CardHeader>
        <CardBody className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 text-sm text-[var(--color-text-muted)]">
            <InfoRow label="Guest Name" value={booking.guestName} />
            <InfoRow label="Mobile" value={booking.guestMobile} />
            <InfoRow label="Visit Date" value={formatDate(booking.visitDate)} />
            <InfoRow label="Adults" value={String(booking.adults)} />
            <InfoRow label="Children" value={String(booking.children)} />
            <InfoRow label="Total Amount" value={formatCurrency(Number(booking.totalAmount))} />
            <div>
              <p className="font-medium text-[var(--color-text)]">Ticket Breakdown</p>
              <ul className="mt-2 space-y-1">
                {booking.bookingTickets.map((line) => (
                  <li key={line.id}>
                    {line.ticketType.name}: {line.quantity} x {formatCurrency(Number(line.unitPrice))}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <BookingQR value={booking.qrCode} bookingNumber={booking.bookingNumber} size={260} />
        </CardBody>
      </Card>

      {booking.status === "PENDING" ? (
        <Card>
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-[var(--color-text)]">Payment pending</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                Your booking is created but payment is not completed yet.
              </p>
            </div>
            <Link href="/guest/my-account/bookings">
              <Button>Proceed to Payment</Button>
            </Link>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-1.5">
      <span>{label}</span>
      <span className="font-medium text-[var(--color-text)]">{value}</span>
    </div>
  );
}
