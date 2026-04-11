import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingQR } from "@/components/booking/BookingQR";
import { PaymentSuccessAnimation } from "@/components/payment/PaymentSuccessAnimation";
import { SplitSummaryCard } from "@/components/payment/SplitSummaryCard";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { db } from "@/lib/db";

interface SuccessPageProps {
  searchParams: Promise<{ bookingId?: string }> | { bookingId?: string };
}

function parseBalanceDue(notes?: string | null): number {
  if (!notes) return 0;
  const line = notes.split("\n").find((item) => item.startsWith("PAYMENT_META:"));
  if (!line) return 0;
  try {
    const meta = JSON.parse(line.slice("PAYMENT_META:".length)) as { balanceDue?: number };
    return typeof meta.balanceDue === "number" ? meta.balanceDue : 0;
  } catch {
    return 0;
  }
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function PaymentSuccessPage({ searchParams }: SuccessPageProps): Promise<JSX.Element> {
  const resolved = await Promise.resolve(searchParams);
  const bookingId = resolved.bookingId;
  if (!bookingId) {
    notFound();
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      transactions: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!booking) {
    notFound();
  }

  const totalAmount = Number(booking.totalAmount);
  const totalPaid = booking.transactions
    .filter((tx: any) => tx.status === "PAID")
    .reduce((acc: number, tx: any) => acc + Number(tx.amount), 0);
  const balanceDue = parseBalanceDue(booking.notes);

  const fullPaid = balanceDue <= 0 && booking.status === "CONFIRMED";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Card>
        <CardBody className="space-y-4 py-10 text-center">
          <PaymentSuccessAnimation />
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            {fullPaid ? "Payment Confirmed!" : "Booking Secured!"}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Booking {booking.bookingNumber} for {new Date(booking.visitDate).toLocaleDateString("en-IN")}
          </p>
        </CardBody>
      </Card>

      <SplitSummaryCard
        rows={booking.transactions.map((tx: any, index: number) => ({
          id: tx.id,
          method: tx.method,
          amount: Number(tx.amount),
          status: tx.status,
          splitIndex: index + 1,
        }))}
        totalAmount={totalAmount}
        totalPaid={totalPaid}
        balanceDue={balanceDue}
      />

      {!fullPaid ? (
        <Card className="border-amber-300 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20">
          <CardBody className="text-sm text-amber-900 dark:text-amber-200">
            Total due at gate: <span className="font-semibold">{formatInr(balanceDue)}</span>
          </CardBody>
        </Card>
      ) : null}

      <BookingQR value={booking.qrCode} bookingNumber={booking.bookingNumber} size={260} />

      <div className="flex justify-center gap-2">
        <Link href={`/booking/confirmation/${booking.bookingNumber}`}>
          <Button>View Booking Confirmation</Button>
        </Link>
        <Link href="/guest/my-account/bookings">
          <Button variant="outline">My Bookings</Button>
        </Link>
      </div>
    </div>
  );
}
