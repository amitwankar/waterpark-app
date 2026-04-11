"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DepositOptionCard } from "@/components/payment/DepositOptionCard";
import { ManualUpiForm } from "@/components/payment/ManualUpiForm";
import { PaymentStrategySelector, type PaymentStrategy } from "@/components/payment/PaymentStrategySelector";
import { RazorpayButton } from "@/components/payment/RazorpayButton";
import { SplitBuilder, createDefaultSplitRows, type SplitMethod, type SplitRow } from "@/components/payment/SplitBuilder";
import { SplitSummaryCard } from "@/components/payment/SplitSummaryCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

interface BookingPayload {
  booking: {
    id: string;
    bookingNumber: string;
    guestName: string;
    guestMobile: string;
    guestEmail?: string | null;
    visitDate: string;
    totalAmount: number;
    status: string;
    notes?: string | null;
    transactions: Array<{
      id: string;
      method: "GATEWAY" | "MANUAL_UPI" | "CASH" | "WRISTBAND";
      amount: number;
      status: "PENDING" | "PAID" | "FAILED" | "REJECTED" | "REFUNDED";
      notes?: string | null;
    }>;
  };
}

interface InitiatedSplit {
  transactionId: string;
  method: "GATEWAY" | "MANUAL_UPI" | "CASH";
  amount: number;
  razorpayOrderId?: string;
  splitIndex: number;
}

interface InitiatePayload {
  splitGroup: string;
  razorpayKeyId: string;
  paymentType: "FULL" | "DEPOSIT" | "SPLIT";
  splits: InitiatedSplit[];
}

interface GuestPaymentPageProps {
  params: Promise<{ bookingId: string }> | { bookingId: string };
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function rowToSplitPayload(row: SplitRow): { method: SplitMethod; amount: number } {
  return { method: row.method, amount: round(row.amount) };
}

function parseBookingBalance(notes?: string | null): number {
  if (!notes) return 0;
  const line = notes.split("\n").find((item) => item.startsWith("PAYMENT_META:"));
  if (!line) return 0;
  try {
    const data = JSON.parse(line.slice("PAYMENT_META:".length)) as { balanceDue?: number };
    return typeof data.balanceDue === "number" ? data.balanceDue : 0;
  } catch {
    return 0;
  }
}

export default function GuestPaymentPage({ params }: GuestPaymentPageProps): JSX.Element {
  const router = useRouter();
  const [bookingId, setBookingId] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<BookingPayload["booking"] | null>(null);

  const [strategy, setStrategy] = useState<PaymentStrategy>("FULL");
  const [splitRows, setSplitRows] = useState<SplitRow[]>([]);

  const [initiating, setInitiating] = useState(false);
  const [initResult, setInitResult] = useState<InitiatePayload | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processed, setProcessed] = useState<Record<string, "PAID" | "PENDING" | "DUE">>({});

