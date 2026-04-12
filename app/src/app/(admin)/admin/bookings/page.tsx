"use client";

import { useEffect, useMemo, useState } from "react";

import { BookingStatusBadge } from "@/components/booking/BookingStatusBadge";
import { CouponInput } from "@/components/booking/CouponInput";
import { OrderSummary } from "@/components/booking/OrderSummary";
import { Step1GuestDetails, type IdProofType } from "@/components/booking/Step1GuestDetails";
import { Step2TicketSelection } from "@/components/booking/Step2TicketSelection";
import { StepIndicator } from "@/components/booking/StepIndicator";
import { type ParticipantDraft } from "@/components/booking/ParticipantRow";
import { useToast } from "@/components/feedback/Toast";
import { DataTable, type DataTableColumn } from "@/components/layout/DataTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pagination } from "@/components/layout/Pagination";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { authClient } from "@/lib/auth-client";
import { bookingSchema, calculatePricing, parseDateOnlyToUtc, sanitizeCouponCode, type TicketLine } from "@/lib/booking";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BookingItem {
  id: string;
  bookingNumber: string;
  bookedBy?: {
    id: string;
    name: string;
    role: string;
    subRole: string | null;
  } | null;
  guestName: string;
  guestMobile: string;
  guestEmail?: string | null;
  visitDate: string;
  adults: number;
  children: number;
  totalAmount: number;
  status: string;
  notes?: string | null;
}

