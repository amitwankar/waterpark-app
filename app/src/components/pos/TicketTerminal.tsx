"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart } from "./useCart";
import { TicketSelector } from "./TicketSelector";
import { CartSummary } from "./CartSummary";
import { CouponInput } from "./CouponInput";
import { SplitPaymentBuilder } from "./SplitPaymentBuilder";
import { ReceiptModal } from "./ReceiptModal";
import { SessionCloser } from "./SessionCloser";
import { BookingLookup } from "./BookingLookup";

type Tab = "walkin" | "balance";

interface TicketTerminalProps {
  sessionId: string;
  terminalId: string;
  cashierName: string;
  onSessionClosed: () => void;
}

type IdProofType = "AADHAAR" | "DRIVING_LICENSE" | "PAN" | "PASSPORT" | "VOTER_ID" | "OTHER";

interface LookupBooking {
  id: string;
  bookingNumber: string;
  guestName: string;
  guestMobile: string;
  visitDate: string;
  tickets: Array<{
    ticketTypeId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    gstRate: number;
  }>;
}

interface FoodOption {
  id: string;
  foodItemId: string;
  foodVariantId?: string;
  name: string;
  variantName?: string;
  price: number;
  gstRate: number;
}

interface LockerOption {
  id: string;
  number: string;
  rate: number;
  gstRate?: number;
  zoneName?: string;
}

interface CostumeOption {
  id: string;
  name: string;
  tagNumber: string;
  categoryId: string;
  categoryName: string;
  rentalRate: number;
  gstRate: number;
  availableQuantity: number;
  unitIds: string[];
}

interface RideAddOnOption {
  rideName: string;
  price: number;
  gstRate: number;
  rideId: string;
}

type PaymentMethodOption = {
  value: "CASH" | "MANUAL_UPI" | "CARD" | "COMPLIMENTARY";
  label: string;
  icon: string;
};

type ParticipantRow = {
  key: string;
  ticketTypeId: string;
  ticketName: string;
  name: string;
  gender: "" | "MALE" | "FEMALE" | "OTHER";
  age: string;
  isLeadGuest: boolean;
};

function normalizeTagBase(tagNumber: string): string {
  return tagNumber.trim().toUpperCase().replace(/-\d{3}$/i, "");
}

