"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

export interface UpiQueueItem {
  id: string;
  bookingId: string;
  bookingNumber: string;
  guestName: string;
  guestMobile: string;
  amount: number;
  visitDate: string;
  submittedAt: string;
  screenshot?: string | null;
  notes?: string | null;
  paymentType?: "FULL" | "DEPOSIT" | "SPLIT";
  splitPortion?: number | null;
  splitIndex?: number | null;
  splitGroup?: string | null;
  bookingBalanceDue?: number | null;
}

export interface UpiVerifyCardProps {
  item: UpiQueueItem;
  processing?: boolean;
  onApprove: (args: { transactionId: string; reason?: string }) => Promise<void>;
  onReject: (args: { transactionId: string; reason: string }) => Promise<void>;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function UpiVerifyCard({ item, processing, onApprove, onReject }: UpiVerifyCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");

  const paymentTypeBadge = useMemo(() => {
    if (item.paymentType === "DEPOSIT") return { label: "Deposit", variant: "warning" as const };
    if (item.paymentType === "SPLIT") return { label: "Split", variant: "info" as const };
    return { label: "Full", variant: "default" as const };
  }, [item.paymentType]);

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-base font-semibold text-[var(--color-text)]">{item.bookingNumber}</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {item.guestName} ({item.guestMobile})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={paymentTypeBadge.variant}>{paymentTypeBadge.label}</Badge>
            <p className="text-base font-semibold text-[var(--color-text)]">{formatInr(item.amount)}</p>
          </div>
        </div>

        <div className="grid gap-2 text-sm text-[var(--color-text-muted)] sm:grid-cols-2">
          <p>Visit: {new Date(item.visitDate).toLocaleDateString("en-IN")}</p>
          <p>Submitted: {new Date(item.submittedAt).toLocaleString("en-IN")}</p>
          {item.splitIndex ? <p>Split Portion: #{item.splitIndex}</p> : null}
          {typeof item.bookingBalanceDue === "number" ? <p>Booking Balance Due: {formatInr(item.bookingBalanceDue)}</p> : null}
        </div>

        {item.screenshot ? (
          <div className="space-y-2">
            <button
              type="button"
              className="text-xs font-medium text-[var(--color-primary)] underline"
              onClick={() => setExpanded((state) => !state)}
            >
              {expanded ? "Hide screenshot" : "View screenshot"}
            </button>
            {expanded ? (
              <img
                src={item.screenshot}
                alt="UPI screenshot"
                className="max-h-80 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] object-contain"
              />
            ) : null}
          </div>
        ) : null}

        <div className="space-y-1">
          <label className="text-sm font-medium text-[var(--color-text)]">Verification Notes</label>
          <textarea
            className="min-h-20 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            placeholder="Reason for approval/rejection"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1 bg-[var(--color-success)] hover:bg-green-600"
            loading={processing}
            onClick={() => void onApprove({ transactionId: item.id, reason: note.trim() || undefined })}
          >
            Approve
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={processing}
            onClick={() => void onReject({ transactionId: item.id, reason: note.trim() })}
          >
            Reject
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
