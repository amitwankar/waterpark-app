import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface SplitSummaryRow {
  id: string;
  method: "GATEWAY" | "MANUAL_UPI" | "CASH" | "WRISTBAND";
  amount: number;
  status: "PENDING" | "PAID" | "FAILED" | "REJECTED" | "REFUNDED";
  splitIndex?: number | null;
}

export interface SplitSummaryCardProps {
  rows: SplitSummaryRow[];
  totalAmount: number;
  totalPaid: number;
  balanceDue: number;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function methodLabel(method: SplitSummaryRow["method"]): string {
  if (method === "GATEWAY") return "Online (Razorpay)";
  if (method === "MANUAL_UPI") return "UPI Transfer";
  if (method === "CASH") return "Cash at Gate";
  return "Wristband";
}

function statusBadge(status: SplitSummaryRow["status"]): { label: string; variant: "success" | "warning" | "danger" | "info" } {
  if (status === "PAID") return { label: "Paid", variant: "success" };
  if (status === "PENDING") return { label: "Pending", variant: "warning" };
  if (status === "FAILED" || status === "REJECTED") return { label: "Failed", variant: "danger" };
  return { label: "Refunded", variant: "info" };
}

export function SplitSummaryCard({ rows, totalAmount, totalPaid, balanceDue }: SplitSummaryCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">Payment Split Summary</h3>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                <th className="py-2 pr-2 font-medium">#</th>
                <th className="py-2 pr-2 font-medium">Method</th>
                <th className="py-2 pr-2 font-medium">Amount</th>
                <th className="py-2 pr-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const badge = statusBadge(row.status);
                return (
                  <tr key={row.id} className="border-b border-[var(--color-border)] last:border-b-0">
                    <td className="py-2 pr-2 text-[var(--color-text-muted)]">{row.splitIndex ?? index + 1}</td>
                    <td className="py-2 pr-2 text-[var(--color-text)]">{methodLabel(row.method)}</td>
                    <td className="py-2 pr-2 font-medium text-[var(--color-text)]">{formatInr(row.amount)}</td>
                    <td className="py-2 pr-2">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm sm:grid-cols-3">
          <p>Total: <span className="font-semibold text-[var(--color-text)]">{formatInr(totalAmount)}</span></p>
          <p>Paid: <span className="font-semibold text-[var(--color-text)]">{formatInr(totalPaid)}</span></p>
          <p>Due: <span className="font-semibold text-[var(--color-text)]">{formatInr(balanceDue)}</span></p>
        </div>
      </CardBody>
    </Card>
  );
}