interface BookingListResponse {
  items: BookingItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface TicketType {
  id: string;
  name: string;
  description: string | null;
  category?: string | null;
  price: number;
  gstRate: number;
  minAge: number | null;
  maxAge: number | null;
}

interface CreateBookingDraft {
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
  customDiscountType: "NONE" | "PERCENTAGE" | "AMOUNT";
  customDiscountValue: number;
  packageLines: Array<{ packageId: string; quantity: number }>;
  foodLines: Array<{ foodItemId: string; foodVariantId?: string; quantity: number }>;
  lockerLines: Array<{ lockerId: string; quantity: number }>;
  costumeLines: Array<{ costumeItemId: string; quantity: number }>;
  rideLines: Array<{ rideId: string; quantity: number }>;
}

type PaymentMethod = CreateBookingDraft["paymentMethod"];

interface EditBookingDraft {
  guestName: string;
  guestMobile: string;
  guestEmail: string;
  visitDate: string;
  notes: string;
}

interface CouponValidateResponse {
  valid: boolean;
  message?: string;
  discountAmount: number;
}

interface CouponOption {
  id: string;
  code: string;
  title: string | null;
  discountType: string;
  discountValue: number;
}

interface ParkConfigLite {
  razorpayEnabled?: boolean;
  manualUpiEnabled?: boolean;
}

interface PackageOption {
  id: string;
  name: string;
  salePrice: number;
  gstRate: number;
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
}

interface CostumeOption {
  id: string;
  name: string;
  categoryName: string;
  rentalRate: number;
  gstRate: number;
  availableQuantity: number;
}

interface RideOption {
  id: string;
  name: string;
  entryFee: number;
  gstRate: number;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  MANUAL_UPI: "Manual UPI",
  GATEWAY: "Gateway",
};

const ADD_STEPS = [
  { id: 1, title: "Guest Details" },
  { id: 2, title: "Select Tickets" },
  { id: 3, title: "Summary" },
];

const DEFAULT_CREATE_DRAFT: CreateBookingDraft = {
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
  customDiscountType: "NONE",
  customDiscountValue: 0,
  packageLines: [],
  foodLines: [],
  lockerLines: [],
  costumeLines: [],
  rideLines: [],
};

function getApiValidationMessage(errors: unknown): string | undefined {
  if (!errors || typeof errors !== "object") return undefined;
  const values = Object.values(errors as Record<string, unknown>);
  for (const value of values) {
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    if (typeof value === "string") return value;
  }
  return undefined;
}

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
  ticketMap: Map<string, TicketType>,
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

export default function AdminBookingsPage(): JSX.Element {
  const { pushToast } = useToast();
  const { data: session } = authClient.useSession();

  const [items, setItems] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const [pagination, setPagination] = useState<BookingListResponse["pagination"]>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [packageOptions, setPackageOptions] = useState<PackageOption[]>([]);
  const [foodOptions, setFoodOptions] = useState<FoodOption[]>([]);
  const [lockerOptions, setLockerOptions] = useState<LockerOption[]>([]);
  const [costumeOptions, setCostumeOptions] = useState<CostumeOption[]>([]);
  const [rideOptions, setRideOptions] = useState<RideOption[]>([]);
  const [dateRange, setDateRange] = useState<{ min: string; max: string }>({ min: "", max: "" });
  const [packagePicker, setPackagePicker] = useState<{ packageId: string; quantity: string }>({ packageId: "", quantity: "1" });
  const [foodPicker, setFoodPicker] = useState<{ id: string; quantity: string }>({ id: "", quantity: "1" });
  const [lockerPicker, setLockerPicker] = useState<{ lockerId: string; quantity: string }>({ lockerId: "", quantity: "1" });
  const [costumePicker, setCostumePicker] = useState<{ costumeItemId: string; quantity: string }>({ costumeItemId: "", quantity: "1" });
  const [ridePicker, setRidePicker] = useState<{ rideId: string; quantity: string }>({ rideId: "", quantity: "1" });

  const [addOpen, setAddOpen] = useState(false);
  const [addStep, setAddStep] = useState<number>(1);
  const [addSaving, setAddSaving] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateBookingDraft>(DEFAULT_CREATE_DRAFT);
  const [availableMethods, setAvailableMethods] = useState<PaymentMethod[]>(["CASH", "CARD"]);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [couponError, setCouponError] = useState<string>("");
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [applyingCoupon, setApplyingCoupon] = useState<boolean>(false);
  const [couponOptions, setCouponOptions] = useState<CouponOption[]>([]);

  const [editing, setEditing] = useState<BookingItem | null>(null);
  const [editDraft, setEditDraft] = useState<EditBookingDraft>({
    guestName: "",
    guestMobile: "",
    guestEmail: "",
    visitDate: "",
    notes: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  const [cancelling, setCancelling] = useState<BookingItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);

  const ticketMap = useMemo(() => new Map(ticketTypes.map((ticketType) => [ticketType.id, ticketType])), [ticketTypes]);
  const totalGuests = useMemo(() => createDraft.ticketLines.reduce((sum, line) => sum + line.quantity, 0), [createDraft.ticketLines]);
  const idProofRequired = totalGuests > 10;

  useEffect(() => {
    const range = getDateInputRange();
    setDateRange(range);
  }, []);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/v1/park-config", { method: "GET" });
      const payload = (await response.json().catch(() => null)) as ParkConfigLite | null;
      if (!response.ok || !payload) return;

      const nextMethods: PaymentMethod[] = ["CASH", "CARD"];
      if (payload.manualUpiEnabled) nextMethods.push("MANUAL_UPI");
      if (payload.razorpayEnabled) nextMethods.push("GATEWAY");
      setAvailableMethods(nextMethods);
      setCreateDraft((current) => ({
        ...current,
        paymentMethod: nextMethods.includes(current.paymentMethod) ? current.paymentMethod : nextMethods[0]!,
      }));
    })();
  }, []);

  useEffect(() => {
    setParticipants((current) =>
      buildParticipantDrafts(createDraft.ticketLines, ticketMap, current, createDraft.guestName || "Guest 1"),
    );
  }, [createDraft.ticketLines, createDraft.guestName, ticketMap]);

  const pricing = useMemo(() => {
    const lines = createDraft.ticketLines.map((line) => ({
      quantity: line.quantity,
      unitPrice: ticketMap.get(line.ticketTypeId)?.price ?? 0,
    }));
    const gstRate = createDraft.ticketLines.length > 0 ? (ticketMap.get(createDraft.ticketLines[0]!.ticketTypeId)?.gstRate ?? 18) : 18;
    const ticketPricing = calculatePricing({ lines, gstRate, discountAmount: couponDiscount });

    const packageAmount = createDraft.packageLines.reduce((sum, line) => {
      const selected = packageOptions.find((item) => item.id === line.packageId);
      if (!selected) return sum;
      return sum + selected.salePrice * line.quantity * (1 + selected.gstRate / 100);
    }, 0);
    const foodAmount = createDraft.foodLines.reduce((sum, line) => {
      const optionId = line.foodVariantId ? `${line.foodItemId}__${line.foodVariantId}` : line.foodItemId;
      const selected = foodOptions.find((item) => item.id === optionId);
      if (!selected) return sum;
      return sum + selected.price * line.quantity * (1 + selected.gstRate / 100);
    }, 0);
    const lockerAmount = createDraft.lockerLines.reduce((sum, line) => {
      const selected = lockerOptions.find((item) => item.id === line.lockerId);
      if (!selected) return sum;
      return sum + selected.rate * line.quantity * (1 + Number(selected.gstRate ?? 18) / 100);
    }, 0);
    const costumeAmount = createDraft.costumeLines.reduce((sum, line) => {
      const selected = costumeOptions.find((item) => item.id === line.costumeItemId);
      if (!selected) return sum;
      return sum + selected.rentalRate * line.quantity * (1 + (selected.gstRate > 0 ? selected.gstRate : 18) / 100);
    }, 0);
    const rideAmount = createDraft.rideLines.reduce((sum, line) => {
      const selected = rideOptions.find((item) => item.id === line.rideId);
      if (!selected) return sum;
      return sum + selected.entryFee * line.quantity * (1 + selected.gstRate / 100);
    }, 0);
    const addOnAmount = packageAmount + foodAmount + lockerAmount + costumeAmount + rideAmount;
    const grossTotal = ticketPricing.totalAmount + addOnAmount;

    let customDiscountAmount = 0;
    if (createDraft.customDiscountType === "PERCENTAGE") {
      customDiscountAmount = (grossTotal * createDraft.customDiscountValue) / 100;
    } else if (createDraft.customDiscountType === "AMOUNT") {
      customDiscountAmount = createDraft.customDiscountValue;
    }
    customDiscountAmount = Math.min(Math.max(0, customDiscountAmount), grossTotal);
    const totalAmount = Math.max(0, grossTotal - customDiscountAmount);

    return {
      subtotal: ticketPricing.subtotal + addOnAmount,
      gstAmount: ticketPricing.gstAmount,
      discountAmount: ticketPricing.discountAmount + customDiscountAmount,
      totalAmount,
      addOnAmount,
      customDiscountAmount,
    };
  }, [
    createDraft.ticketLines,
    createDraft.packageLines,
    createDraft.foodLines,
    createDraft.lockerLines,
    createDraft.costumeLines,
    createDraft.rideLines,
    createDraft.customDiscountType,
    createDraft.customDiscountValue,
    ticketMap,
    couponDiscount,
    packageOptions,
    foodOptions,
    lockerOptions,
    costumeOptions,
    rideOptions,
  ]);

  const paymentBreakdown = useMemo(() => {
    if (createDraft.paymentPlan === "ADVANCE") {
      const payNow = Math.ceil((pricing.totalAmount * createDraft.advancePercent) / 100);
      const balanceDue = Math.max(0, Number((pricing.totalAmount - payNow).toFixed(2)));
      return { payNow, balanceDue };
    }
    return { payNow: pricing.totalAmount, balanceDue: 0 };
  }, [createDraft.paymentPlan, createDraft.advancePercent, pricing.totalAmount]);

  async function loadBookings(): Promise<void> {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(perPage),
      });
      if (search.trim()) {
        query.set("search", search.trim());
      }
      if (status) {
        query.set("status", status);
      }
      query.set("source", "PREBOOKING");

      const response = await fetch(`/api/v1/bookings?${query.toString()}`);
      const payload = (await response.json().catch(() => null)) as BookingListResponse | null;
      if (response.ok && payload) {
        setItems(payload.items);
        setPagination(payload.pagination);
      } else {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadTicketTypes(): Promise<void> {
    const response = await fetch("/api/v1/ticket-types?activeOnly=true");
    const payload = (await response.json().catch(() => [])) as TicketType[];
    if (response.ok) {
      setTicketTypes(payload);
    }
  }

  async function loadBookingAddOnOptions(): Promise<void> {
    const [packageRes, foodRes, lockerRes, costumeRes, rideRes, couponRes] = await Promise.all([
      fetch("/api/v1/packages?activeOnly=true"),
      fetch("/api/v1/food/items?available=true"),
      fetch("/api/v1/lockers?status=AVAILABLE"),
      fetch("/api/v1/costumes/items?availableOnly=true"),
      fetch("/api/v1/rides"),
      fetch("/api/v1/coupons?active=1&page=1&pageSize=100"),
    ]);

    const packagePayload = (await packageRes.json().catch(() => [])) as Array<{ id: string; name: string; salePrice: number; gstRate: number }>;
    if (packageRes.ok) {
      setPackageOptions(
        packagePayload.map((item) => ({
          id: item.id,
          name: item.name,
          salePrice: Number(item.salePrice),
          gstRate: Number(item.gstRate ?? 18),
        })),
      );
    }

    const foodPayload = (await foodRes.json().catch(() => [])) as Array<{
      id: string;
      name: string;
      price: number;
      gstRate?: number;
      variants?: Array<{ id: string; name: string; price: number; isAvailable?: boolean }>;
    }>;
    if (foodRes.ok) {
      const options: FoodOption[] = [];
      for (const item of foodPayload) {
        options.push({
          id: item.id,
          foodItemId: item.id,
          name: item.name,
          price: Number(item.price),
          gstRate: Number(item.gstRate ?? 0),
        });
        for (const variant of item.variants ?? []) {
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
      setFoodOptions(options);
    }

    const lockerPayload = (await lockerRes.json().catch(() => [])) as Array<{ id: string; number: string; rate?: number; gstRate?: number }>;
    if (lockerRes.ok) {
      setLockerOptions(
        lockerPayload.map((item) => ({
          id: item.id,
          number: item.number,
          rate: Number(item.rate ?? 0),
          gstRate: Number(item.gstRate ?? 18),
        })),
      );
    }

    const costumePayload = (await costumeRes.json().catch(() => [])) as Array<{
      id: string;
      name: string;
      rentalRate: number;
      gstRate?: number;
      availableQuantity?: number;
      category?: { name?: string };
    }>;
    if (costumeRes.ok) {
      setCostumeOptions(
        costumePayload.map((item) => ({
          id: item.id,
          name: item.name,
          categoryName: item.category?.name ?? "Costume",
          rentalRate: Number(item.rentalRate ?? 0),
          gstRate: Number(item.gstRate ?? 0),
          availableQuantity: Number(item.availableQuantity ?? 0),
        })),
      );
    }

    const ridePayload = (await rideRes.json().catch(() => [])) as Array<{ id: string; name: string; entryFee?: number; gstRate?: number; status?: string }>;
    if (rideRes.ok) {
      setRideOptions(
        ridePayload
          .filter((item) => item.status === "ACTIVE")
          .map((item) => ({
            id: item.id,
            name: item.name,
            entryFee: Number(item.entryFee ?? 0),
            gstRate: Number(item.gstRate ?? 18),
          })),
      );
    }

    const couponPayload = (await couponRes.json().catch(() => null)) as { items?: Array<{
      id: string;
      code: string;
      title: string | null;
      discountType: string;
      discountValue: number;
    }> } | null;
    if (couponRes.ok) {
      setCouponOptions(
        (couponPayload?.items ?? []).map((item) => ({
          id: item.id,
          code: item.code,
          title: item.title,
          discountType: item.discountType,
          discountValue: Number(item.discountValue ?? 0),
        })),
      );
    }
  }

  useEffect(() => {
    void loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, status]);

  useEffect(() => {
    void loadTicketTypes();
    void loadBookingAddOnOptions();
  }, []);

  function validateAddStep(nextStep: number): boolean {
    const result = bookingSchema.safeParse({
      guestName: createDraft.guestName,
      guestMobile: createDraft.guestMobile,
      guestEmail: createDraft.guestEmail,
      visitDate: createDraft.visitDate,
      ticketLines: createDraft.ticketLines,
      couponCode: createDraft.couponCode,
    });

    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      }
      setFormErrors(nextErrors);
      if (nextStep > 1 && (nextErrors.guestName || nextErrors.guestMobile || nextErrors.guestEmail || nextErrors.visitDate)) {
        setAddStep(1);
      }
      return false;
    }

    if (idProofRequired) {
      if (!createDraft.idProofType || !createDraft.idProofNumber?.trim()) {
        setFormErrors((current) => ({
          ...current,
          idProofType: createDraft.idProofType ? current.idProofType ?? "" : "ID proof type is required",
          idProofNumber: createDraft.idProofNumber?.trim() ? current.idProofNumber ?? "" : "ID proof number is required",
        }));
        return false;
      }
      if (createDraft.idProofType === "OTHER" && !createDraft.idProofLabel?.trim()) {
        setFormErrors((current) => ({ ...current, idProofLabel: "ID label is required for Other proof type" }));
        return false;
      }
    }

    setFormErrors({});
    return true;
  }

  function addPackageLine(): void {
    if (!packagePicker.packageId) return;
    const quantity = Math.max(1, Number(packagePicker.quantity || "1"));
    setCreateDraft((current) => ({
      ...current,
      packageLines: [...current.packageLines, { packageId: packagePicker.packageId, quantity }],
    }));
  }

  function addFoodLine(): void {
    if (!foodPicker.id) return;
    const selected = foodOptions.find((item) => item.id === foodPicker.id);
    if (!selected) return;
    const quantity = Math.max(1, Number(foodPicker.quantity || "1"));
    setCreateDraft((current) => ({
      ...current,
      foodLines: [
        ...current.foodLines,
        { foodItemId: selected.foodItemId, foodVariantId: selected.foodVariantId, quantity },
      ],
    }));
  }

  function addLockerLine(): void {
    if (!lockerPicker.lockerId) return;
    const quantity = Math.max(1, Number(lockerPicker.quantity || "1"));
    setCreateDraft((current) => ({
      ...current,
      lockerLines: [...current.lockerLines, { lockerId: lockerPicker.lockerId, quantity }],
    }));
  }

  function addCostumeLine(): void {
    if (!costumePicker.costumeItemId) return;
    const quantity = Math.max(1, Number(costumePicker.quantity || "1"));
    setCreateDraft((current) => ({
      ...current,
      costumeLines: [...current.costumeLines, { costumeItemId: costumePicker.costumeItemId, quantity }],
    }));
  }

  function addRideLine(): void {
    if (!ridePicker.rideId) return;
    const quantity = Math.max(1, Number(ridePicker.quantity || "1"));
    setCreateDraft((current) => ({
      ...current,
      rideLines: [...current.rideLines, { rideId: ridePicker.rideId, quantity }],
    }));
  }

  function updatePackageLine(index: number, patch: Partial<{ packageId: string; quantity: number }>): void {
    setCreateDraft((current) => ({
      ...current,
      packageLines: current.packageLines.map((line, rowIndex) =>
        rowIndex === index
          ? {
              packageId: patch.packageId ?? line.packageId,
              quantity: patch.quantity ?? line.quantity,
            }
          : line,
      ),
    }));
  }

  function updateFoodLine(index: number, nextOptionId: string | null, nextQuantity?: number): void {
    setCreateDraft((current) => ({
      ...current,
      foodLines: current.foodLines.map((line, rowIndex) => {
        if (rowIndex !== index) return line;
        if (nextOptionId !== null) {
          const selected = foodOptions.find((item) => item.id === nextOptionId);
          if (selected) {
            return {
              foodItemId: selected.foodItemId,
              foodVariantId: selected.foodVariantId,
              quantity: nextQuantity ?? line.quantity,
            };
          }
        }
        return {
          ...line,
          quantity: nextQuantity ?? line.quantity,
        };
      }),
    }));
  }

  function updateLockerLine(index: number, patch: Partial<{ lockerId: string; quantity: number }>): void {
    setCreateDraft((current) => ({
      ...current,
      lockerLines: current.lockerLines.map((line, rowIndex) =>
        rowIndex === index
          ? {
              lockerId: patch.lockerId ?? line.lockerId,
              quantity: patch.quantity ?? line.quantity,
            }
          : line,
      ),
    }));
  }

  function updateCostumeLine(index: number, patch: Partial<{ costumeItemId: string; quantity: number }>): void {
    setCreateDraft((current) => ({
      ...current,
      costumeLines: current.costumeLines.map((line, rowIndex) =>
        rowIndex === index
          ? {
              costumeItemId: patch.costumeItemId ?? line.costumeItemId,
              quantity: patch.quantity ?? line.quantity,
            }
          : line,
      ),
    }));
  }

  function updateRideLine(index: number, patch: Partial<{ rideId: string; quantity: number }>): void {
    setCreateDraft((current) => ({
      ...current,
      rideLines: current.rideLines.map((line, rowIndex) =>
        rowIndex === index
          ? {
              rideId: patch.rideId ?? line.rideId,
              quantity: patch.quantity ?? line.quantity,
            }
          : line,
      ),
    }));
  }

  const columns: Array<DataTableColumn<BookingItem>> = [
    {
      key: "bookingNumber",
      header: "Booking",
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--color-text)]">{row.bookingNumber}</p>
          <p className="text-xs">{formatDate(row.visitDate)}</p>
        </div>
      ),
    },
    {
      key: "bookedBy",
      header: "Booked By",
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--color-text)]">{row.bookedBy?.name ?? "System"}</p>
          <p className="text-xs">{row.bookedBy?.subRole?.replaceAll("_", " ") ?? row.bookedBy?.role ?? "N/A"}</p>
        </div>
      ),
    },
    {
      key: "guest",
      header: "Guest",
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--color-text)]">{row.guestName}</p>
          <p className="text-xs">{row.guestMobile}</p>
        </div>
      ),
    },
    {
      key: "pax",
      header: "Pax",
      render: (row) => `${row.adults + row.children} (${row.adults}A/${row.children}C)`,
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => formatCurrency(row.totalAmount),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <BookingStatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <a href={`/admin/bookings/${row.id}`}>
            <Button size="sm" variant="outline">
              View
            </Button>
          </a>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(row);
              setEditDraft({
                guestName: row.guestName,
                guestMobile: row.guestMobile,
                guestEmail: row.guestEmail ?? "",
                visitDate: String(row.visitDate).slice(0, 10),
                notes: row.notes ?? "",
              });
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={row.status === "CANCELLED"}
            onClick={() => {
              setCancelling(row);
              setCancelReason("");
            }}
          >
            Cancel
          </Button>
          {row.status === "CANCELLED" ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600"
              onClick={async () => {
                const ok = window.confirm("Delete this cancelled booking permanently?");
                if (!ok) return;
                const response = await fetch(`/api/v1/bookings/${row.id}`, { method: "DELETE" });
                if (!response.ok) {
                  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
                  pushToast({ title: "Delete failed", message: payload?.message ?? "Could not delete booking", variant: "error" });
                  return;
                }
                pushToast({ title: "Booking deleted", variant: "success" });
                await loadBookings();
              }}
            >
              Delete
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  async function applyCoupon(): Promise<void> {
    const code = sanitizeCouponCode(createDraft.couponCode);
    if (!code) {
      setCouponError("Enter a coupon code");
      setCouponDiscount(0);
      return;
    }
    if (!createDraft.guestMobile || !/^[6-9]\d{9}$/.test(createDraft.guestMobile)) {
      setCouponError("Enter valid mobile number before applying coupon");
      return;
    }

    setApplyingCoupon(true);
    setCouponError("");
    try {
      const subtotal = createDraft.ticketLines.reduce((sum, line) => sum + line.quantity * (ticketMap.get(line.ticketTypeId)?.price ?? 0), 0);
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
          ticketTypeIds: createDraft.ticketLines.map((line) => line.ticketTypeId),
          visitDate: createDraft.visitDate,
          mobile: createDraft.guestMobile,
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

  async function submitCreateBooking(): Promise<void> {
    if (!validateAddStep(3)) return;

    setAddSaving(true);
    try {
      const response = await fetch("/api/v1/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: createDraft.guestName,
          guestMobile: createDraft.guestMobile.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""),
          guestEmail: createDraft.guestEmail.trim(),
          visitDate: createDraft.visitDate,
          ticketLines: createDraft.ticketLines,
          couponCode: sanitizeCouponCode(createDraft.couponCode) ?? undefined,
          idProofType: createDraft.idProofType,
          idProofNumber: createDraft.idProofNumber,
          idProofLabel: createDraft.idProofLabel,
          paymentPlan: createDraft.paymentPlan,
          advancePercent: createDraft.paymentPlan === "ADVANCE" ? createDraft.advancePercent : undefined,
          paymentMethod: createDraft.paymentMethod,
          paymentReference: createDraft.paymentReference || undefined,
          customDiscountType: createDraft.customDiscountType,
          customDiscountValue: createDraft.customDiscountType === "NONE" ? 0 : createDraft.customDiscountValue,
          packageLines: createDraft.packageLines,
          foodLines: createDraft.foodLines,
          lockerLines: createDraft.lockerLines,
          costumeLines: createDraft.costumeLines,
          rideLines: createDraft.rideLines,
          participants: participants.map((participant) => ({
            name: participant.name,
            gender: participant.gender,
            age: participant.age,
            ticketTypeId: participant.ticketTypeId,
            isLeadGuest: participant.isLeadGuest,
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string; booking?: { bookingNumber?: string } } | null;
      if (!response.ok) {
        const firstError = getApiValidationMessage((payload as { errors?: unknown } | null)?.errors);
        pushToast({
          title: "Create failed",
          message: firstError ?? payload?.message ?? "Could not create booking",
          variant: "error",
        });
        return;
      }

      pushToast({
        title: "Booking created",
        message: payload?.booking?.bookingNumber ? `Booking number ${payload.booking.bookingNumber}` : undefined,
        variant: "success",
      });
      setAddOpen(false);
      setAddStep(1);
      setCreateDraft({
        ...DEFAULT_CREATE_DRAFT,
        visitDate: dateRange.min,
      });
      setParticipants([]);
      setCouponDiscount(0);
      setCouponError("");
      setFormErrors({});
      setPage(1);
      await loadBookings();
    } finally {
      setAddSaving(false);
    }
  }

  async function submitEditBooking(): Promise<void> {
    if (!editing) return;
    setEditSaving(true);
    try {
      const response = await fetch(`/api/v1/bookings/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: editDraft.guestName.trim(),
          guestMobile: editDraft.guestMobile.trim(),
          guestEmail: editDraft.guestEmail.trim(),
          visitDate: editDraft.visitDate,
          notes: editDraft.notes,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        pushToast({ title: "Update failed", message: payload?.message ?? "Could not update booking", variant: "error" });
        return;
      }
      pushToast({ title: "Booking updated", variant: "success" });
      setEditing(null);
      await loadBookings();
    } finally {
      setEditSaving(false);
    }
  }

  async function submitCancelBooking(): Promise<void> {
    if (!cancelling) return;
    if (cancelReason.trim().length < 3) {
      pushToast({ title: "Reason required", message: "Enter at least 3 characters", variant: "error" });
      return;
    }
    setCancelSaving(true);
    try {
      const response = await fetch(`/api/v1/bookings/${cancelling.id}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; refund?: { finalRefundAmount?: number; deductionAmount?: number; deductionPercent?: number } }
        | null;
      if (!response.ok) {
        pushToast({ title: "Cancel failed", message: payload?.message ?? "Could not cancel booking", variant: "error" });
        return;
      }
      const refundMessage =
        payload?.refund && typeof payload.refund.finalRefundAmount === "number"
          ? `Refund: ${formatCurrency(payload.refund.finalRefundAmount)} (Deduction ${payload.refund.deductionPercent ?? 0}% = ${formatCurrency(payload.refund.deductionAmount ?? 0)})`
          : "Booking cancelled & refunded";
      pushToast({ title: "Booking cancelled", message: refundMessage, variant: "success" });
      setCancelling(null);
      setCancelReason("");
      await loadBookings();
    } finally {
      setCancelSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bookings"
      subtitle="Manage pre-bookings only: create, edit, cancel, refund, and delete."
        actions={[
          {
            key: "add-booking",
            element: (
              <Button
                onClick={() => {
                  const firstTicket = ticketTypes[0];
                  setCreateDraft({
                    ...DEFAULT_CREATE_DRAFT,
                    visitDate: dateRange.min || new Date().toISOString().slice(0, 10),
                    ticketLines: firstTicket ? [{ ticketTypeId: firstTicket.id, quantity: 1 }] : [],
                  });
                  setParticipants([]);
                  setFormErrors({});
                  setCouponError("");
                  setCouponDiscount(0);
                  setAddStep(1);
                  setAddOpen(true);
                }}
              >
                Add Booking
              </Button>
            ),
          },
        ]}
      />

      <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-[1fr_220px_auto]">
        <Input
          placeholder="Search by booking number, guest, mobile"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={[
            { label: "All Status", value: "" },
            { label: "PENDING", value: "PENDING" },
            { label: "CONFIRMED", value: "CONFIRMED" },
            { label: "CHECKED_IN", value: "CHECKED_IN" },
            { label: "COMPLETED", value: "COMPLETED" },
            { label: "CANCELLED", value: "CANCELLED" },
          ]}
        />
        <Button
          variant="outline"
          onClick={() => {
            setPage(1);
            void loadBookings();
          }}
        >
          Apply Filters
        </Button>
      </div>

      <DataTable
        data={items}
        columns={columns}
        loading={loading}
        rowKey={(row) => row.id}
        emptyTitle="No bookings found"
        emptyMessage="Try changing status or search query."
      />

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        perPage={pagination.limit}
        onPageChange={setPage}
        onPerPageChange={(value) => {
          setPerPage(value);
          setPage(1);
        }}
      />

      <Modal
        open={addOpen}
        onClose={() => {
          if (!addSaving) setAddOpen(false);
        }}
        title="Add Booking"
        description="Structured booking flow with guest details, ID proof, ticket selection and participants."
        className="max-w-5xl"
        footer={
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setAddStep((current) => Math.max(1, current - 1))}
              disabled={addSaving || addStep === 1}
            >
              Back
            </Button>

            {addStep < 3 ? (
              <Button
                onClick={() => {
                  const ok = validateAddStep(addStep + 1);
                  if (ok) setAddStep((current) => Math.min(3, current + 1));
                }}
                disabled={addSaving}
              >
                Continue
              </Button>
            ) : (
              <Button onClick={() => void submitCreateBooking()} loading={addSaving}>
                Create Booking
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <StepIndicator steps={ADD_STEPS} currentStep={addStep} />

          {addStep === 1 ? (
            <Step1GuestDetails
              value={{
                guestName: createDraft.guestName,
                guestMobile: createDraft.guestMobile,
                guestEmail: createDraft.guestEmail,
                visitDate: createDraft.visitDate,
                idProofType: createDraft.idProofType,
                idProofNumber: createDraft.idProofNumber,
                idProofLabel: createDraft.idProofLabel,
              }}
              errors={formErrors}
              onChange={(patch) => setCreateDraft((current) => ({ ...current, ...patch }))}
              minVisitDate={dateRange.min}
              maxVisitDate={dateRange.max}
              idProofRequired={idProofRequired}
            />
          ) : null}

          {addStep === 2 ? (
            <Step2TicketSelection
              tickets={ticketTypes}
              ticketLines={createDraft.ticketLines}
              error={formErrors.ticketLines}
              participants={participants}
              onTicketLinesChange={(next) => setCreateDraft((current) => ({ ...current, ticketLines: next }))}
              onParticipantsChange={setParticipants}
            />
          ) : null}

          {addStep === 3 ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <Select
                  label="Available Coupons"
                  value={createDraft.couponCode}
                  onChange={(event) => {
                    const couponCode = event.target.value;
                    setCreateDraft((current) => ({ ...current, couponCode }));
                    setCouponError("");
                    setCouponDiscount(0);
                  }}
                  options={[
                    { label: "Select coupon (optional)", value: "" },
                    ...couponOptions.map((item) => ({
                      label: `${item.code}${item.title ? ` · ${item.title}` : ""} (${item.discountType.replaceAll("_", " ")})`,
                      value: item.code,
                    })),
                  ]}
                />
                <CouponInput
                  value={createDraft.couponCode}
                  onChange={(couponCode) => {
                    setCreateDraft((current) => ({ ...current, couponCode }));
                    setCouponError("");
                    setCouponDiscount(0);
                  }}
                  onApply={() => void applyCoupon()}
                  loading={applyingCoupon}
                  error={couponError}
                />

                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">Custom Discount</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Select
                      label="Discount Type"
                      value={createDraft.customDiscountType}
                      onChange={(event) =>
                        setCreateDraft((current) => ({
                          ...current,
                          customDiscountType: (event.target.value as "NONE" | "PERCENTAGE" | "AMOUNT") ?? "NONE",
                        }))
                      }
                      options={[
                        { label: "No Custom Discount", value: "NONE" },
                        { label: "Percentage", value: "PERCENTAGE" },
                        { label: "Fixed Amount", value: "AMOUNT" },
                      ]}
                    />
                    <Input
                      label={createDraft.customDiscountType === "PERCENTAGE" ? "Discount (%)" : "Discount Amount (₹)"}
                      type="number"
                      min={0}
                      max={createDraft.customDiscountType === "PERCENTAGE" ? 100 : undefined}
                      value={String(createDraft.customDiscountValue)}
                      onChange={(event) =>
                        setCreateDraft((current) => ({
                          ...current,
                          customDiscountValue: Math.max(0, Number(event.target.value || 0)),
                        }))
                      }
                      disabled={createDraft.customDiscountType === "NONE"}
                    />
                  </div>
                </div>

                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">Packages & Add-ons</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    For locker and costume, booking stores requested quantity. Final unit allocation happens at ticket POS when this booking is loaded.
                  </p>

                  <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
                    <Select
                      label="Package"
                      value={packagePicker.packageId}
                      onChange={(event) => setPackagePicker((current) => ({ ...current, packageId: event.target.value }))}
                      options={[{ label: "Select package", value: "" }, ...packageOptions.map((item) => ({ label: `${item.name} (₹${item.salePrice})`, value: item.id }))]}
                    />
                    <Input
                      label="Qty"
                      type="number"
                      min={1}
                      value={packagePicker.quantity}
                      onChange={(event) => setPackagePicker((current) => ({ ...current, quantity: event.target.value }))}
                    />
                    <div className="self-end">
                      <Button variant="outline" onClick={addPackageLine}>Add Package</Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
                    <Select
                      label="Food"
                      value={foodPicker.id}
                      onChange={(event) => setFoodPicker((current) => ({ ...current, id: event.target.value }))}
                      options={[{ label: "Select food", value: "" }, ...foodOptions.map((item) => ({ label: `${item.variantName ? `${item.name} · ${item.variantName}` : item.name} (₹${item.price})`, value: item.id }))]}
                    />
                    <Input
                      label="Qty"
                      type="number"
                      min={1}
                      value={foodPicker.quantity}
                      onChange={(event) => setFoodPicker((current) => ({ ...current, quantity: event.target.value }))}
                    />
                    <div className="self-end">
                      <Button variant="outline" onClick={addFoodLine}>Add Food</Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
                    <Select
                      label="Locker"
                      value={lockerPicker.lockerId}
                      onChange={(event) => setLockerPicker((current) => ({ ...current, lockerId: event.target.value }))}
                      options={[{ label: "Select locker", value: "" }, ...lockerOptions.map((item) => ({ label: `${item.number} (₹${item.rate})`, value: item.id }))]}
                    />
                    <Input
                      label="Qty"
                      type="number"
                      min={1}
                      value={lockerPicker.quantity}
                      onChange={(event) => setLockerPicker((current) => ({ ...current, quantity: event.target.value }))}
                    />
                    <div className="self-end">
                      <Button variant="outline" onClick={addLockerLine}>Add Locker</Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
                    <Select
                      label="Costume"
                      value={costumePicker.costumeItemId}
                      onChange={(event) => setCostumePicker((current) => ({ ...current, costumeItemId: event.target.value }))}
                      options={[{ label: "Select costume", value: "" }, ...costumeOptions.map((item) => ({ label: `${item.name} · ${item.categoryName} (₹${item.rentalRate})`, value: item.id }))]}
                    />
                    <Input
                      label="Qty"
                      type="number"
                      min={1}
                      value={costumePicker.quantity}
                      onChange={(event) => setCostumePicker((current) => ({ ...current, quantity: event.target.value }))}
                    />
                    <div className="self-end">
                      <Button variant="outline" onClick={addCostumeLine}>Add Costume</Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
                    <Select
                      label="Ride"
                      value={ridePicker.rideId}
                      onChange={(event) => setRidePicker((current) => ({ ...current, rideId: event.target.value }))}
                      options={[{ label: "Select ride", value: "" }, ...rideOptions.map((item) => ({ label: `${item.name} (₹${item.entryFee})`, value: item.id }))]}
                    />
                    <Input
                      label="Qty"
                      type="number"
                      min={1}
                      value={ridePicker.quantity}
                      onChange={(event) => setRidePicker((current) => ({ ...current, quantity: event.target.value }))}
                    />
                    <div className="self-end">
                      <Button variant="outline" onClick={addRideLine}>Add Ride</Button>
                    </div>
                  </div>

                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 space-y-3">
                    <p className="text-xs font-medium text-[var(--color-text-muted)]">Selected Add-on Lines</p>

                    {createDraft.packageLines.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-[var(--color-text)]">Packages</p>
                        {createDraft.packageLines.map((line, index) => (
                          <div key={`pkg-${index}`} className="grid gap-2 md:grid-cols-[1fr_90px_auto]">
                            <Select
                              value={line.packageId}
                              onChange={(event) => updatePackageLine(index, { packageId: event.target.value })}
                              options={packageOptions.map((item) => ({ label: `${item.name} (₹${item.salePrice})`, value: item.id }))}
                            />
                            <Input
                              type="number"
                              min={1}
                              value={String(line.quantity)}
                              onChange={(event) => updatePackageLine(index, { quantity: Math.max(1, Number(event.target.value || 1)) })}
                            />
                            <Button
                              variant="ghost"
                              className="text-red-600"
                              onClick={() =>
                                setCreateDraft((current) => ({
                                  ...current,
                                  packageLines: current.packageLines.filter((_, rowIndex) => rowIndex !== index),
                                }))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {createDraft.foodLines.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-[var(--color-text)]">Food</p>
                        {createDraft.foodLines.map((line, index) => (
                          <div key={`food-${index}`} className="grid gap-2 md:grid-cols-[1fr_90px_auto]">
                            <Select
                              value={line.foodVariantId ? `${line.foodItemId}__${line.foodVariantId}` : line.foodItemId}
                              onChange={(event) => updateFoodLine(index, event.target.value)}
                              options={foodOptions.map((item) => ({
                                label: `${item.variantName ? `${item.name} · ${item.variantName}` : item.name} (₹${item.price})`,
                                value: item.id,
                              }))}
                            />
                            <Input
                              type="number"
                              min={1}
                              value={String(line.quantity)}
                              onChange={(event) => updateFoodLine(index, null, Math.max(1, Number(event.target.value || 1)))}
                            />
                            <Button
                              variant="ghost"
                              className="text-red-600"
                              onClick={() =>
                                setCreateDraft((current) => ({
                                  ...current,
                                  foodLines: current.foodLines.filter((_, rowIndex) => rowIndex !== index),
                                }))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {createDraft.lockerLines.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-[var(--color-text)]">Locker</p>
                        {createDraft.lockerLines.map((line, index) => (
                          <div key={`locker-${index}`} className="grid gap-2 md:grid-cols-[1fr_90px_auto]">
                            <Select
                              value={line.lockerId}
                              onChange={(event) => updateLockerLine(index, { lockerId: event.target.value })}
                              options={lockerOptions.map((item) => ({ label: `${item.number} (₹${item.rate})`, value: item.id }))}
                            />
                            <Input
                              type="number"
                              min={1}
                              value={String(line.quantity)}
                              onChange={(event) => updateLockerLine(index, { quantity: Math.max(1, Number(event.target.value || 1)) })}
                            />
                            <Button
                              variant="ghost"
                              className="text-red-600"
                              onClick={() =>
                                setCreateDraft((current) => ({
                                  ...current,
                                  lockerLines: current.lockerLines.filter((_, rowIndex) => rowIndex !== index),
                                }))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {createDraft.costumeLines.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-[var(--color-text)]">Costume</p>
                        {createDraft.costumeLines.map((line, index) => (
                          <div key={`costume-${index}`} className="grid gap-2 md:grid-cols-[1fr_90px_auto]">
                            <Select
                              value={line.costumeItemId}
                              onChange={(event) => updateCostumeLine(index, { costumeItemId: event.target.value })}
                              options={costumeOptions.map((item) => ({ label: `${item.name} · ${item.categoryName} (₹${item.rentalRate})`, value: item.id }))}
                            />
                            <Input
                              type="number"
                              min={1}
                              value={String(line.quantity)}
                              onChange={(event) => updateCostumeLine(index, { quantity: Math.max(1, Number(event.target.value || 1)) })}
                            />
                            <Button
                              variant="ghost"
                              className="text-red-600"
                              onClick={() =>
                                setCreateDraft((current) => ({
                                  ...current,
                                  costumeLines: current.costumeLines.filter((_, rowIndex) => rowIndex !== index),
                                }))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {createDraft.rideLines.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-[var(--color-text)]">Ride</p>
                        {createDraft.rideLines.map((line, index) => (
                          <div key={`ride-${index}`} className="grid gap-2 md:grid-cols-[1fr_90px_auto]">
                            <Select
                              value={line.rideId}
                              onChange={(event) => updateRideLine(index, { rideId: event.target.value })}
                              options={rideOptions.map((item) => ({ label: `${item.name} (₹${item.entryFee})`, value: item.id }))}
                            />
                            <Input
                              type="number"
                              min={1}
                              value={String(line.quantity)}
                              onChange={(event) => updateRideLine(index, { quantity: Math.max(1, Number(event.target.value || 1)) })}
                            />
                            <Button
                              variant="ghost"
                              className="text-red-600"
                              onClick={() =>
                                setCreateDraft((current) => ({
                                  ...current,
                                  rideLines: current.rideLines.filter((_, rowIndex) => rowIndex !== index),
                                }))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {createDraft.packageLines.length === 0 &&
                    createDraft.foodLines.length === 0 &&
                    createDraft.lockerLines.length === 0 &&
                    createDraft.costumeLines.length === 0 &&
                    createDraft.rideLines.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-muted)]">No add-on lines selected yet.</p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">Payment Plan</h2>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Select
                      label="Plan"
                      value={createDraft.paymentPlan}
                      onChange={(event) =>
                        setCreateDraft((current) => ({
                          ...current,
                          paymentPlan: (event.target.value as "FULL" | "ADVANCE") || "FULL",
                        }))
                      }
                      options={[
                        { label: "Full Payment", value: "FULL" },
                        { label: "Advance + Balance at Gate", value: "ADVANCE" },
                      ]}
                    />
                    {createDraft.paymentPlan === "ADVANCE" ? (
                      <Input
                        label="Advance %"
                        type="number"
                        min={10}
                        max={90}
                        value={String(createDraft.advancePercent)}
                        onChange={(event) =>
                          setCreateDraft((current) => ({
                            ...current,
                            advancePercent: Math.max(10, Math.min(90, Number(event.target.value || 30))),
                          }))
                        }
                      />
                    ) : null}
                    <Select
                      label="Payment Method"
                      value={createDraft.paymentMethod}
                      onChange={(event) =>
                        setCreateDraft((current) => ({
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
                        createDraft.paymentMethod === "MANUAL_UPI"
                          ? "UPI Transaction Number (UTR)"
                          : createDraft.paymentMethod === "GATEWAY"
                            ? "Gateway Order/Txn Ref"
                            : "Receipt/Reference No. (optional)"
                      }
                      value={createDraft.paymentReference}
                      onChange={(event) =>
                        setCreateDraft((current) => ({
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
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">Booking Summary</h2>
                  <div className="mt-3 space-y-2 text-sm text-[var(--color-text-muted)]">
                    <p>Guest: {createDraft.guestName}</p>
                    <p>Booked By: {String((session?.user as { name?: string } | undefined)?.name ?? "Staff")}</p>
                    <p>Mobile: {createDraft.guestMobile}</p>
                    <p>Visit Date: {parseDateOnlyToUtc(createDraft.visitDate)?.toLocaleDateString("en-IN")}</p>
                    <p>Total Guests: {totalGuests}</p>
                    <p>ID Proof: {createDraft.idProofType ? `${createDraft.idProofType} ••••` : "Not provided"}</p>
                    <p>Payment Plan: {createDraft.paymentPlan === "ADVANCE" ? `Advance ${createDraft.advancePercent}%` : "Full Payment"}</p>
                    <p>Payment Method: {createDraft.paymentMethod}</p>
                    <p>Transaction Ref: {createDraft.paymentReference || "N/A"}</p>
                    <p>Packages/Add-ons: {createDraft.packageLines.length + createDraft.foodLines.length + createDraft.lockerLines.length + createDraft.costumeLines.length + createDraft.rideLines.length}</p>
                    <p>Custom Discount: {createDraft.customDiscountType === "NONE" ? "None" : createDraft.customDiscountType === "PERCENTAGE" ? `${createDraft.customDiscountValue}%` : formatCurrency(createDraft.customDiscountValue)}</p>
                    <p>Pay Now: {formatCurrency(paymentBreakdown.payNow)}</p>
                    <p>Balance Due: {formatCurrency(paymentBreakdown.balanceDue)}</p>
                  </div>
                </div>
              </div>
              <OrderSummary
                subtotal={pricing.subtotal}
                gstAmount={pricing.gstAmount}
                discountAmount={pricing.discountAmount}
                totalAmount={pricing.totalAmount}
                gstRate={ticketMap.get(createDraft.ticketLines[0]?.ticketTypeId ?? "")?.gstRate ?? 18}
              />
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => {
          if (!editSaving) setEditing(null);
        }}
        title={`Edit Booking ${editing?.bookingNumber ?? ""}`}
        className="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={editSaving}>
              Close
            </Button>
            <Button onClick={() => void submitEditBooking()} loading={editSaving}>
              Save Changes
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Guest Name"
            value={editDraft.guestName}
            onChange={(event) => setEditDraft((current) => ({ ...current, guestName: event.target.value }))}
          />
          <Input
            label="Guest Mobile"
            value={editDraft.guestMobile}
            onChange={(event) => setEditDraft((current) => ({ ...current, guestMobile: event.target.value }))}
          />
          <Input
            label="Guest Email"
            value={editDraft.guestEmail}
            onChange={(event) => setEditDraft((current) => ({ ...current, guestEmail: event.target.value }))}
          />
          <Input
            label="Visit Date"
            type="date"
            value={editDraft.visitDate}
            onChange={(event) => setEditDraft((current) => ({ ...current, visitDate: event.target.value }))}
          />
        </div>
        <div className="mt-3 space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="edit-notes">
            Notes
          </label>
          <textarea
            id="edit-notes"
            value={editDraft.notes}
            onChange={(event) => setEditDraft((current) => ({ ...current, notes: event.target.value }))}
            className="min-h-24 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            placeholder="Optional notes"
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(cancelling)}
        onClose={() => {
          if (!cancelSaving) setCancelling(null);
        }}
        title={`Cancel Booking ${cancelling?.bookingNumber ?? ""}`}
        description="This will cancel booking and mark paid transactions as refunded."
        className="max-w-xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelling(null)} disabled={cancelSaving}>
              Close
            </Button>
            <Button variant="danger" onClick={() => void submitCancelBooking()} loading={cancelSaving}>
              Confirm Cancel
            </Button>
          </div>
        }
      >
        <div className="space-y-1.5">
          <label htmlFor="cancel-reason" className="text-sm font-medium text-[var(--color-text)]">
            Cancellation Reason
          </label>
          <textarea
            id="cancel-reason"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            className="min-h-24 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            placeholder="Enter reason..."
          />
        </div>
      </Modal>
    </div>
  );
}
