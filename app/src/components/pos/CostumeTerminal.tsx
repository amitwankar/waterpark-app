"use client";

import { useCallback, useEffect, useState } from "react";
import { SessionCloser } from "./SessionCloser";

type SplitMethod = "CASH" | "MANUAL_UPI" | "CARD" | "COMPLIMENTARY";

interface CostumeItem {
  id: string;
  tagNumber: string;
  stockCode?: string | null;
  name: string;
  size: string;
  status: string;
  rentalRate: number;
  gstRate: number;
  availableQuantity?: number;
  category: { id: string; name: string };
}

interface CostumeProduct {
  id: string;
  stockCode?: string | null;
  tagNumber: string;
  name: string;
  size: string;
  categoryId: string;
  categoryName: string;
  rentalRate: number;
  gstRate: number;
  unitIds: string[];
  availableQuantity: number;
}

interface IssueCartLine {
  productId: string;
  name: string;
  tagNumber: string;
  size: string;
  categoryName: string;
  rentalRate: number;
  gstRate: number;
  unitIds: string[];
}

interface ActiveRental {
  id: string;
  guestName: string;
  guestMobile: string | null;
  rentedAt: string;
  dueAt: string;
  rentalAmount: number;
  depositPaid: boolean;
  costumeItem: { tagNumber: string; name: string; category: { name: string } };
  bookingId?: string | null;
  notes?: string | null;
}

