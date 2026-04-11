import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface GuestBookingRow {
  id: string;
  bookingNumber: string;
  visitDate: string;
  status: string;
  totalAmount: number;
  paymentStatus: string;
}

export interface GuestBookingsTabProps {
  rows: GuestBookingRow[];
}

export function GuestBookingsTab({ rows }: GuestBookingsTabProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Bookings</h3>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
              <th className="py-2 pr-2">Booking No.</th>
              <th className="py-2 pr-2">Visit Date</th>
              <th className="py-2 pr-2">Amount</th>
              <th className="py-2 pr-2">Booking Status</th>
              <th className="py-2 pr-2">Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--color-border)] last:border-b-0">
                <td className="py-2 pr-2 text-[var(--color-text)]">{row.bookingNumber}</td>
                <td className="py-2 pr-2">{new Date(row.visitDate).toLocaleDateString("en-IN")}</td>
                <td className="py-2 pr-2">Rs {row.totalAmount.toFixed(0)}</td>
                <td className="py-2 pr-2">{row.status}</td>
                <td className="py-2 pr-2">{row.paymentStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