  useEffect(() => {
    Promise.resolve(params).then((resolved) => setBookingId(resolved.bookingId));
  }, [params]);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/v1/bookings/${bookingId}?public=1`);
        const payload = (await response.json().catch(() => null)) as BookingPayload | { message?: string } | null;
        if (!response.ok || !payload || !("booking" in payload)) {
          throw new Error((payload as { message?: string } | null)?.message ?? "Booking not found");
        }

        if (cancelled) return;
        setBooking(payload.booking);

        const initialRows = createDefaultSplitRows(Number(payload.booking.totalAmount));
        setSplitRows(initialRows);
      } catch (fetchError) {
        if (!cancelled) setError((fetchError as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const totalAmount = Number(booking?.totalAmount ?? 0);
  const depositPercent = 30;
  const depositLabel = "Book Now, Pay Rest at Gate";
  const depositAmount = useMemo(() => Math.ceil(totalAmount * (depositPercent / 100)), [totalAmount]);
  const balanceAfterDeposit = useMemo(() => Math.max(0, round(totalAmount - depositAmount)), [totalAmount, depositAmount]);

  useEffect(() => {
    if (!booking) return;
    if (strategy === "FULL") {
      setSplitRows([{ id: crypto.randomUUID(), method: "GATEWAY", amount: totalAmount }]);
      return;
    }

    if (strategy === "DEPOSIT") {
      setSplitRows([
        { id: crypto.randomUUID(), method: "GATEWAY", amount: depositAmount },
        { id: crypto.randomUUID(), method: "CASH", amount: balanceAfterDeposit },
      ]);
      return;
    }

    if (strategy === "SPLIT" && splitRows.length === 0) {
      setSplitRows(createDefaultSplitRows(totalAmount));
    }
  }, [strategy, booking, totalAmount, depositAmount, balanceAfterDeposit]);

  const allocated = useMemo(() => round(splitRows.reduce((acc, row) => acc + row.amount, 0)), [splitRows]);
  const remaining = useMemo(() => round(totalAmount - allocated), [totalAmount, allocated]);
  const rowsValid =
    splitRows.length >= 1 &&
    splitRows.length <= 4 &&
    splitRows.every((row) => row.amount >= 50) &&
    remaining === 0;

  async function initiateSplits(): Promise<void> {
    if (!booking) return;
    if (!rowsValid) {
      setError("Please make sure split rows are valid and fully allocated.");
      return;
    }

    setInitiating(true);
    setError("");

    try {
      const response = await fetch("/api/v1/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          paymentType: strategy,
          splits: splitRows.map(rowToSplitPayload),
        }),
      });

      const payload = (await response.json().catch(() => null)) as InitiatePayload & { message?: string };
      if (!response.ok) {
        throw new Error(payload?.message ?? "Failed to initiate payment");
      }

      setInitResult(payload);
      setCurrentIndex(0);
      setProcessed({});
    } catch (initError) {
      setError((initError as Error).message);
    } finally {
      setInitiating(false);
    }
  }

  function markProcessed(transactionId: string, state: "PAID" | "PENDING" | "DUE"): void {
    setProcessed((current) => ({ ...current, [transactionId]: state }));
    setCurrentIndex((current) => current + 1);
  }

  const hasAnyPayment = useMemo(() => {
    if (!booking) return false;
    return booking.transactions.some((tx) => tx.status === "PAID" || tx.status === "PENDING");
  }, [booking]);

  if (loading) {
    return <div className="mx-auto max-w-5xl py-10 text-sm text-[var(--color-text-muted)]">Loading payment page...</div>;
  }

  if (error && !booking) {
    return <div className="mx-auto max-w-5xl py-10 text-sm text-red-500">{error}</div>;
  }

  if (!booking) {
    return <div className="mx-auto max-w-5xl py-10 text-sm text-red-500">Booking not found.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Payment - {booking.bookingNumber}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Visit {new Date(booking.visitDate).toLocaleDateString("en-IN")}</p>
        </CardHeader>
        <CardBody className="grid gap-2 text-sm text-[var(--color-text-muted)] sm:grid-cols-2 lg:grid-cols-4">
          <p>Guest: <span className="font-medium text-[var(--color-text)]">{booking.guestName}</span></p>
          <p>Mobile: <span className="font-medium text-[var(--color-text)]">{booking.guestMobile}</span></p>
          <p>Total: <span className="font-medium text-[var(--color-text)]">{formatInr(totalAmount)}</span></p>
          <p>Status: <span className="font-medium text-[var(--color-text)]">{booking.status}</span></p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Step 1 - Choose Strategy</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          <PaymentStrategySelector
            totalAmount={totalAmount}
            depositAmount={depositAmount}
            balanceAfterDeposit={balanceAfterDeposit}
            depositPercent={depositPercent}
            depositLabel={depositLabel}
            value={strategy}
            onChange={setStrategy}
          />
          {strategy === "DEPOSIT" ? (
            <DepositOptionCard
              totalAmount={totalAmount}
              depositAmount={depositAmount}
              balanceDue={balanceAfterDeposit}
              depositPercent={depositPercent}
              depositLabel={depositLabel}
            />
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Step 2 - Build Splits</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          {strategy === "SPLIT" ? (
            <SplitBuilder totalAmount={totalAmount} rows={splitRows} onChange={setSplitRows} />
          ) : (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm text-[var(--color-text-muted)]">
              {splitRows.map((row, index) => (
                <p key={row.id}>
                  Portion {index + 1}: <span className="font-medium text-[var(--color-text)]">{row.method}</span> - {formatInr(row.amount)}
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button loading={initiating} onClick={() => void initiateSplits()} disabled={!rowsValid}>
              Initiate Payment Session
            </Button>
            <p className={`text-sm ${remaining === 0 ? "text-green-600" : "text-amber-600"}`}>
              {formatInr(allocated)} of {formatInr(totalAmount)} allocated
            </p>
          </div>
        </CardBody>
      </Card>

      {initResult ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Step 3 - Process Online Splits</h2>
            <p className="text-sm text-[var(--color-text-muted)]">Process rows top to bottom.</p>
          </CardHeader>
          <CardBody className="space-y-3">
            {initResult.splits.map((split, index) => {
              const isActive = index === currentIndex;
              const state = processed[split.transactionId];

              return (
                <div key={split.transactionId} className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      Split {split.splitIndex}: {split.method} - {formatInr(split.amount)}
                    </p>
                    {state ? (
                      <Badge variant={state === "PAID" ? "success" : state === "PENDING" ? "warning" : "info"}>{state}</Badge>
                    ) : (
                      <Badge variant={isActive ? "info" : "default"}>{isActive ? "Current" : "Queued"}</Badge>
                    )}
                  </div>

                  {split.method === "GATEWAY" && split.razorpayOrderId ? (
                    <RazorpayButton
                      transactionId={split.transactionId}
                      orderId={split.razorpayOrderId}
                      keyId={initResult.razorpayKeyId}
                      amount={split.amount}
                      bookingName={booking.guestName}
                      bookingMobile={booking.guestMobile}
                      bookingEmail={booking.guestEmail}
                      disabled={!isActive || Boolean(state)}
                      onVerified={(data) => {
                        markProcessed(split.transactionId, "PAID");
                        if (data.balanceDue <= 0) {
                          router.push(`/guest/payment/success?bookingId=${booking.id}`);
                        }
                      }}
                    />
                  ) : null}

                  {split.method === "MANUAL_UPI" ? (
                    <ManualUpiForm
                      transactionId={split.transactionId}
                      amount={split.amount}
                      paymentType={initResult.paymentType}
                      disabled={!isActive || Boolean(state)}
                      onSubmitted={() => {
                        markProcessed(split.transactionId, "PENDING");
                      }}
                    />
                  ) : null}

                  {split.method === "CASH" ? (
                    <div className="rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                      Cash portion will be collected at gate.
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          disabled={!isActive || Boolean(state)}
                          onClick={() => {
                            markProcessed(split.transactionId, "DUE");
                          }}
                        >
                          Mark as Due at Gate
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div className="flex flex-wrap gap-2 pt-2">
              <Link href={`/guest/payment/success?bookingId=${booking.id}`}>
                <Button>View Success Summary</Button>
              </Link>
              <Link href={`/guest/payment/pending?bookingId=${booking.id}`}>
                <Button variant="outline">View Pending Screen</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {hasAnyPayment ? (
        <SplitSummaryCard
          rows={booking.transactions.map((tx) => ({
            id: tx.id,
            method: tx.method,
            amount: tx.amount,
            status: tx.status,
            splitIndex: null,
          }))}
          totalAmount={totalAmount}
          totalPaid={booking.transactions.filter((tx) => tx.status === "PAID").reduce((acc, tx) => acc + tx.amount, 0)}
          balanceDue={parseBookingBalance(booking.notes)}
        />
      ) : null}

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}
