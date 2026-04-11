import Link from "next/link";
import { CreditCard, HandCoins, Landmark, SplitSquareVertical } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";
import { normalizePaymentMethod, paymentMethodLabel } from "@/lib/payment-methods";

export interface RecentBookingRow {
  id: string;
  bookingNumber: string;
  guestName: string;
  guestMobile: string;
  visitDate: string;
  amount: number;
  status: string;
  methods: Array<{ method: string; amount: number }>;
}

export interface RecentBookingsTableProps {
  rows: RecentBookingRow[];
}

function statusVariant(status: string): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "CONFIRMED" || status === "COMPLETED") return "success";
  if (status === "PENDING" || status === "PARTIALLY_PAID") return "warning";
  if (status === "CANCELLED") return "danger";
  return "info";
}

function methodIcon(method: string): JSX.Element {
  const normalized = normalizePaymentMethod(method);
  if (normalized === "GATEWAY") return <CreditCard className="h-4 w-4" />;
  if (normalized === "MANUAL_UPI") return <Landmark className="h-4 w-4" />;
  if (normalized === "CASH") return <HandCoins className="h-4 w-4" />;
  return <SplitSquareVertical className="h-4 w-4" />;
}

export function RecentBookingsTable({ rows }: RecentBookingsTableProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Recent Bookings</h3>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
              <th className="py-2 pr-2">Booking No.</th>
              <th className="py-2 pr-2">Guest</th>
              <th className="py-2 pr-2">Mobile</th>
              <th className="py-2 pr-2">Visit Date</th>
              <th className="py-2 pr-2">Amount</th>
              <th className="py-2 pr-2">Payment</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--color-border)] last:border-b-0">
                <td className="py-2 pr-2 text-[var(--color-text)]">{row.bookingNumber}</td>
                <td className="py-2 pr-2 text-[var(--color-text)]">{row.guestName}</td>
                <td className="py-2 pr-2">{row.guestMobile}</td>
                <td className="py-2 pr-2">{new Date(row.visitDate).toLocaleDateString("en-IN")}</td>
                <td className="py-2 pr-2 text-[var(--color-text)]">Rs {row.amount.toFixed(0)}</td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    {row.methods.slice(0, 3).map((method, index) => (
                      <span key={`${method.method}-${index}`} className="text-[var(--color-text-muted)]">
                        {methodIcon(method.method)}
                      </span>
                    ))}
                    {row.methods.length > 1 ? (
                      <Tooltip
                        content={
                          <div className="space-y-1 text-left">
                            {row.methods.map((method, idx) => (
                              <p key={`${method.method}-${idx}`}>{paymentMethodLabel(method.method)}: Rs {method.amount.toFixed(0)}</p>
                            ))}
                          </div>
                        }
                      >
                        <span className="inline-flex cursor-help items-center text-xs text-[var(--color-primary)]">Split</span>
                      </Tooltip>
                    ) : null}
                  </div>
                </td>
                <td className="py-2 pr-2">
                  <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                </td>
                <td className="py-2 pr-2">
                  <Link href={`/admin/bookings/${row.id}`} className="text-[var(--color-primary)] underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
