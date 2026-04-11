"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { UpiVerifyCard, type UpiQueueItem } from "@/components/payment/UpiVerifyCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/components/feedback/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

interface QueueResponse {
  items: UpiQueueItem[];
}

type QueueTab = "FULL" | "DEPOSIT" | "SPLIT";

export default function AdminUpiQueuePage(): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isTransitionPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [items, setItems] = useState<UpiQueueItem[]>([]);
  const [tab, setTab] = useState<QueueTab>("FULL");

  const [optimisticItems, removeOptimistic] = useOptimistic(items, (current, transactionId: string) =>
    current.filter((item) => item.id !== transactionId),
  );

  async function loadQueue(): Promise<void> {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/payments/upi-queue", { method: "GET" });
      const payload = (await response.json().catch(() => ({ items: [] }))) as QueueResponse;
      if (response.ok) {
        setItems(payload.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
        void loadQueue();
      });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [router]);

  async function verifyPayment(args: {
    transactionId: string;
    action: "APPROVE" | "REJECT";
    reason?: string;
  }): Promise<void> {
    if (args.action === "REJECT" && !args.reason?.trim()) {
      pushToast({
        title: "Rejection reason required",
        variant: "warning",
      });
      return;
    }

    setActioningId(args.transactionId);
    removeOptimistic(args.transactionId);

    try {
      const response = await fetch("/api/v1/payments/manual-upi/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Verification failed");
      }

      setItems((current) => current.filter((item) => item.id !== args.transactionId));
      pushToast({
        title: args.action === "APPROVE" ? "Payment approved" : "Payment rejected",
        variant: args.action === "APPROVE" ? "success" : "info",
      });
    } catch (error) {
      pushToast({
        title: "Action failed",
        message: (error as Error).message,
        variant: "error",
      });
      await loadQueue();
    } finally {
      setActioningId(null);
    }
  }

  const filteredItems = useMemo(
    () =>
      optimisticItems.filter((item) => {
        const type = item.paymentType ?? "FULL";
        return type === tab;
      }),
    [optimisticItems, tab],
  );

  return (
    <div className="space-y-5">
      <PageHeader title="UPI Queue" subtitle="Manual UPI payments awaiting verification." />

      <div className="flex flex-wrap gap-2">
        {(["FULL", "DEPOSIT", "SPLIT"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full border px-3 py-1 text-sm transition-all duration-150 ${
              tab === item
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {isTransitionPending ? <p className="text-xs text-[var(--color-text-muted)]">Refreshing queue...</p> : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-48 w-full" />
          ))}
        </div>
      ) : null}

      {!loading && filteredItems.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All payments verified ✓"
          message={`No pending ${tab.toLowerCase()} UPI payments in queue.`}
        />
      ) : null}

      {!loading && filteredItems.length > 0 ? (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <UpiVerifyCard
              key={item.id}
              item={item}
              processing={actioningId === item.id}
              onApprove={({ transactionId, reason }) => verifyPayment({ transactionId, action: "APPROVE", reason })}
              onReject={({ transactionId, reason }) => verifyPayment({ transactionId, action: "REJECT", reason })}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
