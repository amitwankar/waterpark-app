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
type LockerProduct = { lockerId: string; label: string; rate: number; gstRate: number };
type CostumeGroup = { costumeItemId: string; label: string; rentalRate: number; gstRate: number; availableQuantity: number };
type RideOption = { id: string; name: string; zoneName?: string | null; entryFee: number; gstRate: number };

type QueueOptionsResponse = {
  queue: { limitPerDay: number; prefix: string; todayCount: number };
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

export default function PublicQueuePage(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<QueueOptionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [guestName, setGuestName] = useState("");
  const [guestMobile, setGuestMobile] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [ticketLines, setTicketLines] = useState<Array<{ ticketTypeId: string; quantity: string }>>([{ ticketTypeId: "", quantity: "1" }]);
  const [packageLines, setPackageLines] = useState<Array<{ packageId: string; quantity: string }>>([]);
  const [foodLines, setFoodLines] = useState<Array<{ optionId: string; quantity: string }>>([]);
  const [lockerLines, setLockerLines] = useState<Array<{ lockerId: string; quantity: string }>>([]);
  const [costumeLines, setCostumeLines] = useState<Array<{ costumeItemId: string; quantity: string }>>([]);
  const [rideLines, setRideLines] = useState<Array<{ rideId: string; quantity: string }>>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ queueCode: string; totalAmount: number } | null>(null);

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
    if (!options) return { subtotal: 0, gst: 0, total: 0 };

    const ticketMap = new Map(options.tickets.map((t) => [t.id, t]));
    const packageMap = new Map(options.packages.map((p) => [p.id, p]));
    const foodMap = new Map(options.foodOptions.map((f) => [f.id, f]));
    const lockerMap = new Map(options.lockerProducts.map((l) => [l.lockerId, l]));
    const costumeMap = new Map(options.costumeGroups.map((c) => [c.costumeItemId, c]));
    const rideMap = new Map(options.rides.map((r) => [r.id, r]));

    let subtotal = 0;
    let gst = 0;

    for (const line of ticketLines) {
      const t = ticketMap.get(line.ticketTypeId);
      if (!t) continue;
      const qty = Math.max(1, Number(line.quantity || "1"));
      subtotal += t.price * qty;
      gst += t.price * qty * (t.gstRate / 100);
    }
    for (const line of packageLines) {
      const p = packageMap.get(line.packageId);
      if (!p) continue;
      const qty = Math.max(1, Number(line.quantity || "1"));
      subtotal += p.salePrice * qty;
      gst += p.salePrice * qty * (p.gstRate / 100);
    }
    for (const line of foodLines) {
      const f = foodMap.get(line.optionId);
      if (!f) continue;
      const qty = Math.max(1, Number(line.quantity || "1"));
      subtotal += f.price * qty;
      gst += f.price * qty * (f.gstRate / 100);
    }
    for (const line of lockerLines) {
      const l = lockerMap.get(line.lockerId);
      if (!l) continue;
      const qty = Math.max(1, Number(line.quantity || "1"));
      subtotal += l.rate * qty;
      gst += l.rate * qty * (l.gstRate / 100);
    }
    for (const line of costumeLines) {
      const c = costumeMap.get(line.costumeItemId);
      if (!c) continue;
      const qty = Math.max(1, Number(line.quantity || "1"));
      subtotal += c.rentalRate * qty;
      gst += c.rentalRate * qty * (c.gstRate / 100);
    }
    for (const line of rideLines) {
      const r = rideMap.get(line.rideId);
      if (!r) continue;
      const qty = Math.max(1, Number(line.quantity || "1"));
      subtotal += r.entryFee * qty;
      gst += r.entryFee * qty * (r.gstRate / 100);
    }

    subtotal = roundMoney(subtotal);
    gst = roundMoney(gst);
    return { subtotal, gst, total: roundMoney(subtotal + gst) };
  }, [options, ticketLines, packageLines, foodLines, lockerLines, costumeLines, rideLines]);

  async function submit(): Promise<void> {
    if (!options) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        guestName,
        guestMobile,
        guestEmail,
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
          .filter((l) => l.lockerId)
          .map((l) => ({ lockerId: l.lockerId, quantity: Math.max(1, Number(l.quantity || "1")) })),
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
      setCreated({ queueCode: data.queueCode, totalAmount: Number(data.totalAmount ?? totals.total) });
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
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card>
          <CardHeader>
            <h1 className="text-xl font-semibold text-[var(--color-text)]">Queue Created</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Show this queue ID at the ticket counter.</p>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Queue ID</p>
                <p className="text-2xl font-semibold text-[var(--color-text)]">{created.queueCode}</p>
              </div>
              <Badge variant="info">No payment yet</Badge>
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">
              <p>Total to pay at counter: <span className="font-semibold text-[var(--color-text)]">{formatCurrency(created.totalAmount)}</span></p>
              <p className="mt-2">The operator will search this queue ID in POS, confirm items, collect payment, and print the final entry ticket.</p>
            </div>
            <Button onClick={() => window.location.reload()}>Create Another Queue</Button>
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
              <Input label="Mobile (optional)" value={guestMobile} onChange={(e) => setGuestMobile(e.target.value)} placeholder="10-digit mobile" />
              <Input label="Email (optional)" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
              <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </CardBody>
          </Card>

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
                  <Button variant="outline" onClick={() => setLockerLines((prev) => [...prev, { lockerId: "", quantity: "1" }])}>Add</Button>
                </div>
                {lockerLines.map((line, index) => (
                  <div key={`l-${index}`} className="grid gap-3 md:grid-cols-[1fr_140px_auto] items-end">
                    <Select
                      label="Locker type"
                      value={line.lockerId}
                      onChange={(event) => {
                        const next = [...lockerLines];
                        next[index] = { ...next[index]!, lockerId: event.target.value };
                        setLockerLines(next);
                      }}
                      options={[
                        { label: "Select locker type", value: "" },
                        ...(options?.lockerProducts ?? []).map((l) => ({ label: `${l.label} (${formatCurrency(l.rate)})`, value: l.lockerId })),
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
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Total</h2>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
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
                disabled={!guestName.trim() || totals.total <= 0}
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

