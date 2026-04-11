import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";

export interface UpiQueueItem {
  id: string;
  bookingNumber: string;
  amount: number;
  minutesAgo: number;
}

export interface UpiQueueStripProps {
  items: UpiQueueItem[];
}

export function UpiQueueStrip({ items }: UpiQueueStripProps): JSX.Element | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Pending UPI Queue</p>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {items.map((item) => (
            <div key={item.id} className="min-w-56 rounded-[var(--radius-md)] border border-amber-300 bg-white p-3 dark:border-amber-900 dark:bg-zinc-950">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-[var(--color-text)]">{item.bookingNumber}</p>
                <Badge variant="warning">{item.minutesAgo} min</Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">Rs {item.amount.toFixed(0)}</p>
              <Link href="/admin/payments/upi-queue" className="mt-2 inline-block text-xs text-[var(--color-primary)] underline">
                Verify Now
              </Link>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
