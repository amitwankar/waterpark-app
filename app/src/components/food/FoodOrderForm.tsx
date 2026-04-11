"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { formatCurrency } from "@/lib/utils";

interface Outlet { id: string; name: string; isOpen: boolean }

interface MenuVariant {
  id: string;
  name: string;
  price: number;
  preBookPrice: number | null;
  isDefault: boolean;
}

interface MenuModifierOption {
  id: string;
  name: string;
  price: number;
  isDefault?: boolean;
}

interface MenuModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: MenuModifierOption[];
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  gstRate: number;
  isVeg: boolean;
  variants?: MenuVariant[];
  modifierGroups?: MenuModifierGroup[];
}

interface Category {
  id: string;
  name: string;
  items: MenuItem[];
}

interface CartItem {
  key: string;
  foodItemId: string;
  foodVariantId?: string;
  name: string;
  variantName?: string;
  price: number;
  gstRate: number;
  isVeg: boolean;
  quantity: number;
  modifiers?: Array<{
    groupId: string;
    optionId: string;
    groupName: string;
    optionName: string;
    quantity: number;
    unitPrice: number;
  }>;
}

interface ServiceBooking {
  id: string;
  bookingNumber: string;
  guestName: string;
  guestMobile: string;
  services?: {
    locker?: { pending: number; delivered: number };
    costume?: { pending: number; delivered: number };
    food?: { pendingQty: number };
  };
}

interface Props {
  outlet: Outlet;
  onOrderCreated: () => void;
}

