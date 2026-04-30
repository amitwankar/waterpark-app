import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingQR } from "@/components/booking/BookingQR";
import { BookingStatusBadge } from "@/components/booking/BookingStatusBadge";
import { Button } from "@/components/ui/Button";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PrintButton } from "./PrintButton";

interface ConfirmationPageProps {
  params: Promise<{ bookingNumber: string }> | { bookingNumber: string };
}

export default async function BookingConfirmationPage({ params }: ConfirmationPageProps): Promise<JSX.Element> {
  const resolved = await Promise.resolve(params);
  const bookingNumber = resolved.bookingNumber;

  const [booking, parkConfig] = await Promise.all([
    db.booking.findUnique({
      where: { bookingNumber },
      include: {
        bookingTickets: {
          include: { ticketType: { select: { name: true } } },
        },
        transactions: {
          where: { status: "PAID" },
          select: { amount: true, paymentMethod: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    db.parkConfig.findFirst({ select: { parkName: true } }),
  ]);

  if (!booking) {
    notFound();
  }

  const parkName = parkConfig?.parkName ?? "Waterpark";
  const subtotal = Number(booking.subtotal);
  const gstAmount = Number(booking.gstAmount);
  const discountAmount = Number(booking.discountAmount);
  const totalAmount = Number(booking.totalAmount);
  const totalPaid = booking.transactions.reduce((s, t) => s + Number(t.amount), 0);
  const balance = Math.max(0, totalAmount - totalPaid);

  const METHOD_LABELS: Record<string, string> = {
    CASH: "Cash",
    MANUAL_UPI: "UPI",
    CARD: "Card",
    COMPLIMENTARY: "Complimentary",
    GATEWAY: "Online",
  };

  return (
    <>
      {/* Print styles — hide UI chrome, let receipt fill the page */}
      <style>{`
        @media print {
          @page { size: auto; margin: 8mm; }
          .no-print { display: none !important; }
          body > * { visibility: hidden; }
          #booking-receipt, #booking-receipt * { visibility: visible; }
          #booking-receipt {
            position: fixed; top: 0; left: 0;
            width: 100%; padding: 0;
          }
        }
      `}</style>

      <div className="mx-auto max-w-2xl space-y-4">
        {/* Action bar — hidden on print */}
        <div className="no-print flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookingStatusBadge status={booking.status} />
            <span className="text-sm text-[var(--color-text-muted)]">Booking {booking.bookingNumber}</span>
          </div>
          <PrintButton />
        </div>

        {/* Receipt — this is what prints */}
        <div id="booking-receipt" className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

          {/* Header */}
          <div className="bg-teal-600 text-white px-6 py-5 text-center space-y-1">
            <p className="text-lg font-bold tracking-wide">{parkName}</p>
            <p className="text-sm opacity-80">Booking Receipt</p>
          </div>

          <div className="px-6 py-5 space-y-5 font-mono text-sm">

            {/* Booking meta */}
            <div className="space-y-1">
              <ReceiptRow label="Booking #" value={booking.bookingNumber} bold />
              <ReceiptRow label="Status" value={booking.status} />
              <ReceiptRow label="Created" value={new Date(booking.createdAt).toLocaleString("en-IN")} />
            </div>

            <Divider />

            {/* Guest info */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Guest</p>
              <ReceiptRow label="Name" value={booking.guestName} />
              <ReceiptRow label="Mobile" value={booking.guestMobile} />
              {booking.guestEmail ? <ReceiptRow label="Email" value={booking.guestEmail} /> : null}
              <ReceiptRow label="Visit Date" value={formatDate(booking.visitDate)} bold />
            </div>

            <Divider />

            {/* Items */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Items</p>
              {booking.bookingTickets.length > 0 ? (
                booking.bookingTickets.map((bt) => (
                  <ReceiptRow
                    key={bt.id}
                    label={`${bt.ticketType.name} × ${bt.quantity}`}
                    value={formatCurrency(Number(bt.unitPrice) * bt.quantity)}
                  />
                ))
              ) : (
                <p className="text-xs text-gray-400 italic">Package / add-ons (collected at counter)</p>
              )}
            </div>

            <Divider />

            {/* Pricing */}
            <div className="space-y-1">
              <ReceiptRow label="Subtotal" value={formatCurrency(subtotal + discountAmount)} />
              {discountAmount > 0 ? (
                <ReceiptRow label="Discount" value={`−${formatCurrency(discountAmount)}`} />
              ) : null}
              <ReceiptRow label="Subtotal (after disc.)" value={formatCurrency(subtotal)} />
              <ReceiptRow label="GST" value={formatCurrency(gstAmount)} />
              <div className="flex justify-between border-t border-dashed border-gray-300 pt-2 mt-1 font-bold text-base">
                <span>Total</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {/* Payment lines */}
            {booking.transactions.length > 0 ? (
              <>
                <Divider />
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Payment</p>
                  {booking.transactions.map((t, i) => (
                    <ReceiptRow
                      key={i}
                      label={METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod}
                      value={formatCurrency(Number(t.amount))}
                    />
                  ))}
                  <ReceiptRow label="Total Paid" value={formatCurrency(totalPaid)} bold />
                  {balance > 0 ? (
                    <ReceiptRow label="Balance Due at Counter" value={formatCurrency(balance)} bold />
                  ) : null}
                </div>
              </>
            ) : null}

            <Divider />

            {/* QR — for POS use, not gate entry */}
            <div className="flex flex-col items-center gap-2 py-2">
              <BookingQR value={booking.qrCode} bookingNumber={booking.bookingNumber} size={180} />
              <div className="text-center space-y-0.5">
                <p className="text-xs font-semibold text-gray-700">Show this QR at the ticket counter</p>
                <p className="text-xs text-gray-400">This QR is for counter use only — not for gate entry</p>
              </div>
            </div>

            <Divider />

            <p className="text-center text-xs text-gray-400">Thank you for your booking! See you at {parkName}.</p>
          </div>
        </div>

        {/* Payment pending action — hidden on print */}
        {booking.status === "PENDING" && balance > 0 ? (
          <div className="no-print rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-amber-900">Balance due: {formatCurrency(balance)}</p>
              <p className="text-sm text-amber-700">Pay the remaining balance at the ticket counter on your visit date.</p>
            </div>
            <Link href="/guest/my-account/bookings">
              <Button>My Bookings</Button>
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
}

function Divider(): JSX.Element {
  return <div className="border-t border-dashed border-gray-200" />;
}

interface ReceiptRowProps {
  label: string;
  value: string;
  bold?: boolean;
}

function ReceiptRow({ label, value, bold = false }: ReceiptRowProps): JSX.Element {
  return (
    <div className={`flex justify-between gap-3 ${bold ? "font-semibold text-gray-900" : "text-gray-600"}`}>
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
