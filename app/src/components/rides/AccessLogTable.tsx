import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface AccessLogTableProps {
  rows: Array<{
    id: string;
    scannedAt: string;
    bookingNumber: string;
    guestName: string;
    guestMobile: string;
    rideName: string;
  }>;
}

export function AccessLogTable({ rows }: AccessLogTableProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Ride Access Logs</h3>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
              <th className="py-2 pr-2">Time</th>
              <th className="py-2 pr-2">Booking</th>
              <th className="py-2 pr-2">Guest</th>
              <th className="py-2 pr-2">Mobile</th>
              <th className="py-2 pr-2">Ride</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--color-border)] last:border-b-0">
                <td className="py-2 pr-2">{new Date(row.scannedAt).toLocaleString("en-IN")}</td>
                <td className="py-2 pr-2">{row.bookingNumber}</td>
                <td className="py-2 pr-2">{row.guestName}</td>
                <td className="py-2 pr-2">{row.guestMobile}</td>
                <td className="py-2 pr-2">{row.rideName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
