import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";

export interface DepositOptionCardProps {
  totalAmount: number;
  depositAmount: number;
  balanceDue: number;
  depositPercent: number;
  depositLabel: string;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DepositOptionCard({
  totalAmount,
  depositAmount,
  balanceDue,
  depositPercent,
  depositLabel,
}: DepositOptionCardProps): JSX.Element {
  return (
    <Card className="border-amber-300 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20">
      <CardBody className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Pre-Booking Deposit</p>
          <Badge variant="warning">{depositPercent}% Advance</Badge>
        </div>
        <p className="text-sm text-amber-800 dark:text-amber-300">{depositLabel}</p>
        <div className="grid gap-1 text-sm text-amber-900 dark:text-amber-200 sm:grid-cols-3">
          <p>Total: {formatInr(totalAmount)}</p>
          <p>Pay now: {formatInr(depositAmount)}</p>
          <p>At gate: {formatInr(balanceDue)}</p>
        </div>
      </CardBody>
    </Card>
  );
}