interface RentalGroup {
  key: string;
  guestName: string;
  guestMobile: string | null;
  itemName: string;
  categoryName: string;
  dueAt: string;
  allottedQty: number;
  totalAmount: number;
  hasDepositPaid: boolean;
  rentalIds: string[];
  rentals: ActiveRental[];
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

type Tab = "rent" | "return";

const SIZE_LABELS: Record<string, string> = {
  XS: "XS", S: "S", M: "M", L: "L", XL: "XL", XXL: "XXL",
  KIDS_S: "Kids S", KIDS_M: "Kids M", KIDS_L: "Kids L",
};

const PAYMENT_METHODS: { value: SplitMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "MANUAL_UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "COMPLIMENTARY", label: "Complimentary" },
];

interface CostumeTerminalProps {
  sessionId: string;
  terminalId: string;
  cashierName: string;
  onSessionClosed: () => void;
}

export function CostumeTerminal({
  sessionId,
  terminalId,
  cashierName,
  onSessionClosed,
}: CostumeTerminalProps) {
  const [tab, setTab] = useState<Tab>("rent");
  const [items, setItems] = useState<CostumeProduct[]>([]);
  const [rentals, setRentals] = useState<ActiveRental[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingRentals, setLoadingRentals] = useState(false);
  const [catFilter, setCatFilter] = useState("ALL");
  const [sizeFilter, setSizeFilter] = useState("ALL");

  // Rent form state
  const [selectedItem, setSelectedItem] = useState<CostumeProduct | null>(null);
  const [issueCart, setIssueCart] = useState<IssueCartLine[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestMobile, setGuestMobile] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<SplitMethod>("CASH");
  const [bookingQuery, setBookingQuery] = useState("");
  const [bookingLookupError, setBookingLookupError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);
  const [deliverQty, setDeliverQty] = useState("1");
  const [depositAmount, setDepositAmount] = useState(0);
  const [renting, setRenting] = useState(false);
  const [rentError, setRentError] = useState<string | null>(null);
  const [rentSuccess, setRentSuccess] = useState<string | null>(null);

  // Return form state
  const [selectedRental, setSelectedRental] = useState<RentalGroup | null>(null);
  const [returnQty, setReturnQty] = useState("1");
  const [condition, setCondition] = useState("");
  const [depositRefunded, setDepositRefunded] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  const [showCloser, setShowCloser] = useState(false);

  function normalizeTagBase(tagNumber: string): string {
    return tagNumber.trim().toUpperCase().replace(/-\d{3}$/i, "");
  }

  function getGroupKey(item: CostumeItem): string {
    if (item.stockCode && item.stockCode.trim().length > 0) return `stock:${item.stockCode}`;
    return [
      item.category.id,
      item.name.trim().toLowerCase(),
      item.size,
      Number(item.rentalRate).toFixed(2),
      Number(item.gstRate).toFixed(2),
      normalizeTagBase(item.tagNumber),
    ].join("|");
  }

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await fetch("/api/v1/costumes/items?availableOnly=true");
      if (res.ok) {
        const raw = (await res.json()) as CostumeItem[];
        const grouped = new Map<string, CostumeProduct>();
        for (const item of raw) {
          const key = getGroupKey(item);
          const existing = grouped.get(key);
          if (existing) {
            existing.unitIds.push(item.id);
            existing.availableQuantity = existing.unitIds.length;
            continue;
          }
          grouped.set(key, {
            id: key,
            stockCode: item.stockCode,
            tagNumber: normalizeTagBase(item.tagNumber),
            name: item.name,
            size: item.size,
            categoryId: item.category.id,
            categoryName: item.category.name,
            rentalRate: Number(item.rentalRate),
            gstRate: Number(item.gstRate),
            unitIds: [item.id],
            availableQuantity: 1,
          });
        }
        setItems(Array.from(grouped.values()));
      }
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const loadRentals = useCallback(async () => {
    setLoadingRentals(true);
    try {
      const res = await fetch("/api/v1/costumes/rentals?active=true");
      if (res.ok) {
        const d = await res.json();
        const rows = (d.items ?? d) as ActiveRental[];
        setRentals(rows.filter((row) => !row.notes?.includes("PREBOOKED:PENDING")));
      }
    } finally {
      setLoadingRentals(false);
    }
  }, []);

  async function lookupBooking() {
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

  async function deliverBookedCostume() {
    if (!selectedBooking) return;
    const quantity = Math.max(1, Number(deliverQty || "1"));
    setRentError(null);
    const res = await fetch("/api/v1/costumes/rentals/deliver-booked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: selectedBooking.id,
        quantity,
        depositAmount: Math.max(0, Number(depositAmount || 0)),
        paymentMethod,
      }),
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setRentError(payload?.error ?? "Failed to deliver booked costume.");
      return;
    }
    await Promise.all([lookupBooking(), loadRentals()]);
  }

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { if (tab === "return") loadRentals(); }, [tab, loadRentals]);

  // Derived categories from items
  const categories = Array.from(new Set(items.map((i) => i.categoryName))).sort();
  const sizes = Array.from(new Set(items.map((i) => i.size))).sort();

  const filteredItems = items.filter((item) => {
    const matchCat = catFilter === "ALL" || item.categoryName === catFilter;
    const matchSize = sizeFilter === "ALL" || item.size === sizeFilter;
    return matchCat && matchSize;
  });

  const qty = Math.max(1, Number(quantity || "1"));
  const usedIssueUnitIds = new Set(issueCart.flatMap((line) => line.unitIds));
  const selectedAvailableQty = selectedItem
    ? selectedItem.unitIds.filter((unitId) => !usedIssueUnitIds.has(unitId)).length
    : 0;
  const effectiveQty = selectedItem ? Math.min(qty, Math.max(1, selectedAvailableQty)) : qty;
  const perUnitCharge = selectedItem
    ? Math.round(selectedItem.rentalRate * (1 + selectedItem.gstRate / 100) * 100) / 100
    : 0;
  const cartRentalTotal = Math.round(
    issueCart.reduce((sum, line) => sum + line.unitIds.length * line.rentalRate * (1 + line.gstRate / 100), 0) * 100,
  ) / 100;
  const cartQty = issueCart.reduce((sum, line) => sum + line.unitIds.length, 0);
  const totalWithDeposit = cartRentalTotal + Math.max(0, Number(depositAmount || 0));
  const rentalGroups = rentals.reduce<RentalGroup[]>((acc, rental) => {
    const key = [
      rental.guestName.trim().toLowerCase(),
      rental.guestMobile ?? "",
      rental.costumeItem.name.trim().toLowerCase(),
      rental.costumeItem.category.name.trim().toLowerCase(),
      new Date(rental.dueAt).toISOString(),
    ].join("|");
    const existing = acc.find((group) => group.key === key);
    if (existing) {
      existing.allottedQty += 1;
      existing.totalAmount += Number(rental.rentalAmount);
      existing.hasDepositPaid = existing.hasDepositPaid || rental.depositPaid;
      existing.rentalIds.push(rental.id);
      existing.rentals.push(rental);
      return acc;
    }
    acc.push({
      key,
      guestName: rental.guestName,
      guestMobile: rental.guestMobile,
      itemName: rental.costumeItem.name,
      categoryName: rental.costumeItem.category.name,
      dueAt: rental.dueAt,
      allottedQty: 1,
      totalAmount: Number(rental.rentalAmount),
      hasDepositPaid: rental.depositPaid,
      rentalIds: [rental.id],
      rentals: [rental],
    });
    return acc;
  }, []);

  function addSelectedToCart() {
    if (!selectedItem) {
      setRentError("Select a costume first.");
      return;
    }
    const requestedQty = Math.max(1, Number(quantity || "1"));
    const remainingUnitIds = selectedItem.unitIds.filter((unitId) => !usedIssueUnitIds.has(unitId));
    if (remainingUnitIds.length <= 0) {
      setRentError(`No available unit left for ${selectedItem.name}.`);
      return;
    }
    if (requestedQty > remainingUnitIds.length) {
      setRentError(`Only ${remainingUnitIds.length} item(s) available for ${selectedItem.name}.`);
      return;
    }
    const pickedUnitIds = remainingUnitIds.slice(0, requestedQty);
    setIssueCart((prev) => {
      const existingIndex = prev.findIndex((line) => line.productId === selectedItem.id);
      if (existingIndex < 0) {
        return [
          ...prev,
          {
            productId: selectedItem.id,
            name: selectedItem.name,
            tagNumber: selectedItem.tagNumber,
            size: selectedItem.size,
            categoryName: selectedItem.categoryName,
            rentalRate: selectedItem.rentalRate,
            gstRate: selectedItem.gstRate,
            unitIds: pickedUnitIds,
          },
        ];
      }
      return prev.map((line, index) =>
        index === existingIndex
          ? {
              ...line,
              unitIds: [...line.unitIds, ...pickedUnitIds],
            }
          : line,
      );
    });
    setRentError(null);
    setQuantity("1");
  }

  function getMaxQtyForProduct(productId: string, cartLines: IssueCartLine[] = issueCart): number {
    const product = items.find((row) => row.id === productId);
    if (!product) return 0;
    const otherUsedUnitIds = new Set(
      cartLines
        .filter((line) => line.productId !== productId)
        .flatMap((line) => line.unitIds),
    );
    return product.unitIds.filter((unitId) => !otherUsedUnitIds.has(unitId)).length;
  }

  function incrementCartLine(productId: string): void {
    setIssueCart((prev) => {
      const line = prev.find((row) => row.productId === productId);
      if (!line) return prev;
      const product = items.find((row) => row.id === productId);
      if (!product) return prev;

      const otherUsedUnitIds = new Set(
        prev
          .filter((row) => row.productId !== productId)
          .flatMap((row) => row.unitIds),
      );
      const selectableUnitIds = product.unitIds.filter((unitId) => !otherUsedUnitIds.has(unitId));
      if (line.unitIds.length >= selectableUnitIds.length) return prev;

      const nextUnitId = selectableUnitIds.find((unitId) => !line.unitIds.includes(unitId));
      if (!nextUnitId) return prev;

      return prev.map((row) =>
        row.productId === productId ? { ...row, unitIds: [...row.unitIds, nextUnitId] } : row,
      );
    });
  }

  function decrementCartLine(productId: string): void {
    setIssueCart((prev) => {
      const line = prev.find((row) => row.productId === productId);
      if (!line) return prev;
      if (line.unitIds.length <= 1) {
        return prev.filter((row) => row.productId !== productId);
      }
      return prev.map((row) =>
        row.productId === productId ? { ...row, unitIds: row.unitIds.slice(0, -1) } : row,
      );
    });
  }

  async function handleRent() {
    if (issueCart.length === 0 || !guestName.trim()) {
      setRentError("Add costume(s) to cart and enter guest name."); return;
    }
    setRenting(true); setRentError(null);
    try {
      const chosenUnitIds = issueCart.flatMap((line) => line.unitIds);
      const res = await fetch("/api/v1/costumes/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          costumeItemIds: chosenUnitIds,
          bookingId: selectedBooking?.id,
          posSessionId: sessionId,
          guestName: guestName.trim(),
          guestMobile: guestMobile.trim() || undefined,
          paymentMethod,
          depositAmount: Math.max(0, Number(depositAmount || 0)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Rental failed");
      setRentSuccess(`${chosenUnitIds.length} costume item(s) issued to ${guestName}.`);
      setSelectedItem(null);
      setIssueCart([]);
      setGuestName("");
      setGuestMobile("");
      setQuantity("1");
      setDepositAmount(0);
      loadItems();
    } catch (e: unknown) {
      setRentError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRenting(false);
    }
  }

  async function handleReturn() {
    if (!selectedRental) return;
    const qtyToReturn = Math.max(1, Number(returnQty || "1"));
    if (qtyToReturn > selectedRental.allottedQty) {
      setReturnError(`Return qty cannot exceed allotted qty (${selectedRental.allottedQty}).`);
      return;
    }
    setReturning(true); setReturnError(null);
    try {
      const targets = selectedRental.rentalIds.slice(0, qtyToReturn);
      for (let index = 0; index < targets.length; index += 1) {
        const rentalId = targets[index];
        const res = await fetch(`/api/v1/costumes/rentals/${rentalId}/return`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            condition,
            depositRefunded: depositRefunded && index === 0,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Return failed");
      }
      setSelectedRental(null);
      setCondition("");
      setDepositRefunded(false);
      setReturnQty("1");
      loadRentals();
      loadItems();
    } catch (e: unknown) {
      setReturnError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setReturning(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Header */}
      <header className="bg-[var(--color-primary)] text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-sm">👘</div>
          <div>
            <p className="font-bold text-sm leading-none">Costume Rental Counter</p>
            <p className="text-xs text-white/80 mt-0.5">{terminalId} · {cashierName}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCloser(true)}
          className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
        >
          Close Session
        </button>
      </header>

      {/* Tabs */}
      <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 flex gap-4 shrink-0">
        {(["rent", "return"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {t === "rent" ? `Issue Costume (${filteredItems.length} available)` : `Return Costume (${rentalGroups.length} active groups)`}
          </button>
        ))}
      </div>

      {tab === "rent" ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: costume picker */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Success banner */}
            {rentSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm flex justify-between">
                <span>✓ {rentSuccess}</span>
                <button onClick={() => setRentSuccess(null)} className="text-green-600 hover:text-green-800">✕</button>
              </div>
            )}

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                className="border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm"
              >
                <option value="ALL">All Sizes</option>
                {sizes.map((s) => <option key={s} value={s}>{SIZE_LABELS[s] ?? s}</option>)}
              </select>
            </div>

            {/* Costume grid */}
            {loadingItems ? (
              <p className="text-center text-gray-400 py-8">Loading…</p>
            ) : filteredItems.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No costumes available with current filters.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`text-left border-2 rounded-xl p-3 transition-all ${
                      selectedItem?.id === item.id
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]"
                    }`}
                  >
                    <p className="font-mono text-xs text-[var(--color-text-muted)] mb-0.5">{item.tagNumber}</p>
                    <p className="font-semibold text-sm text-[var(--color-text)]">{item.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{item.categoryName} · {SIZE_LABELS[item.size] ?? item.size}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Available: {item.availableQuantity}</p>
                    <p className="text-sm font-bold text-[var(--color-primary)] mt-1">₹{Number(item.rentalRate).toFixed(0)} + {Number(item.gstRate).toFixed(0)}% GST</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: rental form */}
          <div className="w-80 shrink-0 flex flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">Rental Details</h3>

              {selectedItem ? (
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl p-3">
                  <p className="font-mono text-xs text-[var(--color-text-muted)]">{selectedItem.tagNumber}</p>
                  <p className="font-bold text-[var(--color-text)]">{selectedItem.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{selectedItem.categoryName} · {SIZE_LABELS[selectedItem.size] ?? selectedItem.size}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">Available: {selectedAvailableQty}</p>
                </div>
              ) : (
                <div className="bg-[var(--color-surface-2)] border border-dashed border-[var(--color-border)] rounded-xl p-4 text-center text-sm text-[var(--color-text-muted)]">
                  Select a costume from the left
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Checked-in Booking (optional)</label>
                <div className="flex gap-2">
                  <input
                    value={bookingQuery}
                    onChange={(e) => setBookingQuery(e.target.value)}
                    placeholder="Booking number / mobile"
                    className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void lookupBooking()}
                    className="px-3 py-2 rounded bg-[var(--color-primary)] text-white text-xs"
                  >
                    Load
                  </button>
                </div>
                {bookingLookupError ? <p className="mt-1 text-xs text-red-500">{bookingLookupError}</p> : null}
                {selectedBooking ? (
                  <div className="mt-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 text-xs space-y-1">
                    <p className="font-medium text-[var(--color-text)]">{selectedBooking.bookingNumber} · {selectedBooking.guestName}</p>
                    <p className="text-[var(--color-text-muted)]">Costume booked pending: {selectedBooking.services?.costume?.pending ?? 0}</p>
                    {(selectedBooking.services?.costume?.pending ?? 0) > 0 ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={selectedBooking.services?.costume?.pending ?? 1}
                          value={deliverQty}
                          onChange={(e) => setDeliverQty(e.target.value)}
                          className="w-20 border border-[var(--color-border)] bg-[var(--color-surface)] rounded px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => void deliverBookedCostume()}
                          className="px-2 py-1 rounded bg-[var(--color-primary)] text-white text-xs"
                        >
                          Deliver Booked
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Guest Name *</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  readOnly={Boolean(selectedBooking)}
                  placeholder="Guest name"
                  className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Mobile</label>
                <input
                  type="tel"
                  value={guestMobile}
                  onChange={(e) => setGuestMobile(e.target.value)}
                  maxLength={10}
                  readOnly={Boolean(selectedBooking)}
                  placeholder="10-digit mobile"
                  className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, selectedAvailableQty)}
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setRentError(null);
                  }}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <button
                  type="button"
                  onClick={addSelectedToCart}
                  disabled={!selectedItem || selectedAvailableQty <= 0}
                  className="mt-2 w-full rounded-lg border border-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 disabled:opacity-40"
                >
                  Add To Cart
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setPaymentMethod(m.value)}
                      className={`py-2 text-xs rounded-lg border font-medium transition-colors ${
                        paymentMethod === m.value
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                          : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Deposit Amount (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Math.max(0, Number(e.target.value || "0")))}
                  className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Refund this amount on return if applicable.</p>
              </div>

              {issueCart.length > 0 ? (
                <div className="bg-[var(--color-surface-2)] rounded-xl p-3 text-sm space-y-2 border border-[var(--color-border)]">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)]">Costumes In Cart</p>
                  {issueCart.map((line) => (
                    <div key={line.productId} className="flex items-center justify-between rounded border border-[var(--color-border)] px-2 py-1.5">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text)]">{line.name}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          {line.categoryName} · {SIZE_LABELS[line.size] ?? line.size} · Qty {line.unitIds.length}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => decrementCartLine(line.productId)}
                          className="h-7 w-7 rounded border border-[var(--color-border)] text-sm text-[var(--color-text)] hover:bg-[var(--color-surface)]"
                          title="Decrease quantity"
                        >
                          -
                        </button>
                        <span className="min-w-6 text-center text-xs font-semibold text-[var(--color-text)]">{line.unitIds.length}</span>
                        <button
                          type="button"
                          onClick={() => incrementCartLine(line.productId)}
                          disabled={line.unitIds.length >= getMaxQtyForProduct(line.productId)}
                          className="h-7 w-7 rounded border border-[var(--color-border)] text-sm text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-40"
                          title="Increase quantity"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => setIssueCart((prev) => prev.filter((row) => row.productId !== line.productId))}
                          className="ml-1 text-xs text-red-600 hover:text-red-700"
                          title="Remove from cart"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {(selectedItem || issueCart.length > 0) && (
                <div className="bg-[var(--color-surface-2)] rounded-xl p-3 text-sm space-y-1 border border-[var(--color-border)]">
                  <div className="flex justify-between text-[var(--color-text-muted)]">
                    <span>Costume Rental Total</span>
                    <span>₹{cartRentalTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-text-muted)]">
                    <span>Total Qty</span>
                    <span>{cartQty}</span>
                  </div>
                  {depositAmount > 0 && (
                    <div className="flex justify-between text-[var(--color-text-muted)]">
                      <span>Deposit</span>
                      <span>₹{Number(depositAmount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-[var(--color-text)] border-t border-[var(--color-border)] pt-1">
                    <span>Total Collect</span>
                    <span>₹{totalWithDeposit.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {rentError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{rentError}</p>
              )}
            </div>

            <div className="p-4 border-t border-gray-100">
              <button
                onClick={handleRent}
                disabled={renting || issueCart.length === 0 || !guestName.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm"
              >
                {renting ? "Processing…" : `Checkout ${cartQty} item(s) · ₹${totalWithDeposit.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Return tab */
        <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-4">
          {!selectedRental ? (
            <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
              <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">
                Active Rentals
                {loadingRentals && <span className="text-[var(--color-text-muted)] font-normal ml-2">Loading…</span>}
              </h3>
              {rentals.length === 0 && !loadingRentals ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-6">No active rentals</p>
              ) : (
                <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
                  {rentalGroups.map((group) => {
                    const isOverdue = new Date(group.dueAt) < new Date();
                    return (
                      <button
                        key={group.key}
                        onClick={() => {
                          setSelectedRental(group);
                          setDepositRefunded(false);
                          setCondition("");
                          setReturnQty("1");
                          setReturnError(null);
                        }}
                        className={`w-full text-left border rounded-xl p-3 hover:border-purple-400 hover:bg-purple-50 transition-colors ${isOverdue ? "border-red-300 bg-red-50" : "border-gray-200"}`}
                      >
                        <div className="flex justify-between">
                          <div>
                            <span className="font-mono text-xs text-gray-500">{group.categoryName}</span>
                            <span className="text-sm font-medium text-gray-900 ml-2">{group.itemName}</span>
                            {isOverdue && <span className="ml-2 text-xs text-red-600 font-medium">OVERDUE</span>}
                          </div>
                          <span className="text-sm font-semibold">Qty {group.allottedQty}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {group.guestName} · Due: {new Date(group.dueAt).toLocaleTimeString()} · ₹{group.totalAmount.toFixed(2)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[var(--color-surface)] rounded-xl p-5 space-y-4 border border-[var(--color-border)]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-mono text-sm text-[var(--color-text-muted)]">{selectedRental.categoryName}</p>
                  <p className="font-bold text-[var(--color-text)]">{selectedRental.itemName}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Rented by: {selectedRental.guestName}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--color-text-muted)]">Due</p>
                  <p className={`text-sm font-semibold ${new Date(selectedRental.dueAt) < new Date() ? "text-red-600" : "text-[var(--color-text)]"}`}>
                    {new Date(selectedRental.dueAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Allotted Qty</label>
                  <input
                    type="text"
                    readOnly
                    value={String(selectedRental.allottedQty)}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Return Qty</label>
                  <input
                    type="number"
                    min={1}
                    max={selectedRental.allottedQty}
                    value={returnQty}
                    onChange={(e) => setReturnQty(e.target.value)}
                    className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Condition on Return</label>
                <textarea
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  rows={2}
                  placeholder="Good / Minor stain / Torn… (optional)"
                  className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                />
              </div>

              {selectedRental.hasDepositPaid && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={depositRefunded}
                    onChange={(e) => setDepositRefunded(e.target.checked)}
                    className="rounded text-[var(--color-primary)]"
                  />
                  <span className="text-sm text-[var(--color-text)]">Refund deposit to guest</span>
                </label>
              )}

              {returnError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{returnError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedRental(null)}
                  className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 text-sm"
                >
                  Back
                </button>
                <button
                  onClick={handleReturn}
                  disabled={returning}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-sm"
                >
                  {returning ? "Processing…" : "Accept Return"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showCloser && (
        <SessionCloser
          sessionId={sessionId}
          onClosed={onSessionClosed}
          onCancel={() => setShowCloser(false)}
        />
      )}
    </div>
  );
}
