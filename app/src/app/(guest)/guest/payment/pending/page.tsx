import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

export default function PaymentPendingPage(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardBody className="space-y-4 py-12 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-[var(--color-secondary)]/40">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-secondary)] border-t-transparent" />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Payment Submitted for Verification</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Your split payment is in progress. You will receive SMS updates for approvals.</p>
          <div className="pt-2">
            <Link href="/guest/my-account/bookings">
              <Button variant="outline">Go To My Bookings</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
