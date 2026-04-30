"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";

type TicketOption = { id: string; name: string; price: number; gstRate: number };
type PackageOption = { id: string; name: string; listedPrice: number; salePrice: number; gstRate: number };
type FoodOption = { id: string; foodItemId: string; foodVariantId?: string; name: string; variantName?: string; price: number; gstRate: number };
type LockerProduct = { lockerCategoryId: string; label: string; rate: number; gstRate: number };
type CostumeGroup = { costumeItemId: string; label: string; rentalRate: number; gstRate: number; availableQuantity: number };
type RideOption = { id: string; name: string; zoneName?: string | null; entryFee: number; gstRate: number };
type QueueCartLineItem = {
  key: string;
  section: string;
  label: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};
type QueueSlipLineItem = {
  section: string;
  label: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type QueueOptionsResponse = {
  queue: {
    limitPerDay: number;
    prefix: string;
    todayCount: number;
    verificationMode: "DISABLED" | "EMAIL" | "SMS" | "BOTH";
  };
  tickets: TicketOption[];
  packages: PackageOption[];
  foodOptions: FoodOption[];
  lockerProducts: LockerProduct[];
  costumeGroups: CostumeGroup[];
  rides: RideOption[];
};

type Participant = { name: string; age?: string; gender?: "" | "MALE" | "FEMALE" | "OTHER" };

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function modeNeedsEmail(mode: QueueOptionsResponse["queue"]["verificationMode"]): boolean {
  return mode === "EMAIL" || mode === "BOTH";
}

function modeNeedsSms(mode: QueueOptionsResponse["queue"]["verificationMode"]): boolean {
  return mode === "SMS" || mode === "BOTH";
}

export default function PublicQueuePage(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<QueueOptionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [guestName, setGuestName] = useState("");
  const [guestMobile, setGuestMobile] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [smsOtp, setSmsOtp] = useState("");
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [sendingSmsOtp, setSendingSmsOtp] = useState(false);
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);
  const [verifyingSmsOtp, setVerifyingSmsOtp] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [smsVerified, setSmsVerified] = useState(false);
  const [emailOtpProofToken, setEmailOtpProofToken] = useState<string | null>(null);
  const [smsOtpProofToken, setSmsOtpProofToken] = useState<string | null>(null);

  const [ticketLines, setTicketLines] = useState<Array<{ ticketTypeId: string; quantity: string }>>([{ ticketTypeId: "", quantity: "1" }]);
  const [packageLines, setPackageLines] = useState<Array<{ packageId: string; quantity: string }>>([]);
  const [foodLines, setFoodLines] = useState<Array<{ optionId: string; quantity: string }>>([]);
  const [lockerLines, setLockerLines] = useState<Array<{ lockerCategoryId: string; quantity: string }>>([]);
  const [costumeLines, setCostumeLines] = useState<Array<{ costumeItemId: string; quantity: string }>>([]);
  const [rideLines, setRideLines] = useState<Array<{ rideId: string; quantity: string }>>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{
    queueCode: string;
    visitDate: string;
    guestName: string;
    guestMobile: string | null;
    guestEmail: string | null;
    participantCount: number;
    slipLines: QueueSlipLineItem[];
    subtotal: number;
    gstAmount: number;
    totalAmount: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetch("/api/v1/public/queue/options")
      .then(async (res) => {
        const payload = (await res.json()) as QueueOptionsResponse;
        if (!res.ok) throw new Error((payload as any)?.message ?? "Failed to load options");
        if (alive) setOptions(payload);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const totals = useMemo(() => {
    if (!options) return { subtotal: 0, gst: 0, total: 0, cartItems: [] as QueueCartLineItem[] };

    const ticketMap = new Map(options.tickets.map((t) => [t.id, t]));
    const packageMap = new Map(options.packages.map((p) => [p.id, p]));
    const foodMap = new Map(options.foodOptions.map((f) => [f.id, f]));
    const lockerMap = new Map(options.lockerProducts.map((l) => [l.lockerCategoryId, l]));
    const costumeMap = new Map(options.costumeGroups.map((c) => [c.costumeItemId, c]));
    const rideMap = new Map(options.rides.map((r) => [r.id, r]));

    let subtotal = 0;
    let gst = 0;
    const cartItems: QueueCartLineItem[] = [];

    for (const line of ticketLines) {
      const t = ticketMap.get(line.ticketTypeId);
      if (!t) continue;
      const qty = Math.max(1, Number(line.quantity || "1"));
      subtotal += t.price * qty;
      gst += t.price * qty * (t.gstRate / 100);
      cartItems.push({
        key: `ticket-${line.ticketTypeId}-${cartItems.length}`,
        section: "Tickets",
        label: t.name,
        quantity: qty,
        unitPrice: t.price,
        lineTotal: roundMoney(t.price * qty),
      });
    }
    for (const line of packageLines) {
      const p = packageMap.get(line.packageId);
      if (!p) continue;
      const qty = Math.max(1, Number(line.quantity || "1"));
      subtotal += p.salePrice * qty;
      gst += p.salePrice * qty * (p.gstRate / 100);
      cartItems.push({
        key: `package-${line.packageId}-${cartItems.length}`,
        section: "Packages",
        label: p.name,
        quantity: qty,
        unitPrice: p.salePrice,
        lineTotal: roundMoney(p.salePrice * qty),
      });
    }
    for (const line of foodLines) {
      const f = foodMap.get(line.optionId);
      if (!f) continue;
      const qty = Math.max(1, Number(line.quantity || "1"));
      subtotal += f.price * qty;
      gst += f.price * qty * (f.gstRate / 100);
      cartItems.push({
        key: `food-${line.optionId}-${cartItems.length}`,
        section: "Food",
        label: `${f.name}${f.variantName ? ` (${f.variantName})` : ""}`,
        quantity: qty,
        unitPrice: f.price,
        lineTotal: roundMoney(f.price * qty),
      });
    }
    for (const line of lockerLines) {
      const l = lockerMap.get(line.lockerCategoryId);
      if (!l) continue;
      const qty = Math.max(1, Number(line.quantity || "1"));
      subtotal += l.rate * qty;
      gst += l.rate * qty * (l.gstRate / 100);
      cartItems.push({
        key: `locker-${line.lockerCategoryId}-${cartItems.length}`,
        section: "Lockers",
        label: l.label,
        quantity: qty,
        unitPrice: l.rate,
        lineTotal: roundMoney(l.rate * qty),
      });
    }
    for (const line of costumeLines) {
      const c = costumeMap.get(line.costumeItemId);
      if (!c) continue;
      const qty = Math.max(1, Number(line.quantity || "1"));
      subtotal += c.rentalRate * qty;
      gst += c.rentalRate * qty * (c.gstRate / 100);
      cartItems.push({
        key: `costume-${line.costumeItemId}-${cartItems.length}`,
        section: "Costumes",
        label: c.label,
        quantity: qty,
        unitPrice: c.rentalRate,
        lineTotal: roundMoney(c.rentalRate * qty),
      });
    }
    for (const line of rideLines) {
      const r = rideMap.get(line.rideId);
      if (!r) continue;
      const qty = Math.max(1, Number(line.quantity || "1"));
      subtotal += r.entryFee * qty;
      gst += r.entryFee * qty * (r.gstRate / 100);
      cartItems.push({
        key: `ride-${line.rideId}-${cartItems.length}`,
        section: "Rides",
        label: r.zoneName ? `${r.name} (${r.zoneName})` : r.name,
        quantity: qty,
        unitPrice: r.entryFee,
        lineTotal: roundMoney(r.entryFee * qty),
      });
    }

    subtotal = roundMoney(subtotal);
    gst = roundMoney(gst);
    return { subtotal, gst, total: roundMoney(subtotal + gst), cartItems };
  }, [options, ticketLines, packageLines, foodLines, lockerLines, costumeLines, rideLines]);

  const verificationMode = options?.queue.verificationMode ?? "DISABLED";
  const emailRequired = modeNeedsEmail(verificationMode);
  const smsRequired = modeNeedsSms(verificationMode);
  const mobileValid = /^[6-9]\d{9}$/.test(guestMobile.trim());
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());
  const canSubmitQueue =
    guestName.trim().length > 0 &&
    mobileValid &&
    emailValid &&
    totals.total > 0 &&
    (!emailRequired || emailVerified) &&
    (!smsRequired || smsVerified);

  async function sendOtp(channel: "email" | "sms"): Promise<void> {
    setError(null);
    if (channel === "email") {
      if (!emailValid) {
        setError("Enter a valid email first");
        return;
      }
      setSendingEmailOtp(true);
    } else {
      if (!mobileValid) {
        setError("Enter a valid 10-digit mobile number first");
        return;
      }
      setSendingSmsOtp(true);
    }
    try {
      const res = await fetch("/api/v1/public/queue/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, email: guestEmail, mobile: guestMobile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to send OTP");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send OTP");
    } finally {
      if (channel === "email") setSendingEmailOtp(false);
      else setSendingSmsOtp(false);
    }
  }

  async function verifyOtp(channel: "email" | "sms"): Promise<void> {
    setError(null);
    if (channel === "email") setVerifyingEmailOtp(true);
    else setVerifyingSmsOtp(true);
    try {
      const res = await fetch("/api/v1/public/queue/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          email: guestEmail,
          mobile: guestMobile,
          otp: channel === "email" ? emailOtp : smsOtp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to verify OTP");
      if (channel === "email") {
        setEmailVerified(true);
        setEmailOtpProofToken(String(data.proofToken));
      } else {
        setSmsVerified(true);
        setSmsOtpProofToken(String(data.proofToken));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to verify OTP");
    } finally {
      if (channel === "email") setVerifyingEmailOtp(false);
      else setVerifyingSmsOtp(false);
    }
  }

  async function submit(): Promise<void> {
    if (!options) return;
    setSubmitting(true);
    setError(null);
    try {
      if (emailRequired && !emailOtpProofToken) {
        throw new Error("Complete email OTP verification before queue booking");
      }
      if (smsRequired && !smsOtpProofToken) {
        throw new Error("Complete SMS OTP verification before queue booking");
      }

      const payload = {
        guestName,
        guestMobile,
        guestEmail,
        emailOtpProofToken: emailOtpProofToken ?? undefined,
        smsOtpProofToken: smsOtpProofToken ?? undefined,
        notes,
        participants: participants
          .filter((p) => p.name.trim().length > 0)
          .map((p) => ({
            name: p.name.trim(),
            age: p.age?.trim().length ? Number(p.age) : undefined,
            gender: p.gender || undefined,
          })),
        ticketLines: ticketLines
          .filter((l) => l.ticketTypeId)
          .map((l) => ({ ticketTypeId: l.ticketTypeId, quantity: Math.max(1, Number(l.quantity || "1")) })),
        packageLines: packageLines
          .filter((l) => l.packageId)
          .map((l) => ({ packageId: l.packageId, quantity: Math.max(1, Number(l.quantity || "1")) })),
        foodLines: foodLines
          .filter((l) => l.optionId)
          .map((l) => {
            const opt = options.foodOptions.find((o) => o.id === l.optionId);
            return opt
              ? { foodItemId: opt.foodItemId, foodVariantId: opt.foodVariantId, quantity: Math.max(1, Number(l.quantity || "1")) }
              : null;
          })
          .filter(Boolean),
        lockerLines: lockerLines
          .filter((l) => l.lockerCategoryId)
          .map((l) => ({ lockerCategoryId: l.lockerCategoryId, quantity: Math.max(1, Number(l.quantity || "1")) })),
        costumeLines: costumeLines
          .filter((l) => l.costumeItemId)
          .map((l) => ({ costumeItemId: l.costumeItemId, quantity: Math.max(1, Number(l.quantity || "1")) })),
        rideLines: rideLines
          .filter((l) => l.rideId)
          .map((l) => ({ rideId: l.rideId, quantity: Math.max(1, Number(l.quantity || "1")) })),
      };

      const res = await fetch("/api/v1/public/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to create queue");
      setCreated({
        queueCode: data.queueCode,
        visitDate: String(data.visitDate ?? new Date().toISOString().slice(0, 10)),
        guestName: String(data.guestName ?? guestName),
        guestMobile: data.guestMobile ? String(data.guestMobile) : null,
        guestEmail: data.guestEmail ? String(data.guestEmail) : null,
        participantCount: Number(data.participantCount ?? participants.length),
        slipLines: Array.isArray(data.slipLines) ? (data.slipLines as QueueSlipLineItem[]) : [],
        subtotal: Number(data.subtotal ?? totals.subtotal),
        gstAmount: Number(data.gstAmount ?? totals.gst),
        totalAmount: Number(data.totalAmount ?? totals.total),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-[var(--color-text-muted)]">Loading queue form…</div>;
  }

  if (created) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <h1 className="text-xl font-semibold text-[var(--color-text)]">Queue Booking Slip</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Show this slip at ticket counter for payment and final ticket.</p>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Queue ID</p>
                <p className="text-2xl font-semibold text-[var(--color-text)]">{created.queueCode}</p>
              </div>
              <Badge variant="info">No payment yet</Badge>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-muted)] space-y-1">
              <p><span className="font-medium text-[var(--color-text)]">Guest:</span> {created.guestName}</p>
              <p><span className="font-medium text-[var(--color-text)]">Mobile:</span> {created.guestMobile || "Not provided"}</p>
              <p><span className="font-medium text-[var(--color-text)]">Email:</span> {created.guestEmail || "Not provided"}</p>
              <p><span className="font-medium text-[var(--color-text)]">Visit Date:</span> {created.visitDate}</p>
              <p><span className="font-medium text-[var(--color-text)]">Participants:</span> {created.participantCount}</p>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="text-sm font-semibold text-[var(--color-text)] mb-2">Itemized Queue Slip</p>
              {created.slipLines.length > 0 ? (
                <div className="space-y-2">
                  {created.slipLines.map((line, index) => (
                    <div key={`${line.section}-${line.label}-${index}`} className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 text-sm">
                      <div>
                        <p className="font-medium text-[var(--color-text)]">{line.label}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{line.section} · {line.quantity} x {formatCurrency(line.unitPrice)}</p>
                      </div>
                      <p className="font-semibold text-[var(--color-text)]">{formatCurrency(line.lineTotal)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">No items found in slip.</p>
              )}
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)]">Subtotal</span>
                  <span className="font-semibold text-[var(--color-text)]">{formatCurrency(created.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)]">GST</span>
                  <span className="font-semibold text-[var(--color-text)]">{formatCurrency(created.gstAmount)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
                  <span className="font-semibold text-[var(--color-text)]">Total</span>
                  <span className="font-semibold text-[var(--color-text)]">{formatCurrency(created.totalAmount)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => window.print()}>Print Slip</Button>
              <Button onClick={() => window.location.reload()}>Create Another Queue</Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Queue Booking (No Payment)</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Fill required tickets and add-ons. You’ll receive a queue ID to pay at the ticket counter.
        </p>
        {options ? (
          <p className="text-xs text-[var(--color-text-muted)]">
            Today queue count: {options.queue.todayCount}{options.queue.limitPerDay > 0 ? ` / ${options.queue.limitPerDay}` : ""}.
          </p>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Guest Info</h2>
            </CardHeader>
            <CardBody className="grid gap-4 md:grid-cols-2">
              <Input label="Guest name *" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              <Input
                label={smsRequired ? "Mobile (OTP required) *" : "Mobile *"}
                value={guestMobile}
                onChange={(e) => {
                  setGuestMobile(e.target.value);
                  setSmsVerified(false);
                  setSmsOtpProofToken(null);
                }}
                placeholder="10-digit mobile"
              />
              <Input
                label={emailRequired ? "Email (OTP required) *" : "Email *"}
                value={guestEmail}
                onChange={(e) => {
                  if (emailVerified) return;
                  setGuestEmail(e.target.value);
                  setEmailVerified(false);
                  setEmailOtpProofToken(null);
                }}
                disabled={emailVerified}
              />
              <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </CardBody>
          </Card>

          {emailRequired || smsRequired ? (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Verify Contact</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                {emailRequired ? (
                  <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] items-end">
                    <Input
                      label="Email OTP"
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value)}
                      disabled={emailVerified}
                      placeholder="6-digit OTP"
                    />
                    <Button variant="outline" loading={sendingEmailOtp} onClick={() => void sendOtp("email")} disabled={emailVerified}>
                      Send OTP
                    </Button>
                    <Button loading={verifyingEmailOtp} onClick={() => void verifyOtp("email")} disabled={emailVerified || emailOtp.trim().length !== 6}>
                      {emailVerified ? "Verified" : "Verify OTP"}
                    </Button>
                  </div>
                ) : null}

                {smsRequired ? (
                  <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] items-end">
                    <Input
                      label="SMS OTP"
                      value={smsOtp}
                      onChange={(e) => setSmsOtp(e.target.value)}
                      placeholder="6-digit OTP"
                    />
                    <Button variant="outline" loading={sendingSmsOtp} onClick={() => void sendOtp("sms")}>
                      Send OTP
                    </Button>
                    <Button loading={verifyingSmsOtp} onClick={() => void verifyOtp("sms")} disabled={smsOtp.trim().length !== 6}>
                      {smsVerified ? "Verified" : "Verify OTP"}
                    </Button>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Select Tickets</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              {ticketLines.map((line, index) => (
                <div key={`t-${index}`} className="grid gap-3 md:grid-cols-[1fr_140px_auto] items-end">
                  <Select
                    label="Ticket type"
                    value={line.ticketTypeId}
                    onChange={(event) => {
                      const next = [...ticketLines];
                      next[index] = { ...next[index]!, ticketTypeId: event.target.value };
                      setTicketLines(next);
                    }}
                    options={[
                      { label: "Select ticket", value: "" },
                      ...(options?.tickets ?? []).map((t) => ({ label: `${t.name} (${formatCurrency(t.price)})`, value: t.id })),
                    ]}
                  />
                  <Input
                    label="Qty"
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(event) => {
                      const next = [...ticketLines];
                      next[index] = { ...next[index]!, quantity: event.target.value };
                      setTicketLines(next);
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setTicketLines((prev) => prev.filter((_, i) => i !== index))}
                    disabled={ticketLines.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => setTicketLines((prev) => [...prev, { ticketTypeId: "", quantity: "1" }])}>
                Add Ticket Line
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Add-ons (Same Checkout)</h2>
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">Packages</h3>
                  <Button variant="outline" onClick={() => setPackageLines((prev) => [...prev, { packageId: "", quantity: "1" }])}>Add</Button>
                </div>
                {packageLines.map((line, index) => (
                  <div key={`p-${index}`} className="grid gap-3 md:grid-cols-[1fr_140px_auto] items-end">
                    <Select
                      label="Package"
                      value={line.packageId}
                      onChange={(event) => {
                        const next = [...packageLines];
                        next[index] = { ...next[index]!, packageId: event.target.value };
                        setPackageLines(next);
                      }}
                      options={[
                        { label: "Select package", value: "" },
                        ...(options?.packages ?? []).map((p) => ({ label: `${p.name} (${formatCurrency(p.salePrice)})`, value: p.id })),
                      ]}
                    />
                    <Input label="Qty" type="number" min={1} value={line.quantity} onChange={(e) => {
                      const next = [...packageLines];
                      next[index] = { ...next[index]!, quantity: e.target.value };
                      setPackageLines(next);
                    }} />
                    <Button variant="outline" onClick={() => setPackageLines((prev) => prev.filter((_, i) => i !== index))}>Remove</Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">Food</h3>
                  <Button variant="outline" onClick={() => setFoodLines((prev) => [...prev, { optionId: "", quantity: "1" }])}>Add</Button>
                </div>
                {foodLines.map((line, index) => (
                  <div key={`f-${index}`} className="grid gap-3 md:grid-cols-[1fr_140px_auto] items-end">
                    <Select
                      label="Food item"
                      value={line.optionId}
                      onChange={(event) => {
                        const next = [...foodLines];
                        next[index] = { ...next[index]!, optionId: event.target.value };
                        setFoodLines(next);
                      }}
                      options={[
                        { label: "Select food", value: "" },
                        ...(options?.foodOptions ?? []).map((f) => ({
                          label: `${f.name}${f.variantName ? ` · ${f.variantName}` : ""} (${formatCurrency(f.price)})`,
                          value: f.id,
                        })),
                      ]}
                    />
                    <Input label="Qty" type="number" min={1} value={line.quantity} onChange={(e) => {
                      const next = [...foodLines];
                      next[index] = { ...next[index]!, quantity: e.target.value };
                      setFoodLines(next);
                    }} />
                    <Button variant="outline" onClick={() => setFoodLines((prev) => prev.filter((_, i) => i !== index))}>Remove</Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">Lockers (quantity only)</h3>
                  <Button variant="outline" onClick={() => setLockerLines((prev) => [...prev, { lockerCategoryId: "", quantity: "1" }])}>Add</Button>
                </div>
                {lockerLines.map((line, index) => (
                  <div key={`l-${index}`} className="grid gap-3 md:grid-cols-[1fr_140px_auto] items-end">
                    <Select
                      label="Locker type"
                      value={line.lockerCategoryId}
                      onChange={(event) => {
                        const next = [...lockerLines];
                        next[index] = { ...next[index]!, lockerCategoryId: event.target.value };
                        setLockerLines(next);
                      }}
                      options={[
                        { label: "Select locker type", value: "" },
                        ...(options?.lockerProducts ?? []).map((l) => ({ label: `${l.label} (${formatCurrency(l.rate)})`, value: l.lockerCategoryId })),
                      ]}
                    />
                    <Input label="Qty" type="number" min={1} value={line.quantity} onChange={(e) => {
                      const next = [...lockerLines];
                      next[index] = { ...next[index]!, quantity: e.target.value };
                      setLockerLines(next);
                    }} />
                    <Button variant="outline" onClick={() => setLockerLines((prev) => prev.filter((_, i) => i !== index))}>Remove</Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">Costumes (quantity only)</h3>
                  <Button variant="outline" onClick={() => setCostumeLines((prev) => [...prev, { costumeItemId: "", quantity: "1" }])}>Add</Button>
                </div>
                {costumeLines.map((line, index) => (
                  <div key={`c-${index}`} className="grid gap-3 md:grid-cols-[1fr_140px_auto] items-end">
                    <Select
                      label="Costume type"
                      value={line.costumeItemId}
                      onChange={(event) => {
                        const next = [...costumeLines];
                        next[index] = { ...next[index]!, costumeItemId: event.target.value };
                        setCostumeLines(next);
                      }}
                      options={[
                        { label: "Select costume type", value: "" },
                        ...(options?.costumeGroups ?? []).map((c) => ({ label: `${c.label} (${formatCurrency(c.rentalRate)}) · Avl ${c.availableQuantity}`, value: c.costumeItemId })),
                      ]}
                    />
                    <Input label="Qty" type="number" min={1} value={line.quantity} onChange={(e) => {
                      const next = [...costumeLines];
                      next[index] = { ...next[index]!, quantity: e.target.value };
                      setCostumeLines(next);
                    }} />
                    <Button variant="outline" onClick={() => setCostumeLines((prev) => prev.filter((_, i) => i !== index))}>Remove</Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">Rides</h3>
                  <Button variant="outline" onClick={() => setRideLines((prev) => [...prev, { rideId: "", quantity: "1" }])}>Add</Button>
                </div>
                {rideLines.map((line, index) => (
                  <div key={`r-${index}`} className="grid gap-3 md:grid-cols-[1fr_140px_auto] items-end">
                    <Select
                      label="Ride"
                      value={line.rideId}
                      onChange={(event) => {
                        const next = [...rideLines];
                        next[index] = { ...next[index]!, rideId: event.target.value };
                        setRideLines(next);
                      }}
                      options={[
                        { label: "Select ride", value: "" },
                        ...(options?.rides ?? []).map((r) => ({ label: `${r.name}${r.zoneName ? ` · ${r.zoneName}` : ""} (${formatCurrency(r.entryFee)})`, value: r.id })),
                      ]}
                    />
                    <Input label="Qty" type="number" min={1} value={line.quantity} onChange={(e) => {
                      const next = [...rideLines];
                      next[index] = { ...next[index]!, quantity: e.target.value };
                      setRideLines(next);
                    }} />
                    <Button variant="outline" onClick={() => setRideLines((prev) => prev.filter((_, i) => i !== index))}>Remove</Button>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Participants (Optional)</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              {participants.map((p, index) => (
                <div key={`pp-${index}`} className="grid gap-3 md:grid-cols-[1fr_120px_160px_auto] items-end">
                  <Input label="Name" value={p.name} onChange={(e) => {
                    const next = [...participants];
                    next[index] = { ...next[index]!, name: e.target.value };
                    setParticipants(next);
                  }} />
                  <Input label="Age" type="number" min={0} value={p.age ?? ""} onChange={(e) => {
                    const next = [...participants];
                    next[index] = { ...next[index]!, age: e.target.value };
                    setParticipants(next);
                  }} />
                  <Select
                    label="Gender"
                    value={p.gender ?? ""}
                    onChange={(e) => {
                      const next = [...participants];
                      next[index] = { ...next[index]!, gender: e.target.value as Participant["gender"] };
                      setParticipants(next);
                    }}
                    options={[
                      { label: "Select", value: "" },
                      { label: "Male", value: "MALE" },
                      { label: "Female", value: "FEMALE" },
                      { label: "Other", value: "OTHER" },
                    ]}
                  />
                  <Button variant="outline" onClick={() => setParticipants((prev) => prev.filter((_, i) => i !== index))}>Remove</Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => setParticipants((prev) => [...prev, { name: "" }])}>Add Participant</Button>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 self-start">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Cart Summary</h2>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              {totals.cartItems.length > 0 ? (
                <div className="space-y-2">
                  {totals.cartItems.map((item, index) => {
                    const previous = totals.cartItems[index - 1];
                    const showSectionLabel = !previous || previous.section !== item.section;
                    return (
                      <div key={item.key} className="space-y-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                        {showSectionLabel ? (
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{item.section}</p>
                        ) : null}
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[var(--color-text)]">{item.label}</p>
                          <p className="text-right text-xs text-[var(--color-text-muted)]">
                            {item.quantity} x {formatCurrency(item.unitPrice)} ={" "}
                            <span className="font-semibold text-[var(--color-text)]">{formatCurrency(item.lineTotal)}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)]">No items selected yet.</p>
              )}
              <div className="h-px bg-[var(--color-border)]" />
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">Subtotal</span>
                <span className="font-semibold text-[var(--color-text)]">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">GST</span>
                <span className="font-semibold text-[var(--color-text)]">{formatCurrency(totals.gst)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
                <span className="text-[var(--color-text)] font-semibold">Total</span>
                <span className="text-[var(--color-text)] font-semibold">{formatCurrency(totals.total)}</span>
              </div>

              <Button
                className="w-full mt-3"
                loading={submitting}
                onClick={() => void submit()}
                disabled={!canSubmitQueue}
              >
                Get Queue ID
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