export function FoodOrderForm({ outlet, onOrderCreated }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedVariantByItem, setSelectedVariantByItem] = useState<Record<string, string>>({});
  const [selectedModifiersByItem, setSelectedModifiersByItem] = useState<Record<string, Record<string, string[]>>>({});
  const [guestName, setGuestName] = useState("");
  const [guestMobile, setGuestMobile] = useState("");
  const [bookingQuery, setBookingQuery] = useState("");
  const [bookingLookupError, setBookingLookupError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "WRISTBAND">("CASH");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/food/outlets/${outlet.id}/menu`);
        if (res.ok) {
          const data = (await res.json()) as { categories: Category[] };
          setCategories(data.categories);
          const next: Record<string, string> = {};
          for (const c of data.categories) {
            for (const item of c.items) {
              const variants = item.variants ?? [];
              const defaultVariant = variants.find((row) => row.isDefault) ?? variants[0];
              if (defaultVariant) next[item.id] = defaultVariant.id;
            }
          }
          setSelectedVariantByItem(next);
          const nextModifiers: Record<string, Record<string, string[]>> = {};
          for (const c of data.categories) {
            for (const item of c.items) {
              const byGroup: Record<string, string[]> = {};
              for (const group of item.modifierGroups ?? []) {
                const defaults = group.options.filter((o) => o.isDefault).map((o) => o.id);
                byGroup[group.id] = defaults.slice(0, Math.max(1, group.maxSelect || 1));
              }
              nextModifiers[item.id] = byGroup;
            }
          }
          setSelectedModifiersByItem(nextModifiers);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [outlet.id]);

  async function lookupBooking(): Promise<void> {
    const query = bookingQuery.trim();
    if (query.length < 3) {
      setBookingLookupError("Enter at least 3 characters.");
      return;
    }
    setBookingLookupError(null);
    const res = await fetch(`/api/v1/pos/booking-lookup?q=${encodeURIComponent(query)}&purpose=service`);
    const data = (await res.json().catch(() => [])) as ServiceBooking[] | { error?: string };
    if (!res.ok) {
      setBookingLookupError((data as { error?: string }).error ?? "Failed to lookup booking.");
      return;
    }
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) {
      setBookingLookupError("No checked-in booking found.");
      return;
    }
    setSelectedBooking(first);
    setGuestName(first.guestName);
    setGuestMobile(first.guestMobile);
    setBookingLookupError(null);
  }

  function clearLinkedBooking(): void {
    setSelectedBooking(null);
    setBookingQuery("");
    setBookingLookupError(null);
  }

  function resolveForCart(item: MenuItem): Omit<CartItem, "quantity"> {
    const selectedVariantId = selectedVariantByItem[item.id];
    const variant = item.variants?.find((row) => row.id === selectedVariantId);
    const chosenByGroup = selectedModifiersByItem[item.id] ?? {};
    const chosenModifiers: CartItem["modifiers"] = [];
    let modifierTotal = 0;
    const optionIdsForKey: string[] = [];

    for (const group of item.modifierGroups ?? []) {
      const ids = chosenByGroup[group.id] ?? [];
      for (const optionId of ids) {
        const option = group.options.find((row) => row.id === optionId);
        if (!option) continue;
        optionIdsForKey.push(option.id);
        const unitPrice = Number(option.price);
        modifierTotal += unitPrice;
        chosenModifiers.push({
          groupId: group.id,
          optionId: option.id,
          groupName: group.name,
          optionName: option.name,
          quantity: 1,
          unitPrice,
        });
      }
    }
    optionIdsForKey.sort();
    const keyBase = variant ? `${item.id}:${variant.id}` : item.id;
    const key = optionIdsForKey.length > 0 ? `${keyBase}:${optionIdsForKey.join(",")}` : keyBase;

    return {
      key,
      foodItemId: item.id,
      foodVariantId: variant?.id,
      name: item.name,
      variantName: variant?.name,
      price: (variant ? Number(variant.price) : Number(item.price)) + modifierTotal,
      gstRate: Number(item.gstRate),
      isVeg: item.isVeg,
      modifiers: chosenModifiers,
    };
  }

  function updateQty(item: MenuItem, delta: number) {
    const resolved = resolveForCart(item);
    setCart((prev) => {
      const existing = prev.find((c) => c.key === resolved.key);
      if (!existing) {
        if (delta <= 0) return prev;
        return [...prev, { ...resolved, quantity: delta }];
      }
      const next = existing.quantity + delta;
      if (next <= 0) return prev.filter((c) => c.key !== resolved.key);
      return prev.map((c) => (c.key === resolved.key ? { ...c, quantity: next } : c));
    });
  }

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const gst = cart.reduce((s, c) => s + c.price * c.quantity * (c.gstRate / 100), 0);
  const total = subtotal + gst;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0) { setError("Add at least one item."); return; }
    if (!guestName.trim()) { setError("Guest name is required."); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/food/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: outlet.id,
          bookingId: selectedBooking?.id,
          guestName: guestName.trim(),
          guestMobile: guestMobile.trim() || undefined,
          paymentMethod,
          notes: notes.trim() || undefined,
          items: cart.map((c) => ({
            foodItemId: c.foodItemId,
            foodVariantId: c.foodVariantId,
            modifiers: (c.modifiers ?? []).map((m) => ({
              groupId: m.groupId,
              optionId: m.optionId,
              quantity: m.quantity,
            })),
            quantity: c.quantity,
          })),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Failed to place order");
        return;
      }
      setCart([]);
      setGuestName("");
      setGuestMobile("");
      clearLinkedBooking();
      setNotes("");
      onOrderCreated();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {categories.map((cat) => (
          <div key={cat.id}>
            <h3 className="font-semibold text-[var(--color-text)] mb-3">{cat.name}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {cat.items.map((item) => {
                const selectedVariant = item.variants?.find((v) => v.id === selectedVariantByItem[item.id]);
                const activeKey = selectedVariant ? `${item.id}:${selectedVariant.id}` : item.id;
                const inCart = cart.find((c) => c.key === activeKey);
                const displayPrice = selectedVariant ? Number(selectedVariant.price) : Number(item.price);

                return (
                  <div key={item.id} className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                    <div className="flex items-center gap-3">
                      <span className={`h-3 w-3 shrink-0 rounded-full border-2 ${item.isVeg ? "border-green-600 bg-green-500" : "border-red-600 bg-red-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">{item.name}</p>
                        <p className="text-xs text-[var(--color-muted)]">{formatCurrency(displayPrice)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => updateQty(item, -1)} className="h-6 w-6 rounded border border-[var(--color-border)] text-sm leading-none hover:bg-[var(--color-border)]">−</button>
                        <span className="w-6 text-center text-sm">{inCart?.quantity ?? 0}</span>
                        <button type="button" onClick={() => updateQty(item, 1)} className="h-6 w-6 rounded border border-[var(--color-border)] text-sm leading-none hover:bg-[var(--color-border)]">+</button>
                      </div>
                    </div>
                    {(item.variants ?? []).length > 0 ? (
                      <div className="mt-2">
                        <Select
                          value={selectedVariantByItem[item.id] ?? ""}
                          onChange={(e) => setSelectedVariantByItem((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          options={(item.variants ?? []).map((v) => ({ label: `${v.name} - ${formatCurrency(v.price)}`, value: v.id }))}
                        />
                      </div>
                    ) : null}
                    {(item.modifierGroups ?? []).length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {(item.modifierGroups ?? []).map((group) => {
                          const selected = selectedModifiersByItem[item.id]?.[group.id] ?? [];
                          return (
                            <div key={group.id} className="rounded border border-[var(--color-border)] p-2">
                              <p className="text-xs font-medium text-[var(--color-text)]">
                                {group.name}
                                <span className="ml-1 text-[var(--color-text-muted)]">
                                  {group.isRequired ? "(required)" : "(optional)"} · max {group.maxSelect}
                                </span>
                              </p>
                              <div className="mt-1 grid grid-cols-1 gap-1">
                                {group.options.map((opt) => {
                                  const checked = selected.includes(opt.id);
                                  return (
                                    <label key={opt.id} className="flex items-center justify-between gap-2 text-xs">
                                      <span className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(e) => {
                                            setSelectedModifiersByItem((prev) => {
                                              const perItem = { ...(prev[item.id] ?? {}) };
                                              const current = [...(perItem[group.id] ?? [])];
                                              if (e.target.checked) {
                                                if (current.length >= group.maxSelect) return prev;
                                                current.push(opt.id);
                                              } else {
                                                const idx = current.indexOf(opt.id);
                                                if (idx >= 0) current.splice(idx, 1);
                                              }
                                              perItem[group.id] = current;
                                              return { ...prev, [item.id]: perItem };
                                            });
                                          }}
                                        />
                                        <span>{opt.name}</span>
                                      </span>
                                      <span>{Number(opt.price) > 0 ? `+${formatCurrency(opt.price)}` : "Free"}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
          <h3 className="font-semibold text-[var(--color-text)]">Order Summary</h3>

          {cart.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No items selected.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {cart.map((c) => (
                <li key={c.key} className="flex justify-between text-[var(--color-text)]">
                  <span>
                    {c.name}{c.variantName ? ` (${c.variantName})` : ""}
                    {c.modifiers?.length ? ` + ${c.modifiers.map((m) => m.optionName).join(", ")}` : ""}
                    {" × "}{c.quantity}
                  </span>
                  <span>{formatCurrency(c.price * c.quantity)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-[var(--color-border)] pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-[var(--color-muted)]"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-[var(--color-muted)]"><span>GST</span><span>{formatCurrency(gst)}</span></div>
            <div className="flex justify-between font-semibold text-[var(--color-text)]"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-2">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">Checked-in booking (optional)</p>
          <div className="flex gap-2">
            <input
              value={bookingQuery}
              onChange={(e) => setBookingQuery(e.target.value)}
              placeholder="Booking number / mobile"
              className="w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
            />
            <Button type="button" variant="outline" onClick={() => void lookupBooking()}>
              Load
            </Button>
          </div>
          {bookingLookupError ? <p className="text-xs text-red-500">{bookingLookupError}</p> : null}
          {selectedBooking ? (
            <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-muted)] space-y-1">
              <p className="font-medium text-[var(--color-text)]">{selectedBooking.bookingNumber} · {selectedBooking.guestName}</p>
              <p>Pre-booked food qty pending: {selectedBooking.services?.food?.pendingQty ?? 0}</p>
              <button
                type="button"
                onClick={clearLinkedBooking}
                className="text-[var(--color-primary)] hover:underline"
              >
                Use walk-in instead
              </button>
            </div>
          ) : null}
        </div>

        <Input
          label="Guest Name *"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Name on token"
          readOnly={Boolean(selectedBooking)}
        />
        <Input
          label="Mobile (optional)"
          value={guestMobile}
          onChange={(e) => setGuestMobile(e.target.value)}
          placeholder="10-digit mobile"
          readOnly={Boolean(selectedBooking)}
        />
        <Select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
          options={[
            { label: "Cash", value: "CASH" },
            { label: "UPI", value: "UPI" },
            { label: "Wristband", value: "WRISTBAND" },
          ]}
        />
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, special requests…" />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting || cart.length === 0}>
          {submitting ? "Placing Order…" : `Place Order · ${formatCurrency(total)}`}
        </Button>
      </div>
    </form>
  );
}