export function TicketTerminal({
  sessionId,
  terminalId,
  cashierName,
  onSessionClosed,
}: TicketTerminalProps) {
  const cart = useCart();
  const [tab, setTab] = useState<Tab>("walkin");
  const [guestName, setGuestName] = useState("");
  const [guestMobile, setGuestMobile] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [idProofType, setIdProofType] = useState<IdProofType>("AADHAAR");
  const [idProofNumber, setIdProofNumber] = useState("");
  const [idProofLabel, setIdProofLabel] = useState("");
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptRef, setReceiptRef] = useState<string | null>(null);
  const [showCloser, setShowCloser] = useState(false);
  const [linkedBookingNumber, setLinkedBookingNumber] = useState<string | null>(null);
  const [foodOptions, setFoodOptions] = useState<FoodOption[]>([]);
  const [lockerOptions, setLockerOptions] = useState<LockerOption[]>([]);
  const [costumeOptions, setCostumeOptions] = useState<CostumeOption[]>([]);

  const [foodItemId, setFoodItemId] = useState("");
  const [foodQty, setFoodQty] = useState("1");
  const [foodLines, setFoodLines] = useState<
    Array<{
      foodItemId: string;
      foodVariantId?: string;
      name: string;
      quantity: number;
      amount: number;
      baseAmount: number;
      gstRate: number;
    }>
  >([]);

  const [lockerId, setLockerId] = useState("");
  const [lockerQty, setLockerQty] = useState("1");
  const [lockerLines, setLockerLines] = useState<Array<{
    lockerId: string;
    number: string;
    amount: number;
    baseAmount: number;
    gstRate: number;
  }>>([]);

  const [costumeId, setCostumeId] = useState("");
  const [costumeQty, setCostumeQty] = useState("1");
  const [costumeLines, setCostumeLines] = useState<Array<{
    costumeItemId: string;
    name: string;
    tagNumber: string;
    durationHours: number;
    amount: number;
    baseAmount: number;
    gstRate: number;
  }>>([]);
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<PaymentMethodOption[]>([
    { value: "CASH", label: "Cash", icon: "💵" },
    { value: "CARD", label: "Card", icon: "💳" },
  ]);
  const [splitMinAmount, setSplitMinAmount] = useState(10);
  const [splitMaxMethods, setSplitMaxMethods] = useState(4);
  const [idProofEnabled, setIdProofEnabled] = useState(false);
  const [idProofRequiredAbove, setIdProofRequiredAbove] = useState(10);
  const [lockerGstRate, setLockerGstRate] = useState(0);
  const [defaultGstRate, setDefaultGstRate] = useState(18);
  const [rideOptions, setRideOptions] = useState<RideAddOnOption[]>([]);
  const [rideTicketId, setRideTicketId] = useState("");
  const [rideQty, setRideQty] = useState("1");
  const [rideLines, setRideLines] = useState<Array<{
    rideId: string;
    name: string;
    quantity: number;
    amount: number;
    baseAmount: number;
    gstRate: number;
  }>>([]);
  const [addOnError, setAddOnError] = useState<string | null>(null);
  const [importCandidate, setImportCandidate] = useState<LookupBooking | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const COSTUME_DURATION_HOURS = 4;

  // Balance collection state
  const [selectedBooking, setSelectedBooking] = useState<{
    id: string; bookingNumber: string; guestName: string; balance: number;
  } | null>(null);
  const [balanceSplitLines, setBalanceSplitLines] = useState<{ method: "CASH" | "MANUAL_UPI" | "CARD" | "COMPLIMENTARY"; amount: number }[]>([]);
  const [balanceNotes, setBalanceNotes] = useState("");
  const [collectingBalance, setCollectingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balanceReceiptRef, setBalanceReceiptRef] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch("/api/v1/food/items?available=true")
        .then(async (response) => {
          if (!response.ok) return [] as FoodOption[];
          const payload = (await response.json()) as Array<{
            id: string;
            name: string;
            price: number;
            gstRate?: number;
            variants?: Array<{
              id: string;
              name: string;
              price: number;
              isAvailable?: boolean;
            }>;
          }>;
          const options: FoodOption[] = [];
          for (const item of payload) {
            options.push({
              id: item.id,
              foodItemId: item.id,
              name: item.name,
              price: Number(item.price),
              gstRate: Number(item.gstRate ?? 0),
            });
            const variants = item.variants ?? [];
            for (const variant of variants) {
              if (variant.isAvailable === false) continue;
              options.push({
                id: `${item.id}__${variant.id}`,
                foodItemId: item.id,
                foodVariantId: variant.id,
                name: item.name,
                variantName: variant.name,
                price: Number(variant.price),
                gstRate: Number(item.gstRate ?? 0),
              });
            }
          }
          return options;
        })
        .catch(() => [] as FoodOption[]),
      fetch("/api/v1/lockers?status=AVAILABLE")
        .then(async (response) => {
          if (!response.ok) return [] as LockerOption[];
          const payload = (await response.json()) as Array<{ id: string; number: string; rate?: number; gstRate?: number }>;
          return payload.map((locker) => ({
            id: locker.id,
            number: locker.number,
            rate: Number(locker.rate ?? 299),
            gstRate: Number(locker.gstRate ?? 0),
            zoneName: (locker as { zone?: { name?: string } }).zone?.name,
          }));
        })
        .catch(() => [] as LockerOption[]),
      fetch("/api/v1/costumes/items?availableOnly=true")
        .then(async (response) => {
          if (!response.ok) return [] as CostumeOption[];
          const payload = (await response.json()) as Array<{
            id: string;
            name: string;
            tagNumber: string;
            stockCode?: string | null;
            category: { id: string; name: string };
            rentalRate: number;
            gstRate?: number;
            availableQuantity?: number;
          }>;
          const grouped = new Map<string, CostumeOption>();
          for (const item of payload) {
            const baseTag = normalizeTagBase(item.tagNumber);
            const key = item.stockCode
              ? `stock:${item.stockCode}`
              : `${item.category.id}|${item.name.toLowerCase()}|${Number(item.rentalRate).toFixed(2)}|${baseTag}`;
            const existing = grouped.get(key);
            if (existing) {
              existing.unitIds.push(item.id);
              existing.availableQuantity = existing.unitIds.length;
              continue;
            }
            grouped.set(key, {
              id: key,
              name: item.name,
              tagNumber: baseTag,
              categoryId: item.category.id,
              categoryName: item.category.name,
              rentalRate: Number(item.rentalRate),
              gstRate: Number(item.gstRate ?? 0),
              availableQuantity: 1,
              unitIds: [item.id],
            });
          }
          return Array.from(grouped.values()).sort((a, b) => {
            if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName);
            return a.name.localeCompare(b.name);
          });
        })
        .catch(() => [] as CostumeOption[]),
      fetch("/api/v1/rides?status=ACTIVE")
        .then(async (response) => {
          if (!response.ok) return [] as Array<{ id: string; name: string; entryFee?: number; gstRate?: number }>;
          const payload = (await response.json()) as {
            items?: Array<{ id: string; name: string; entryFee?: number; gstRate?: number }>;
          };
          return payload.items ?? [];
        })
        .catch(() => [] as Array<{ id: string; name: string; entryFee?: number; gstRate?: number }>),
      fetch("/api/v1/pos/payment-options")
        .then(async (response) => {
          if (!response.ok) return null;
          return (await response.json()) as {
            methods?: PaymentMethodOption[];
            split?: { minAmount?: number; maxMethods?: number };
            idProof?: { enabled?: boolean; requiredAbove?: number };
          };
        })
        .catch(() => null),
      fetch("/api/v1/park-config")
        .then(async (response) => {
          if (!response.ok) return null;
          return (await response.json()) as { lockerGstRate?: number; defaultGstRate?: number };
        })
        .catch(() => null),
    ]).then(([foods, lockers, costumes, rides, paymentOptions, parkConfig]) => {
      setFoodOptions(foods);
      setLockerOptions(lockers);
      setCostumeOptions(costumes);
      const resolvedDefaultGst = typeof parkConfig?.defaultGstRate === "number" ? parkConfig.defaultGstRate : defaultGstRate;
      const rideAddOns = rides.map((ride) => ({
        rideId: ride.id,
        rideName: ride.name,
        price: Number(ride.entryFee ?? 0),
        gstRate: Number(ride.gstRate ?? resolvedDefaultGst),
      }));
      setRideOptions(rideAddOns.sort((a, b) => a.rideName.localeCompare(b.rideName)));
      if (paymentOptions?.methods?.length) {
        setPaymentMethodOptions(paymentOptions.methods);
      }
      if (paymentOptions?.split?.minAmount) {
        setSplitMinAmount(paymentOptions.split.minAmount);
      }
      if (paymentOptions?.split?.maxMethods) {
        setSplitMaxMethods(paymentOptions.split.maxMethods);
      }
      setIdProofEnabled(Boolean(paymentOptions?.idProof?.enabled));
      if (typeof paymentOptions?.idProof?.requiredAbove === "number") {
        setIdProofRequiredAbove(paymentOptions.idProof.requiredAbove);
      }
      if (typeof parkConfig?.lockerGstRate === "number") {
        setLockerGstRate(parkConfig.lockerGstRate);
      }
      if (typeof parkConfig?.defaultGstRate === "number") {
        setDefaultGstRate(parkConfig.defaultGstRate);
      }
    });
  }, []);

  const mobileValid = /^[6-9]\d{9}$/.test(guestMobile.trim());
  const totalGuests = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.quantity, 0),
    [cart.items],
  );
  const participantSlots = useMemo(
    () =>
      cart.items.flatMap((item) =>
        Array.from({ length: item.quantity }).map((_, index) => ({
          key: `${item.id}-${index}`,
          ticketTypeId: item.id,
          ticketName: item.name,
        })),
      ),
    [cart.items],
  );

  useEffect(() => {
    setParticipants((previous) => {
      const prevByKey = new Map(previous.map((row) => [row.key, row]));
      return participantSlots.map((slot, index) => {
        const prev = prevByKey.get(slot.key);
        return {
          key: slot.key,
          ticketTypeId: slot.ticketTypeId,
          ticketName: slot.ticketName,
          name: prev?.name ?? (index === 0 ? guestName.trim() || "Guest 1" : `Guest ${index + 1}`),
          gender: prev?.gender ?? "",
          age: prev?.age ?? "",
          isLeadGuest: prev?.isLeadGuest ?? index === 0,
        };
      });
    });
  }, [participantSlots, guestName]);
  const idProofRequired = idProofEnabled && totalGuests > idProofRequiredAbove;
  const idProofValid = !idProofRequired || (
    idProofType === "OTHER"
      ? Boolean(idProofNumber.trim() && idProofLabel.trim())
      : Boolean(idProofNumber.trim())
  );
  const foodTotal = Math.round(foodLines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
  const lockerTotal = Math.round(lockerLines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
  const costumeTotal = Math.round(costumeLines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
  const rideTotal = Math.round(rideLines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
  const addOnGstAmount = Math.round(
    (foodLines.reduce((sum, line) => sum + (line.baseAmount * line.gstRate) / 100, 0) +
      lockerLines.reduce((sum, line) => sum + (line.baseAmount * line.gstRate) / 100, 0) +
      costumeLines.reduce((sum, line) => sum + (line.baseAmount * line.gstRate) / 100, 0) +
      rideLines.reduce((sum, line) => sum + (line.baseAmount * line.gstRate) / 100, 0)) *
      100,
  ) / 100;
  const addOnTotal = Math.round((foodTotal + lockerTotal + costumeTotal + rideTotal) * 100) / 100;
  const grandTotal = Math.round((cart.totals.totalAmount + addOnTotal) * 100) / 100;
  const splitTotal = cart.splitLines.reduce((sum, line) => sum + line.amount, 0);
  const splitRemaining = Math.round((grandTotal - splitTotal) * 100) / 100;
  const isBalanced = Math.abs(splitRemaining) < 0.01;
  const hasCartItems = cart.items.length > 0 || foodLines.length > 0 || lockerLines.length > 0 || costumeLines.length > 0 || rideLines.length > 0;
  const canSell = hasCartItems && isBalanced && cart.splitLines.length > 0 && mobileValid && idProofValid;

  async function handleSell() {
    if (!canSell) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/pos/ticket-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          sessionId,
          visitDate,
          guestName: guestName.trim() || "Guest",
          guestMobile: guestMobile.trim(),
          guestEmail: guestEmail.trim() || undefined,
          notes: notes.trim() || undefined,
          idProofType: idProofType || undefined,
          idProofNumber: idProofNumber.trim() || undefined,
          idProofLabel: idProofType === "OTHER" ? idProofLabel.trim() || undefined : undefined,
          participants: participants.map((row) => ({
            ticketTypeId: row.ticketTypeId,
            name: row.name.trim() || undefined,
            gender: row.gender || undefined,
            age: row.age.trim().length > 0 ? Number(row.age) : undefined,
            isLeadGuest: row.isLeadGuest || undefined,
          })),
          items: cart.items.map((i) => ({ ticketTypeId: i.id, quantity: i.quantity })),
          foodLines: foodLines.map((line) => ({
            foodItemId: line.foodItemId,
            foodVariantId: line.foodVariantId,
            quantity: line.quantity,
          })),
          lockerLines: lockerLines.map((line) => ({ lockerId: line.lockerId, amount: line.amount })),
          costumeLines: costumeLines.map((line) => ({
            costumeItemId: line.costumeItemId,
            durationHours: line.durationHours,
          })),
          rideLines: rideLines.map((line) => ({
            rideId: line.rideId,
            quantity: line.quantity,
          })),
          couponCode: cart.coupon?.code,
          paymentLines: cart.splitLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sale failed");
      setReceiptRef(data.bookingId);
      cart.clearCart();
      setGuestName("");
      setGuestMobile("");
      setGuestEmail("");
      setNotes("");
      setIdProofNumber("");
      setIdProofLabel("");
      setLinkedBookingNumber(null);
      setFoodLines([]);
      setLockerLines([]);
      setCostumeLines([]);
      setRideLines([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCollectBalance() {
    if (!selectedBooking || balanceSplitLines.length === 0) return;
    const balanceTotal = balanceSplitLines.reduce((s, l) => s + l.amount, 0);
    const rem = Math.round((selectedBooking.balance - balanceTotal) * 100) / 100;
    if (Math.abs(rem) > 0.01) {
      setBalanceError(`Payment total ₹${balanceTotal.toFixed(2)} doesn't match balance ₹${selectedBooking.balance.toFixed(2)}`);
      return;
    }
    setCollectingBalance(true);
    setBalanceError(null);
    try {
      const res = await fetch("/api/v1/pos/collect-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          sessionId,
          bookingId: selectedBooking.id,
          paymentLines: balanceSplitLines,
          notes: balanceNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setBalanceReceiptRef(selectedBooking.id);
      setSelectedBooking(null);
      setBalanceSplitLines([]);
      setBalanceNotes("");
    } catch (e: unknown) {
      setBalanceError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCollectingBalance(false);
    }
  }

  const balanceSplitTotal = balanceSplitLines.reduce((s, l) => s + l.amount, 0);
  const balanceRemaining = selectedBooking
    ? Math.round((selectedBooking.balance - balanceSplitTotal) * 100) / 100
    : 0;

  function applyImportedBooking(booking: LookupBooking, mode: "replace" | "merge"): void {
    if (mode === "replace") {
      cart.clearCart();
      setFoodLines([]);
      setLockerLines([]);
      setCostumeLines([]);
    }

    setGuestName((prev) => (mode === "replace" || !prev ? booking.guestName || "" : prev));
    setGuestMobile((prev) => (mode === "replace" || !prev ? booking.guestMobile || "" : prev));
    setVisitDate((prev) => (mode === "replace" || !prev ? (booking.visitDate || prev) : prev));
    setLinkedBookingNumber(booking.bookingNumber);

    for (const ticket of booking.tickets) {
      for (let i = 0; i < ticket.quantity; i += 1) {
        cart.addItem({
          id: ticket.ticketTypeId,
          name: ticket.name,
          unitPrice: ticket.unitPrice,
          gstRate: ticket.gstRate,
        });
      }
    }

    setImportCandidate(null);
  }

  function handleLoadBookingForWalkIn(booking: LookupBooking): void {
    setImportCandidate(booking);
  }

  function updateParticipant(index: number, patch: Partial<ParticipantRow>): void {
    setParticipants((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  function markLeadGuest(index: number): void {
    setParticipants((current) =>
      current.map((row, rowIndex) => ({ ...row, isLeadGuest: rowIndex === index })),
    );
  }

  function getAvailableLockers(): LockerOption[] {
    const usedLockerIds = new Set(lockerLines.map((line) => line.lockerId));
    return lockerOptions.filter((locker) => !usedLockerIds.has(locker.id));
  }

  function getAvailableCostumes(): CostumeOption[] {
    const usedCostumeIds = new Set(costumeLines.map((line) => line.costumeItemId));
    return costumeOptions
      .map((item) => {
        const remainingUnitIds = item.unitIds.filter((unitId) => !usedCostumeIds.has(unitId));
        return {
          ...item,
          unitIds: remainingUnitIds,
          availableQuantity: remainingUnitIds.length,
        };
      })
      .filter((item) => item.availableQuantity > 0);
  }

  function addFoodLine(): void {
    setAddOnError(null);
    if (!foodItemId) {
      setAddOnError("Select a food item first.");
      return;
    }
    const selected = foodOptions.find((item) => item.id === foodItemId);
    if (!selected) {
      setAddOnError("Selected food item is not available.");
      return;
    }
    const quantity = Math.max(1, Number(foodQty || "1"));
    const lineBase = selected.price * quantity;
    const lineAmount = lineBase * (1 + selected.gstRate / 100);
    setFoodLines((prev) => [
      ...prev,
      {
        foodItemId: selected.foodItemId,
        name: selected.variantName ? `${selected.name} · ${selected.variantName}` : selected.name,
        foodVariantId: selected.foodVariantId,
        quantity,
        amount: Math.round(lineAmount * 100) / 100,
        baseAmount: Math.round(lineBase * 100) / 100,
        gstRate: selected.gstRate,
      },
    ]);
  }

  function addLockerLines(): void {
    setAddOnError(null);
    if (!lockerId) {
      setAddOnError("Select a locker first.");
      return;
    }
    const quantity = Math.max(1, Number(lockerQty || "1"));
    const allAvailable = getAvailableLockers();
    const selected = allAvailable.find((locker) => locker.id === lockerId);
    if (!selected) {
      setAddOnError("Selected locker is no longer available.");
      return;
    }
    const remaining = allAvailable.filter((locker) => locker.id !== lockerId);
    const chosen = [selected, ...remaining.slice(0, Math.max(0, quantity - 1))];
    if (chosen.length < quantity) {
      setAddOnError(`Only ${chosen.length} locker(s) are currently available.`);
      return;
    }
    setLockerLines((prev) => [
      ...prev,
      ...chosen.map((locker) => {
        const resolvedGstRate = Number(locker.gstRate ?? lockerGstRate ?? 0);
        const baseAmount = Math.round(locker.rate * 100) / 100;
        const amount = Math.round(baseAmount * (1 + resolvedGstRate / 100) * 100) / 100;
        return {
          lockerId: locker.id,
          number: locker.number,
          amount,
          baseAmount,
          gstRate: resolvedGstRate,
        };
      }),
    ]);
  }

  function addCostumeLines(): void {
    setAddOnError(null);
    if (!costumeId) {
      setAddOnError("Select a costume first.");
      return;
    }
    const selected = getAvailableCostumes().find((item) => item.id === costumeId);
    if (!selected) {
      setAddOnError("Selected costume is not available.");
      return;
    }
    const quantity = Math.max(1, Number(costumeQty || "1"));
    const durationHours = COSTUME_DURATION_HOURS;
    const usedCostumeIds = new Set(costumeLines.map((line) => line.costumeItemId));
    const availableUnitIds = selected.unitIds.filter((unitId) => !usedCostumeIds.has(unitId));
    const chosenUnitIds = availableUnitIds.slice(0, quantity);
    if (chosenUnitIds.length < quantity) {
      setAddOnError(
        `Only ${chosenUnitIds.length} costume item(s) available for ${selected.name}.`,
      );
      return;
    }
    setCostumeLines((prev) => [
      ...prev,
      ...chosenUnitIds.map((unitId, index) => {
        const resolvedGstRate = selected.gstRate > 0 ? selected.gstRate : defaultGstRate;
        const baseAmount = Math.round(selected.rentalRate * 100) / 100;
        const amount = Math.round(baseAmount * (1 + resolvedGstRate / 100) * 100) / 100;
        return {
          costumeItemId: unitId,
          name: selected.name,
          tagNumber: `${selected.tagNumber}${quantity > 1 ? ` #${index + 1}` : ""}`,
          durationHours,
          amount,
          baseAmount,
          gstRate: resolvedGstRate,
        };
      }),
    ]);
  }

  function addRideTickets(): void {
    setAddOnError(null);
    if (!rideTicketId) {
      setAddOnError("Select a ride first.");
      return;
    }
    const selected = rideOptions.find((item) => item.rideId === rideTicketId);
    if (!selected) {
      setAddOnError("Selected ride add-on is not available.");
      return;
    }
    const quantity = Math.max(1, Number(rideQty || "1"));
    const baseAmount = Math.round(selected.price * quantity * 100) / 100;
    const amount = Math.round(baseAmount * (1 + selected.gstRate / 100) * 100) / 100;
    setRideLines((prev) => [
      ...prev,
      {
        rideId: selected.rideId,
        name: selected.rideName,
        quantity,
        amount,
        baseAmount,
        gstRate: selected.gstRate,
      },
    ]);
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Top bar */}
      <header className="bg-teal-700 text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center font-bold text-sm">
            🎟
          </div>
          <div>
            <p className="font-bold text-sm leading-none">Gate / Ticket Counter</p>
            <p className="text-xs text-teal-200 mt-0.5">{terminalId} · {cashierName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCloser(true)}
          className="text-xs bg-teal-600 hover:bg-teal-500 px-3 py-1.5 rounded-lg transition-colors"
        >
          Close Session
        </button>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-4 shrink-0">
        {(["walkin", "balance"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "walkin" ? "Walk-in Sale" : "Collect Balance"}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {tab === "walkin" ? (
          <>
            {/* Left: ticket selector */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="bg-white rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Load Existing Booking Data</h3>
                <BookingLookup onSelect={(booking) => handleLoadBookingForWalkIn(booking as LookupBooking)} />
                {importCandidate ? (
                  <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs text-teal-800 space-y-2">
                    <p>
                      Import <span className="font-semibold">{importCandidate.bookingNumber}</span> for{" "}
                      <span className="font-semibold">{importCandidate.guestName}</span>?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded bg-teal-700 text-white px-2 py-1"
                        onClick={() => applyImportedBooking(importCandidate, "replace")}
                      >
                        Replace cart
                      </button>
                      <button
                        type="button"
                        className="rounded border border-teal-400 px-2 py-1"
                        onClick={() => applyImportedBooking(importCandidate, "merge")}
                      >
                        Merge with cart
                      </button>
                      <button
                        type="button"
                        className="rounded border border-gray-300 px-2 py-1 text-gray-700"
                        onClick={() => setImportCandidate(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Guest info */}
              <div className="bg-white rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Guest Info (optional)</h3>
                {linkedBookingNumber ? (
                  <p className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                    Prefilled from booking: <span className="font-semibold">{linkedBookingNumber}</span>
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="tt-guest-name" className="block text-xs text-gray-500 mb-1">Name</label>
                    <input
                      id="tt-guest-name"
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Guest name"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="tt-guest-mobile" className="block text-xs text-gray-500 mb-1">Mobile</label>
                    <input
                      id="tt-guest-mobile"
                      type="tel"
                      value={guestMobile}
                      onChange={(e) => setGuestMobile(e.target.value)}
                      placeholder="10-digit mobile"
                      maxLength={10}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
                {guestMobile.trim().length > 0 && !mobileValid ? (
                  <p className="text-xs text-red-600">Enter a valid 10-digit Indian mobile number.</p>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="tt-guest-email" className="block text-xs text-gray-500 mb-1">Email <span className="text-gray-400">(for ticket)</span></label>
                    <input
                      id="tt-guest-email"
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="guest@example.com"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="tt-visit-date" className="block text-xs text-gray-500 mb-1">Visit Date</label>
                    <input
                      id="tt-visit-date"
                      type="date"
                      title="Visit date"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="tt-id-proof-type" className="block text-xs text-gray-500 mb-1">ID Proof Type</label>
                    <select
                      id="tt-id-proof-type"
                      title="ID proof type"
                      value={idProofType}
                      onChange={(e) => setIdProofType(e.target.value as IdProofType)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="AADHAAR">Aadhaar</option>
                      <option value="DRIVING_LICENSE">Driving Licence</option>
                      <option value="PAN">PAN</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="VOTER_ID">Voter ID</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="tt-id-proof-number" className="block text-xs text-gray-500 mb-1">ID Proof Number</label>
                    <input
                      id="tt-id-proof-number"
                      type="text"
                      value={idProofNumber}
                      onChange={(e) => setIdProofNumber(e.target.value)}
                      placeholder="Optional"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
                {idProofType === "OTHER" ? (
                  <div>
                    <label htmlFor="tt-id-proof-label" className="block text-xs text-gray-500 mb-1">ID Label</label>
                    <input
                      id="tt-id-proof-label"
                      type="text"
                      value={idProofLabel}
                      onChange={(e) => setIdProofLabel(e.target.value)}
                      placeholder="Enter ID label"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                ) : null}
                <div>
                  <label htmlFor="tt-notes" className="block text-xs text-gray-500 mb-1">Notes</label>
                  <input
                    id="tt-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                {idProofRequired ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    ID proof is required because total guests exceed {idProofRequiredAbove}.
                  </p>
                ) : null}
              </div>

              {/* Ticket picker */}
              <div className="bg-white rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Select Tickets</h3>
                <TicketSelector onAdd={cart.addItem} />
              </div>
              {participantSlots.length > 0 ? (
                <div className="bg-white rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Participant Details (optional)</h3>
                  <p className="text-xs text-gray-500">
                    Capture guest names per ticket for smoother ride access checks.
                  </p>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {participants.map((row, index) => (
                      <div key={row.key} className="rounded-lg border border-gray-200 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700">
                            {row.ticketName} {index + 1}
                          </span>
                          <label className="text-xs text-gray-600 flex items-center gap-1">
                            <input
                              type="radio"
                              name="pos-lead-guest"
                              checked={row.isLeadGuest}
                              onChange={() => markLeadGuest(index)}
                            />
                            Lead
                          </label>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(event) => updateParticipant(index, { name: event.target.value })}
                            placeholder={`Guest ${index + 1} name`}
                            className="col-span-2 border border-gray-200 rounded px-2 py-2 text-sm"
                          />
                          <select
                            title="Gender"
                            value={row.gender}
                            onChange={(event) =>
                              updateParticipant(index, {
                                gender: event.target.value as ParticipantRow["gender"],
                              })
                            }
                            className="border border-gray-200 rounded px-2 py-2 text-sm"
                          >
                            <option value="">Gender</option>
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={row.age}
                          onChange={(event) => updateParticipant(index, { age: event.target.value })}
                          placeholder="Age"
                          className="w-24 border border-gray-200 rounded px-2 py-2 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="bg-white rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Add-ons (Same Checkout)</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase">Food</p>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        title="Food item"
                        value={foodItemId}
                        onChange={(e) => {
                          setFoodItemId(e.target.value);
                          setAddOnError(null);
                        }}
                        className="col-span-2 border border-gray-200 rounded px-2 py-2 text-sm"
                      >
                        <option value="">Select food item</option>
                        {foodOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.variantName ? `${item.name} · ${item.variantName}` : item.name} (₹{item.price} + {item.gstRate}% GST)
                          </option>
                        ))}
                      </select>
                      <input
                        title="Food quantity"
                        type="number"
                        min={1}
                        value={foodQty}
                        onChange={(e) => {
                          setFoodQty(e.target.value);
                          setAddOnError(null);
                        }}
                        className="border border-gray-200 rounded px-2 py-2 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      className="text-xs text-teal-700"
                      onClick={addFoodLine}
                    >
                      + Add Food
                    </button>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase">Locker</p>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        title="Locker"
                        value={lockerId}
                        onChange={(e) => {
                          setLockerId(e.target.value);
                          setAddOnError(null);
                        }}
                        className="col-span-2 border border-gray-200 rounded px-2 py-2 text-sm"
                      >
                        <option value="">Select locker</option>
                        {getAvailableLockers().map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.number}
                            {item.zoneName ? ` · ${item.zoneName}` : ""}
                          </option>
                        ))}
                      </select>
                      <input
                        title="Locker quantity"
                        type="number"
                        min={1}
                        value={lockerQty}
                        onChange={(e) => {
                          setLockerQty(e.target.value);
                          setAddOnError(null);
                        }}
                        className="border border-gray-200 rounded px-2 py-2 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 border border-gray-200 rounded px-2 py-2 text-sm text-gray-300">
                        Rate per locker: ₹{
                          lockerOptions.find((locker) => locker.id === lockerId)?.rate?.toFixed(2) ?? "0.00"
                        }
                      </div>
                      <div className="text-xs text-gray-500 flex items-center">
                        Qty × configured locker rate
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-teal-700"
                      onClick={addLockerLines}
                    >
                      + Add Locker
                    </button>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase">Costume</p>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        title="Costume"
                        value={costumeId}
                        onChange={(e) => {
                          setCostumeId(e.target.value);
                          setAddOnError(null);
                        }}
                        className="col-span-3 border border-gray-200 rounded px-2 py-2 text-sm"
                      >
                        <option value="">Select costume</option>
                        {getAvailableCostumes().map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · {item.categoryName} · ₹{item.rentalRate} · Available {item.availableQuantity}
                          </option>
                        ))}
                      </select>
                      <input
                        title="Costume quantity"
                        type="number"
                        min={1}
                        value={costumeQty}
                        onChange={(e) => {
                          setCostumeQty(e.target.value);
                          setAddOnError(null);
                        }}
                        className="border border-gray-200 rounded px-2 py-2 text-sm"
                      />
                      <div className="col-span-2 text-xs text-gray-500 flex items-center">
                        Rental only. Deposit is handled at costume POS issue/return.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-teal-700"
                      onClick={addCostumeLines}
                    >
                      + Add Costume
                    </button>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase">Ride</p>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        title="Ride add-on"
                        value={rideTicketId}
                        onChange={(e) => {
                          setRideTicketId(e.target.value);
                          setAddOnError(null);
                        }}
                        className="col-span-2 border border-gray-200 rounded px-2 py-2 text-sm"
                      >
                        <option value="">Select ride</option>
                        {rideOptions.map((item) => (
                          <option key={item.rideId} value={item.rideId}>
                            {item.rideName} (₹{item.price} + {item.gstRate}% GST)
                          </option>
                        ))}
                      </select>
                      <input
                        title="Ride quantity"
                        type="number"
                        min={1}
                        value={rideQty}
                        onChange={(e) => {
                          setRideQty(e.target.value);
                          setAddOnError(null);
                        }}
                        className="border border-gray-200 rounded px-2 py-2 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      className="text-xs text-teal-700"
                      onClick={addRideTickets}
                    >
                      + Add Ride
                    </button>
                    {rideOptions.length === 0 ? (
                      <p className="text-xs text-amber-600">
                        No active rides found. Add or activate rides in Admin → Rides.
                      </p>
                    ) : null}
                  </div>
                </div>
                {addOnError ? (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                    {addOnError}
                  </p>
                ) : null}
              </div>

            </div>

            {/* Right: cart + payment */}
            <div className="w-80 shrink-0 flex flex-col border-l border-gray-200 bg-white overflow-x-hidden">
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Cart</h3>
                <CartSummary
                  items={cart.items}
                  coupon={cart.coupon}
                  splitLines={cart.splitLines}
                  totals={cart.totals}
                  splitRemaining={splitRemaining}
                  onRemove={cart.removeItem}
                  onSetQty={cart.setQty}
                  extraAmount={addOnTotal}
                  extraGstAmount={addOnGstAmount}
                />
                {(foodLines.length > 0 || lockerLines.length > 0 || costumeLines.length > 0 || rideLines.length > 0) ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-gray-200 p-3 text-xs text-gray-600">
                    <p className="font-semibold text-gray-700">Add-ons in cart</p>

                    {foodLines.map((line, index) => (
                      <div key={`food-${line.foodItemId}-${index}`} className="flex items-center justify-between rounded border border-gray-100 px-2 py-1">
                        <div>
                          <p className="font-medium text-gray-700">Food · {line.name}</p>
                          <p className="text-gray-500">Qty {line.quantity} · GST {line.gstRate}%</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">₹{line.amount.toFixed(2)}</span>
                          <button
                            type="button"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => setFoodLines((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                            title="Remove food item"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                    {lockerLines.map((line, index) => (
                      <div key={`locker-${line.lockerId}-${index}`} className="flex items-center justify-between rounded border border-gray-100 px-2 py-1">
                        <div>
                          <p className="font-medium text-gray-700">Locker · {line.number}</p>
                          <p className="text-gray-500">1 slot · GST {line.gstRate}%</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">₹{line.amount.toFixed(2)}</span>
                          <button
                            type="button"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => setLockerLines((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                            title="Remove locker"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                    {costumeLines.map((line, index) => (
                      <div key={`costume-${line.costumeItemId}-${index}`} className="flex items-center justify-between rounded border border-gray-100 px-2 py-1">
                        <div>
                          <p className="font-medium text-gray-700">Costume · {line.name}</p>
                          <p className="text-gray-500">{line.tagNumber} · GST {line.gstRate}%</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">₹{line.amount.toFixed(2)}</span>
                          <button
                            type="button"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => setCostumeLines((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                            title="Remove costume"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                    {rideLines.map((line, index) => (
                      <div key={`ride-${line.rideId}-${index}`} className="flex items-center justify-between rounded border border-gray-100 px-2 py-1">
                        <div>
                          <p className="font-medium text-gray-700">Ride · {line.name}</p>
                          <p className="text-gray-500">Qty {line.quantity} · GST {line.gstRate}%</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">₹{line.amount.toFixed(2)}</span>
                          <button
                            type="button"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => setRideLines((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                            title="Remove ride"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="space-y-0.5 border-t border-dashed border-gray-200 pt-2">
                      <p>Food: ₹{foodTotal.toFixed(2)}</p>
                      <p>Locker: ₹{lockerTotal.toFixed(2)}</p>
                      <p>Costume: ₹{costumeTotal.toFixed(2)}</p>
                      {rideTotal > 0 && <p>Ride: ₹{rideTotal.toFixed(2)}</p>}
                      {addOnGstAmount > 0 && <p>Add-on GST: ₹{addOnGstAmount.toFixed(2)}</p>}
                    </div>
                  </div>
                ) : null}

                {hasCartItems && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Coupon</h3>
                      <CouponInput
                        subtotal={cart.totals.subtotal}
                        ticketTypeIds={cart.items.map((i) => i.id)}
                        coupon={cart.coupon}
                        onApply={cart.setCoupon}
                        onClear={cart.clearCoupon}
                      />
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment</h3>
                      <SplitPaymentBuilder
                        totalAmount={grandTotal}
                        splitLines={cart.splitLines}
                        splitRemaining={splitRemaining}
                        onSet={cart.setSplit}
                        onClear={cart.clearSplit}
                        allowedMethods={paymentMethodOptions}
                        minAmount={splitMinAmount}
                        maxMethods={splitMaxMethods}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-100 space-y-2">
                {error && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}
                <button
                  type="button"
                  onClick={handleSell}
                  disabled={!canSell || submitting}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  {submitting ? "Processing…" : `Checkout · ₹${grandTotal.toFixed(2)}`}
                </button>
                {hasCartItems && (
                  <button
                    type="button"
                    onClick={() => {
                      cart.clearCart();
                      setFoodLines([]);
                      setLockerLines([]);
                      setCostumeLines([]);
                    }}
                    className="w-full text-xs text-gray-400 hover:text-red-500 py-1"
                  >
                    Clear cart
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Balance collection tab */
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl mx-auto w-full">
            {!selectedBooking ? (
              <div className="bg-white rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Find Booking</h3>
                <BookingLookup
                  onSelect={(b) => {
                    if (b.balance <= 0) {
                      alert("This booking is already fully paid.");
                      return;
                    }
                    setSelectedBooking({
                      id: b.id,
                      bookingNumber: b.bookingNumber,
                      guestName: b.guestName,
                      balance: b.balance,
                    });
                    setBalanceSplitLines([]);
                  }}
                />
              </div>
            ) : (
              <div className="bg-white rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{selectedBooking.bookingNumber}</p>
                    <p className="text-sm text-gray-500">{selectedBooking.guestName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Balance Due</p>
                    <p className="text-xl font-bold text-red-600">₹{selectedBooking.balance.toFixed(2)}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment</h4>
                  <SplitPaymentBuilder
                    totalAmount={selectedBooking.balance}
                    splitLines={balanceSplitLines}
                    splitRemaining={balanceRemaining}
                    onSet={setBalanceSplitLines}
                    onClear={() => setBalanceSplitLines([])}
                    allowedMethods={paymentMethodOptions}
                    minAmount={splitMinAmount}
                    maxMethods={splitMaxMethods}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={balanceNotes}
                    onChange={(e) => setBalanceNotes(e.target.value)}
                    placeholder="Any remarks…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {balanceError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{balanceError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedBooking(null); setBalanceSplitLines([]); setBalanceError(null); }}
                    className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 text-sm"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCollectBalance}
                    disabled={collectingBalance || balanceSplitLines.length === 0 || Math.abs(balanceRemaining) > 0.01}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-sm"
                  >
                    {collectingBalance ? "Processing…" : "Collect Balance"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Receipt modal after walk-in sale */}
      {receiptRef && (
        <ReceiptModal
          receiptId={receiptRef}
          type="booking"
          onClose={() => setReceiptRef(null)}
        />
      )}

      {/* Receipt modal after balance collection */}
      {balanceReceiptRef && (
        <ReceiptModal
          receiptId={balanceReceiptRef}
          type="booking"
          onClose={() => setBalanceReceiptRef(null)}
        />
      )}

      {/* Session closer */}
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
