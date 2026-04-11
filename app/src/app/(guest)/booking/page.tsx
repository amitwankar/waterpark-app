"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { CouponInput } from "@/components/booking/CouponInput";
import { OrderSummary } from "@/components/booking/OrderSummary";
import { ParticipantRow, type ParticipantDraft } from "@/components/booking/ParticipantRow";
import { Step1GuestDetails, type IdProofType } from "@/components/booking/Step1GuestDetails";
import { Step2TicketSelection } from "@/components/booking/Step2TicketSelection";
import { StepIndicator } from "@/components/booking/StepIndicator";
import { type BookingTicketType } from "@/components/booking/TicketSelector";
import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { bookingSchema, calculatePricing, parseDateOnlyToUtc, sanitizeCouponCode, type TicketLine } from "@/lib/booking";
import { authClient } from "@/lib/auth-client";
import { formatCurrency } from "@/lib/utils";

const steps = [
  { id: 1, title: "Guest Details" },
  { id: 2, title: "Select Tickets" },
  { id: 3, title: "Summary" },
];

type FormValues = {
  guestName: string;
  guestMobile: string;
  guestEmail: string;
  visitDate: string;
  ticketLines: TicketLine[];
  couponCode: string;
  idProofType?: IdProofType;
  idProofNumber?: string;
  idProofLabel?: string;
  paymentPlan: "FULL" | "ADVANCE";
  advancePercent: number;
  paymentMethod: "GATEWAY" | "MANUAL_UPI" | "CASH" | "CARD";
  paymentReference: string;
};

type PaymentMethod = FormValues["paymentMethod"];

type FormErrors = Partial<Record<keyof FormValues, string>>;

interface TicketsApiResponse {
  tickets: BookingTicketType[];
}

interface CreateBookingResponse {
  booking: {
    bookingNumber: string;
  };
  redirectTo: string;
}

interface CouponValidateResponse {
  valid: boolean;
  message?: string;
  discountAmount: number;
}

interface ParkConfigLite {
  razorpayEnabled?: boolean;
  manualUpiEnabled?: boolean;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  MANUAL_UPI: "Manual UPI",
  GATEWAY: "Gateway",
};

function getDateInputRange(): { min: string; max: string } {
  const now = new Date();
  const min = now.toISOString().slice(0, 10);
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + 90);
  return {
    min,
    max: maxDate.toISOString().slice(0, 10),
  };
}

function buildParticipantDrafts(
  ticketLines: TicketLine[],
  ticketMap: Map<string, BookingTicketType>,
  previous: ParticipantDraft[],
  leadGuestName: string,
): ParticipantDraft[] {
  const slots: Array<{ ticketTypeId: string; ticketTypeLabel: string }> = ticketLines.flatMap((line) => {
    const ticket = ticketMap.get(line.ticketTypeId);
    return Array.from({ length: line.quantity }).map(() => ({
      ticketTypeId: line.ticketTypeId,
      ticketTypeLabel: ticket?.name ?? "Guest",
    }));
  });

  return slots.map((slot, index) => {
    const existing = previous[index];
    if (existing?.ticketTypeId === slot.ticketTypeId) {
      return existing;
    }
    return {
      id: `${slot.ticketTypeId}-${index}`,
      ticketTypeId: slot.ticketTypeId,
      ticketTypeLabel: slot.ticketTypeLabel,
      name: index === 0 ? leadGuestName : `Guest ${index + 1}`,
      gender: undefined,
      age: undefined,
      isLeadGuest: index === 0,
    };
  });
}

