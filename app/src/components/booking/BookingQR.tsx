"use client";

import QRCode from "react-qr-code";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface BookingQRProps {
  value: string;
  bookingNumber?: string;
  size?: number;
}

export function BookingQR({ value, bookingNumber, size = 220 }: BookingQRProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Entry QR Code</h3>
      </CardHeader>
      <CardBody className="flex flex-col items-center gap-3">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4">
          <QRCode value={value} size={size} />
        </div>
        {bookingNumber ? <p className="text-sm text-[var(--color-text-muted)]">Booking: {bookingNumber}</p> : null}
      </CardBody>
    </Card>
  );
}