export default function BookingPage(): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const userRole = String((session?.user as { role?: string } | undefined)?.role ?? "");
  const userSubRole = String((session?.user as { subRole?: string } | undefined)?.subRole ?? "");
  const canAccessBooking =
    userRole === "ADMIN" || (userRole === "EMPLOYEE" && (userSubRole === "TICKET_COUNTER" || userSubRole === "SALES_EXECUTIVE"));

  const [dateRange, setDateRange] = useState<{ min: string; max: string }>({ min: "", max: "" });
  const [step, setStep] = useState<number>(1);
  const [loadingTickets, setLoadingTickets] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [tickets, setTickets] = useState<BookingTicketType[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [couponError, setCouponError] = useState<string>("");
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [applyingCoupon, setApplyingCoupon] = useState<boolean>(false);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
  const [values, setValues] = useState<FormValues>({
    guestName: "",
    guestMobile: "",
    guestEmail: "",
    visitDate: "",
    ticketLines: [],
    couponCode: "",
    idProofType: undefined,
    idProofNumber: "",
    idProofLabel: "",
    paymentPlan: "FULL",
    advancePercent: 30,
    paymentMethod: "CASH",
    paymentReference: "",
  });
  const [availableMethods, setAvailableMethods] = useState<PaymentMethod[]>(["CASH", "CARD"]);

  // Auth guard — redirect to login if not authenticated
  useEffect(() => {
    const range = getDateInputRange();
    setDateRange(range);
    setValues((current) => ({
      ...current,
      visitDate: current.visitDate || range.min,
    }));
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session?.user) {
      router.replace("/login?redirect=/booking");
      return;
    }

    if (!sessionLoading && session?.user && !canAccessBooking) {
      router.replace("/staff/pos");
    }
  }, [session, sessionLoading, canAccessBooking, router]);

  useEffect(() => {
    if (!session?.user) return;
    void (async () => {
      const response = await fetch("/api/v1/park-config", { method: "GET" });
      const payload = (await response.json().catch(() => null)) as ParkConfigLite | null;
      if (!response.ok || !payload) return;

      const nextMethods: PaymentMethod[] = ["CASH", "CARD"];
      if (payload.manualUpiEnabled) nextMethods.push("MANUAL_UPI");
      if (payload.razorpayEnabled) nextMethods.push("GATEWAY");
      setAvailableMethods(nextMethods);
      setValues((current) => ({
        ...current,
        paymentMethod: nextMethods.includes(current.paymentMethod) ? current.paymentMethod : nextMethods[0]!,
      }));
    })();
  }, [session?.user]);

  useEffect(() => {
    if (!session?.user) return;
    void (async () => {
      try {
        const response = await fetch("/api/v1/ticket-types?activeOnly=true", { method: "GET" });
        const payload = (await response.json()) as TicketsApiResponse;
        if (!response.ok) {
          throw new Error("Could not load tickets");
        }
        setTickets(payload.tickets ?? []);
        // Pre-select first ticket type with qty 1
        if (payload.tickets?.length > 0 && values.ticketLines.length === 0) {
          setValues((current) => ({
            ...current,
            ticketLines: [{ ticketTypeId: payload.tickets[0]!.id, quantity: 1 }],
          }));
        }
      } catch (error) {
        pushToast({
          title: "Unable to load tickets",
          message: (error as Error).message,
          variant: "error",
        });
      } finally {
        setLoadingTickets(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, pushToast]);

  const ticketMap = useMemo(
    () => new Map(tickets.map((t) => [t.id, t])),
    [tickets],
  );

  useEffect(() => {
    setParticipants((current) =>
      buildParticipantDrafts(values.ticketLines, ticketMap, current, values.guestName || "Guest 1"),
    );
  }, [values.ticketLines, values.guestName, ticketMap]);

  const pricing = useMemo(() => {
    const lines = values.ticketLines.map((l) => ({
      quantity: l.quantity,
      unitPrice: ticketMap.get(l.ticketTypeId)?.price ?? 0,
    }));
    const gstRate = tickets.length > 0 ? (ticketMap.get(values.ticketLines[0]?.ticketTypeId ?? "")?.gstRate ?? 18) : 18;
    return calculatePricing({ lines, gstRate, discountAmount: couponDiscount });
  }, [values.ticketLines, ticketMap, tickets, couponDiscount]);

  const paymentBreakdown = useMemo(() => {
    if (values.paymentPlan === "ADVANCE") {
      const payNow = Math.ceil((pricing.totalAmount * values.advancePercent) / 100);
      const balanceDue = Math.max(0, Number((pricing.totalAmount - payNow).toFixed(2)));
      return { payNow, balanceDue };
    }
    return { payNow: pricing.totalAmount, balanceDue: 0 };
  }, [values.paymentPlan, values.advancePercent, pricing.totalAmount]);

  function validateCurrentStep(nextStep: number): boolean {
    const result = bookingSchema.safeParse({
      guestName: values.guestName,
      guestMobile: values.guestMobile,
      guestEmail: values.guestEmail,
      visitDate: values.visitDate,
      ticketLines: values.ticketLines,
      couponCode: values.couponCode,
    });

    if (result.success) {
      setErrors({});
      return true;
    }

    const nextErrors: FormErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof FormValues | undefined;
      if (field && !nextErrors[field]) {
        nextErrors[field] = issue.message;
      }
    }
    setErrors(nextErrors);

    if (nextStep > 1) {
      const hasStepOneError = nextErrors.guestName || nextErrors.guestMobile || nextErrors.guestEmail || nextErrors.visitDate;
      if (hasStepOneError) {
        setStep(1);
      }
    }

    return false;
  }

  async function submitBooking(): Promise<void> {
    if (!validateCurrentStep(3)) {
      return;
    }

    setSubmitting(true);
    setCouponError("");
    try {
      const response = await fetch("/api/v1/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: values.guestName,
          guestMobile: values.guestMobile,
          guestEmail: values.guestEmail,
          visitDate: values.visitDate,
          ticketLines: values.ticketLines,
          couponCode: sanitizeCouponCode(values.couponCode) ?? undefined,
          idProofType: values.idProofType,
          idProofNumber: values.idProofNumber,
          idProofLabel: values.idProofLabel,
          paymentPlan: values.paymentPlan,
          advancePercent: values.paymentPlan === "ADVANCE" ? values.advancePercent : undefined,
          paymentMethod: values.paymentMethod,
          paymentReference: values.paymentReference || undefined,
          participants: participants.map((p) => ({
            name: p.name,
            gender: p.gender,
            age: p.age,
            ticketTypeId: p.ticketTypeId,
            isLeadGuest: p.isLeadGuest,
          })),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as CreateBookingResponse & {
        message?: string;
        errors?: Record<string, string[]>;
      };

      if (!response.ok) {
        if (payload.errors) {
          const nextErrors: FormErrors = {};
          for (const [field, messages] of Object.entries(payload.errors)) {
            if (messages?.[0]) {
              nextErrors[field as keyof FormValues] = messages[0];
            }
          }
          setErrors(nextErrors);
        }

        const message = payload.message ?? "Could not create booking";
        if (message.toLowerCase().includes("coupon")) {
          setCouponError(message);
        } else {
          pushToast({ title: "Booking failed", message, variant: "error" });
        }
        return;
      }

      pushToast({
        title: "Booking created",
        message: `Booking number ${payload.booking.bookingNumber}`,
        variant: "success",
      });

      router.push(payload.redirectTo);
    } catch (error) {
      pushToast({ title: "Booking failed", message: (error as Error).message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function applyCoupon(): Promise<void> {
    const code = sanitizeCouponCode(values.couponCode);
    if (!code) {
      setCouponError("Enter a coupon code");
      setCouponDiscount(0);
      return;
    }
    if (!values.guestMobile || !/^[6-9]\d{9}$/.test(values.guestMobile)) {
      setCouponError("Enter valid mobile number before applying coupon");
      return;
    }

    setApplyingCoupon(true);
    setCouponError("");
    try {
      const totalGuests = values.ticketLines.reduce((s, l) => s + l.quantity, 0);
      const subtotal = values.ticketLines.reduce((s, l) => {
        return s + l.quantity * (ticketMap.get(l.ticketTypeId)?.price ?? 0);
      }, 0);

      const response = await fetch("/api/v1/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          subtotal,
          totalGuests,
          adults: totalGuests,
          children: 0,
          adultPrice: subtotal / Math.max(1, totalGuests),
          childPrice: 0,
          ticketTypeIds: values.ticketLines.map((l) => l.ticketTypeId),
          visitDate: values.visitDate,
          mobile: values.guestMobile,
        }),
      });
      const payload = (await response.json().catch(() => null)) as CouponValidateResponse | null;

      if (!response.ok || !payload?.valid) {
        setCouponDiscount(0);
        setCouponError(payload?.message ?? "Coupon not applicable");
        return;
      }

      setCouponDiscount(payload.discountAmount ?? 0);
      setCouponError("");
      pushToast({ title: "Coupon applied", message: `Discount ₹${payload.discountAmount.toFixed(2)}`, variant: "success" });
    } finally {
      setApplyingCoupon(false);
    }
  }

  const totalGuests = values.ticketLines.reduce((s, l) => s + l.quantity, 0);
  const idProofRequired = totalGuests > 10;

  // Show loading while checking auth
  if (sessionLoading) {
    return (
      <div className="space-y-3 py-8">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // Don't render if not authenticated (redirect in progress)
  if (!session?.user || !canAccessBooking) {
    return <div />;
  }

  return (
    <div className="space-y-6">
      <StepIndicator steps={steps} currentStep={step} />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--color-border)]">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Book Your Waterpark Visit</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Complete details, select tickets, and confirm booking.</p>
        </CardHeader>
        <CardBody className="space-y-6">
          {loadingTickets ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : null}

          {!loadingTickets && step === 1 ? (
            <div className="animate-fade-in space-y-4">
              <Step1GuestDetails
                value={{
                  guestName: values.guestName,
                  guestMobile: values.guestMobile,
                  guestEmail: values.guestEmail,
                  visitDate: values.visitDate,
                  idProofType: values.idProofType,
                  idProofNumber: values.idProofNumber,
                  idProofLabel: values.idProofLabel,
                }}
                errors={errors}
                onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
                minVisitDate={dateRange.min}
                maxVisitDate={dateRange.max}
                idProofRequired={idProofRequired}
              />
            </div>
          ) : null}

          {!loadingTickets && step === 2 ? (
            <div className="animate-fade-in space-y-4">
              <Step2TicketSelection
                tickets={tickets}
                ticketLines={values.ticketLines}
                error={errors.ticketLines}
                participants={participants}
                onTicketLinesChange={(next) => setValues((current) => ({ ...current, ticketLines: next }))}
                onParticipantsChange={setParticipants}
              />
            </div>
          ) : null}

          {!loadingTickets && step === 3 ? (
            <div className="animate-fade-in grid gap-5 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <CouponInput
                  value={values.couponCode}
                  onChange={(couponCode) => {
                    setValues((current) => ({ ...current, couponCode }));
                    setCouponError("");
                    setCouponDiscount(0);
                  }}
                  onApply={() => void applyCoupon()}
                  loading={applyingCoupon}
                  error={couponError}
                />
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">Payment Plan</h2>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Select
                      label="Plan"
                      value={values.paymentPlan}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          paymentPlan: (event.target.value as "FULL" | "ADVANCE") || "FULL",
                        }))
                      }
                      options={[
                        { label: "Full Payment", value: "FULL" },
                        { label: "Advance + Balance at Gate", value: "ADVANCE" },
                      ]}
                    />
                    {values.paymentPlan === "ADVANCE" ? (
                      <Input
                        label="Advance %"
                        type="number"
                        min={10}
                        max={90}
                        value={String(values.advancePercent)}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            advancePercent: Math.max(10, Math.min(90, Number(event.target.value || 30))),
                          }))
                        }
                      />
                    ) : null}
                    <Select
                      label="Payment Method"
                      value={values.paymentMethod}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          paymentMethod: (event.target.value as "GATEWAY" | "MANUAL_UPI" | "CASH" | "CARD") || "CASH",
                        }))
                      }
                      options={availableMethods.map((method) => ({
                        label: PAYMENT_METHOD_LABELS[method],
                        value: method,
                      }))}
                    />
                    <Input
                      label={
                        values.paymentMethod === "MANUAL_UPI"
                          ? "UPI Transaction Number (UTR)"
                          : values.paymentMethod === "GATEWAY"
                            ? "Gateway Order/Txn Ref"
                            : "Receipt/Reference No. (optional)"
                      }
                      value={values.paymentReference}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          paymentReference: event.target.value,
                        }))
                      }
                      placeholder="Enter transaction reference"
                    />
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-[var(--color-text-muted)]">
                    <p>Pay now: <span className="font-semibold text-[var(--color-text)]">{formatCurrency(paymentBreakdown.payNow)}</span></p>
                    <p>Balance at gate: <span className="font-semibold text-[var(--color-text)]">{formatCurrency(paymentBreakdown.balanceDue)}</span></p>
                  </div>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">Visit Summary</h2>
                  <div className="mt-3 space-y-2 text-sm text-[var(--color-text-muted)]">
                    <p>Name: {values.guestName}</p>
                    <p>Booked By: {String((session?.user as { name?: string } | undefined)?.name ?? "Staff")}</p>
                    <p>Mobile: {values.guestMobile}</p>
                    <p>Visit Date: {parseDateOnlyToUtc(values.visitDate)?.toLocaleDateString("en-IN")}</p>
                    <p>Total Guests: {totalGuests}</p>
                    {values.ticketLines.map((l) => {
                      const t = ticketMap.get(l.ticketTypeId);
                      return t ? (
                        <p key={l.ticketTypeId}>
                          {t.name}: {l.quantity} × ₹{t.price}
                        </p>
                      ) : null;
                    })}
                    <p>ID Proof: {values.idProofType ? `${values.idProofType} ••••` : "Not provided"}</p>
                    <p>Payment Plan: {values.paymentPlan === "ADVANCE" ? `Advance ${values.advancePercent}%` : "Full Payment"}</p>
                    <p>Payment Method: {values.paymentMethod}</p>
                    <p>Transaction Ref: {values.paymentReference || "N/A"}</p>
                    <p>Pay Now: {formatCurrency(paymentBreakdown.payNow)}</p>
                    <p>Balance Due: {formatCurrency(paymentBreakdown.balanceDue)}</p>
                  </div>
                </div>

                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">Participants</h3>
                  <div className="mt-3 space-y-3">
                    {participants.map((participant, index) => (
                      <ParticipantRow
                        key={participant.id}
                        participant={participant}
                        index={index}
                        onChange={(next) => {
                          const updated = [...participants];
                          updated[index] = next;
                          setParticipants(updated);
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <OrderSummary
                subtotal={pricing.subtotal}
                gstAmount={pricing.gstAmount}
                discountAmount={pricing.discountAmount}
                totalAmount={pricing.totalAmount}
                gstRate={ticketMap.get(values.ticketLines[0]?.ticketTypeId ?? "")?.gstRate ?? 18}
              />
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || submitting}>
          Back
        </Button>
        {step < 3 ? (
          <Button
            onClick={() => {
              const ok = validateCurrentStep(step + 1);
              if (ok) {
                setStep((current) => Math.min(3, current + 1));
              }
            }}
          >
            Continue
          </Button>
        ) : (
          <Button onClick={() => void submitBooking()} loading={submitting}>
            Proceed to Pay
          </Button>
        )}
      </div>
    </div>
  );
}
