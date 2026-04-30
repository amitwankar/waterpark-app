"use client";

import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

// ─── Types ────────────────────────────────────────────────────────────────────

type CouponItem = {
  id: string;
  code: string;
  title: string | null;
  description: string | null;
  discountType: string;
  discountValue: number;
  currentUses: number;
  maxUses: number | null;
  isActive: boolean;
  validFrom: string;
  validTo: string;
  couponScope?: {
    ticket: boolean;
    food: boolean;
    locker: boolean;
    costume: boolean;
    ride: boolean;
    package: boolean;
  };
};

type CouponForm = {
  code: string;
  title: string;
  description: string;
  discountType: string;
  discountValue: string;
  minBookingAmount: string;
  maxUses: string;
  maxUsesPerUser: string;
  validFrom: string;
  validTo: string;
  isPublicOffer: boolean;
  isActive: boolean;
  couponScope: {
    ticket: boolean;
    food: boolean;
    locker: boolean;
    costume: boolean;
    ride: boolean;
    package: boolean;
  };
};

type BatchForm = {
  count: string;
  prefix: string;
  title: string;
  description: string;
  discountType: string;
  discountValue: string;
  minBookingAmount: string;
  maxDiscountCap: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  couponScope: {
    ticket: boolean;
    food: boolean;
    locker: boolean;
    costume: boolean;
    ride: boolean;
    package: boolean;
  };
};

type GeneratedCoupon = {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minBookingAmount: number | null;
  maxDiscountCap: number | null;
  validFrom: string;
  validTo: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const discountOptions = [
  { value: "PERCENTAGE_DISCOUNT", label: "Percentage Discount" },
  { value: "FLAT_DISCOUNT", label: "Flat Discount" },
  { value: "FREE_TICKET", label: "Free Ticket" },
  { value: "BUY_X_GET_Y", label: "Buy X Get Y" },
  { value: "FLAT_PER_TICKET", label: "Flat Per Ticket" },
  { value: "FOOD_DISCOUNT", label: "Food Discount" },
  { value: "LOCKER_FREE", label: "Locker Free" },
];

const scopeKeys = [
  ["ticket", "Ticket"],
  ["food", "Food"],
  ["locker", "Locker"],
  ["costume", "Costume"],
  ["ride", "Ride"],
  ["package", "Package"],
] as const;

const defaultScope = {
  ticket: true,
  food: true,
  locker: true,
  costume: true,
  ride: true,
  package: true,
};

const initialForm: CouponForm = {
  code: "",
  title: "",
  description: "",
  discountType: "PERCENTAGE_DISCOUNT",
  discountValue: "",
  minBookingAmount: "",
  maxUses: "",
  maxUsesPerUser: "1",
  validFrom: "",
  validTo: "",
  isPublicOffer: true,
  isActive: true,
  couponScope: { ...defaultScope },
};

const initialBatchForm: BatchForm = {
  count: "15",
  prefix: "",
  title: "",
  description: "",
  discountType: "PERCENTAGE_DISCOUNT",
  discountValue: "",
  minBookingAmount: "",
  maxDiscountCap: "",
  validFrom: "",
  validTo: "",
  isActive: true,
  couponScope: { ...defaultScope },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toInputDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatDiscount(discountType: string, discountValue: number): string {
  if (discountType === "PERCENTAGE_DISCOUNT" || discountType === "FOOD_DISCOUNT") {
    return `${discountValue}% OFF`;
  }
  return `₹${discountValue} OFF`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── CouponPrintSheet ─────────────────────────────────────────────────────────

interface CouponPrintSheetProps {
  coupons: GeneratedCoupon[];
  parkName: string;
  onClose: () => void;
}

function CouponPrintSheet({ coupons, parkName, onClose }: CouponPrintSheetProps) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    if (!printRef.current) return;
    const container = document.createElement("div");
    container.id = "__coupon-print-root";
    container.style.cssText = "display:none;";
    container.innerHTML = printRef.current.outerHTML;
    const style = document.createElement("style");
    style.id = "__coupon-print-style";
    style.textContent = `
      @media print {
        @page { size: A4; margin: 8mm; }
        body > * { visibility: hidden !important; }
        #__coupon-print-root,
        #__coupon-print-root * { visibility: visible !important; }
        #__coupon-print-root {
          display: block !important;
          position: fixed !important;
          top: 0; left: 0;
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(container);
    const cleanup = () => {
      document.getElementById("__coupon-print-style")?.remove();
      document.getElementById("__coupon-print-root")?.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 5000);
  }

  const firstCoupon = coupons[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 bg-white px-6 py-3 border-b border-gray-200 shrink-0">
        <div>
          <p className="font-semibold text-gray-900">{coupons.length} Coupon Codes Generated</p>
          {firstCoupon && (
            <p className="text-sm text-gray-500">
              {formatDiscount(firstCoupon.discountType, firstCoupon.discountValue)} · Valid{" "}
              {formatDate(firstCoupon.validFrom)} – {formatDate(firstCoupon.validTo)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Save PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
        <div ref={printRef} className="bg-white p-2">
          <div className="grid grid-cols-3 gap-[4mm]">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="border border-dashed border-gray-400 rounded p-2.5 text-center break-inside-avoid bg-white font-sans"
              >
                {/* Scissors hint */}
                <div className="text-[9px] text-gray-400 mb-1.5 tracking-wide">
                  ✂ – – – – – – – – –
                </div>

                {/* Park name */}
                <div className="text-[9px] font-semibold text-teal-700 uppercase tracking-wide mb-1.5">
                  {parkName}
                </div>

                {/* Discount */}
                <div className="text-xl font-extrabold text-gray-900 leading-tight mb-1">
                  {formatDiscount(coupon.discountType, coupon.discountValue)}
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-200 my-2" />

                {/* Code */}
                <div className="text-[11px] text-gray-500 mb-0.5">Coupon Code</div>
                <div className="text-[13px] font-bold tracking-widest font-mono text-gray-800 bg-gray-100 rounded-sm px-1.5 py-0.5 inline-block mb-2">
                  {coupon.code}
                </div>

                {/* Validity */}
                <div className="text-[9px] text-gray-500 leading-relaxed">
                  <div>Valid: {formatDate(coupon.validFrom)} – {formatDate(coupon.validTo)}</div>
                  {coupon.minBookingAmount && (
                    <div>Min order: ₹{coupon.minBookingAmount}</div>
                  )}
                  <div className="mt-0.5 text-gray-400">One-time use only</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CouponsAdminPage(): JSX.Element {
  const [items, setItems] = useState<CouponItem[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Batch state
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchForm, setBatchForm] = useState<BatchForm>(initialBatchForm);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [printSheet, setPrintSheet] = useState<{ coupons: GeneratedCoupon[]; parkName: string } | null>(null);

  function parseApiError(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== "object") return fallback;
    const body = payload as {
      message?: string;
      error?: string;
      issues?: { fieldErrors?: Record<string, string[] | undefined>; formErrors?: string[] };
    };
    const top = body.message || body.error || fallback;
    const fieldErrors = body.issues?.fieldErrors
      ? Object.entries(body.issues.fieldErrors).flatMap(([field, messages]) =>
          (messages ?? []).map((msg) => `${field}: ${msg}`),
        )
      : [];
    const formErrors = body.issues?.formErrors ?? [];
    const all = [...formErrors, ...fieldErrors].filter(Boolean);
    return all.length > 0 ? `${top} (${all.join("; ")})` : top;
  }

  async function loadCoupons(): Promise<void> {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/coupons?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { items?: unknown } | null;
      const nextItems = Array.isArray(payload?.items) ? (payload?.items as CouponItem[]) : [];
      setItems(nextItems);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCoupons();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCoupons(), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const activeCount = Array.isArray(items) ? items.filter((item) => item.isActive).length : 0;

  function resetForm(): void {
    setEditingId(null);
    setForm(initialForm);
    setError(null);
  }

  function openCreate(): void {
    resetForm();
    setOpen(true);
  }

  function openEdit(item: CouponItem): void {
    setEditingId(item.id);
    setForm({
      code: item.code,
      title: item.title ?? "",
      description: item.description ?? "",
      discountType: item.discountType,
      discountValue: String(item.discountValue),
      minBookingAmount: "",
      maxUses: item.maxUses === null ? "" : String(item.maxUses),
      maxUsesPerUser: "1",
      validFrom: toInputDateTime(item.validFrom),
      validTo: toInputDateTime(item.validTo),
      isPublicOffer: true,
      isActive: item.isActive,
      couponScope: item.couponScope ?? { ...defaultScope },
    });
    setError(null);
    setOpen(true);
  }

  async function saveCoupon(): Promise<void> {
    if (!editingId && !form.code.trim()) {
      setError("Coupon code is required.");
      return;
    }
    if (!form.validFrom || !form.validTo) {
      setError("Valid From and Valid To are required.");
      return;
    }
    const validFromDate = new Date(form.validFrom);
    const validToDate = new Date(form.validTo);
    if (Number.isNaN(validFromDate.getTime()) || Number.isNaN(validToDate.getTime())) {
      setError("Please enter valid dates.");
      return;
    }
    if (validToDate.getTime() <= validFromDate.getTime()) {
      setError("Valid To must be later than Valid From.");
      return;
    }

    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {
      ...(editingId ? {} : { code: form.code.toUpperCase() }),
      title: form.title.trim() || undefined,
      description: form.description.trim() || undefined,
      discountType: form.discountType,
      discountValue: Number(form.discountValue || 0),
      minBookingAmount: form.minBookingAmount ? Number(form.minBookingAmount) : undefined,
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      maxUsesPerUser: form.maxUsesPerUser ? Number(form.maxUsesPerUser) : null,
      validFrom: validFromDate.toISOString(),
      validTo: validToDate.toISOString(),
      isPublicOffer: form.isPublicOffer,
      isActive: form.isActive,
      couponScope: form.couponScope,
    };

    const response = await fetch(editingId ? `/api/v1/coupons/${editingId}` : "/api/v1/coupons", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(parseApiError(result, "Could not save coupon"));
      setSaving(false);
      return;
    }

    setOpen(false);
    setSaving(false);
    resetForm();
    await loadCoupons();
  }

  function toggleScope(
    key: keyof CouponForm["couponScope"],
    target: "form" | "batch",
  ): void {
    if (target === "form") {
      setForm((prev) => ({ ...prev, couponScope: { ...prev.couponScope, [key]: !prev.couponScope[key] } }));
    } else {
      setBatchForm((prev) => ({ ...prev, couponScope: { ...prev.couponScope, [key]: !prev.couponScope[key] } }));
    }
  }

  async function deleteCoupon(id: string): Promise<void> {
    const ok = window.confirm("Delete this coupon?");
    if (!ok) return;
    await fetch(`/api/v1/coupons/${id}`, { method: "DELETE" });
    await loadCoupons();
  }

  async function generateBatch(): Promise<void> {
    const count = parseInt(batchForm.count, 10);
    if (!count || count < 1 || count > 500) {
      setBatchError("Count must be between 1 and 500.");
      return;
    }
    if (!batchForm.discountValue || Number(batchForm.discountValue) <= 0) {
      setBatchError("Discount value is required.");
      return;
    }
    if (!batchForm.validFrom || !batchForm.validTo) {
      setBatchError("Valid From and Valid To are required.");
      return;
    }
    const validFromDate = new Date(batchForm.validFrom);
    const validToDate = new Date(batchForm.validTo);
    if (Number.isNaN(validFromDate.getTime()) || Number.isNaN(validToDate.getTime())) {
      setBatchError("Please enter valid dates.");
      return;
    }
    if (validToDate <= validFromDate) {
      setBatchError("Valid To must be later than Valid From.");
      return;
    }

    setBatchSaving(true);
    setBatchError(null);

    const payload = {
      count,
      prefix: batchForm.prefix.trim().toUpperCase() || undefined,
      title: batchForm.title.trim() || undefined,
      description: batchForm.description.trim() || undefined,
      discountType: batchForm.discountType,
      discountValue: Number(batchForm.discountValue),
      minBookingAmount: batchForm.minBookingAmount ? Number(batchForm.minBookingAmount) : undefined,
      maxDiscountCap: batchForm.maxDiscountCap ? Number(batchForm.maxDiscountCap) : undefined,
      validFrom: validFromDate.toISOString(),
      validTo: validToDate.toISOString(),
      couponScope: batchForm.couponScope,
      isActive: batchForm.isActive,
    };

    const response = await fetch("/api/v1/coupons/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setBatchError(parseApiError(result, "Could not generate coupons"));
      setBatchSaving(false);
      return;
    }

    const result = await response.json() as { coupons: GeneratedCoupon[]; parkName: string };
    setBatchOpen(false);
    setBatchSaving(false);
    setBatchForm(initialBatchForm);
    setBatchError(null);
    setPrintSheet({ coupons: result.coupons, parkName: result.parkName });
    await loadCoupons();
  }

  return (
    <>
      {printSheet && (
        <CouponPrintSheet
          coupons={printSheet.coupons}
          parkName={printSheet.parkName}
          onClose={() => setPrintSheet(null)}
        />
      )}

      <div className="space-y-6">
        <PageHeader
          title="Coupons & Promotions"
          subtitle="Manage discount rules, validity windows and redemption limits."
          actions={[
            {
              key: "batch",
              element: (
                <Button
                  variant="outline"
                  onClick={() => {
                    setBatchForm(initialBatchForm);
                    setBatchError(null);
                    setBatchOpen(true);
                  }}
                >
                  Generate Batch
                </Button>
              ),
            },
            { key: "new", element: <Button onClick={openCreate}>New Coupon</Button> },
          ]}
        />

        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by code/title"
                className="w-80"
              />
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <span>Total: {items.length}</span>
                <span>Active: {activeCount}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Discount</th>
                    <th className="px-3 py-2 font-medium">Usage</th>
                    <th className="px-3 py-2 font-medium">Validity</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--color-border)]">
                      <td className="px-3 py-2 font-medium text-[var(--color-text)] font-mono">{item.code}</td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">{item.discountType.replaceAll("_", " ")}</td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">Rs.{item.discountValue}</td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">
                        {item.currentUses} / {item.maxUses ?? "∞"}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">
                        {new Date(item.validFrom).toLocaleDateString("en-IN")} -{" "}
                        {new Date(item.validTo).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={item.isActive ? "success" : "default"}>
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => void deleteCoupon(item.id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading ? (
                <p className="px-3 py-4 text-sm text-[var(--color-text-muted)]">Loading coupons...</p>
              ) : null}
              {!loading && items.length === 0 ? (
                <p className="px-3 py-4 text-sm text-[var(--color-text-muted)]">No coupons found.</p>
              ) : null}
            </div>
          </CardBody>
        </Card>

        {/* Single coupon modal */}
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={editingId ? "Edit Coupon" : "Create Coupon"}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void saveCoupon()} loading={saving}>
                Save Coupon
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            {!editingId ? (
              <Input
                label="Coupon Code"
                value={form.code}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))
                }
                placeholder="WELCOME20"
              />
            ) : null}
            <Input
              label="Title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
            <Select
              label="Discount Type"
              value={form.discountType}
              onChange={(event) => setForm((prev) => ({ ...prev, discountType: event.target.value }))}
              options={discountOptions}
            />
            <Input
              label="Discount Value"
              type="number"
              min={0}
              value={form.discountValue}
              onChange={(event) => setForm((prev) => ({ ...prev, discountValue: event.target.value }))}
            />
            <Input
              label="Min Booking Amount"
              type="number"
              min={0}
              value={form.minBookingAmount}
              onChange={(event) => setForm((prev) => ({ ...prev, minBookingAmount: event.target.value }))}
            />
            <Input
              label="Max Uses"
              type="number"
              min={1}
              value={form.maxUses}
              onChange={(event) => setForm((prev) => ({ ...prev, maxUses: event.target.value }))}
            />
            <Input
              label="Max Uses Per User"
              type="number"
              min={1}
              value={form.maxUsesPerUser}
              onChange={(event) => setForm((prev) => ({ ...prev, maxUsesPerUser: event.target.value }))}
            />
            <Input
              label="Valid From"
              type="datetime-local"
              value={form.validFrom}
              onChange={(event) => setForm((prev) => ({ ...prev, validFrom: event.target.value }))}
            />
            <Input
              label="Valid To"
              type="datetime-local"
              value={form.validTo}
              onChange={(event) => setForm((prev) => ({ ...prev, validTo: event.target.value }))}
            />
            <Select
              label="Public Offer"
              value={form.isPublicOffer ? "1" : "0"}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, isPublicOffer: event.target.value === "1" }))
              }
              options={[
                { value: "1", label: "Yes" },
                { value: "0", label: "No" },
              ]}
            />
            <Select
              label="Status"
              value={form.isActive ? "1" : "0"}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.value === "1" }))}
              options={[
                { value: "1", label: "Active" },
                { value: "0", label: "Inactive" },
              ]}
            />
            <ScopeMatrix
              scope={form.couponScope}
              onToggle={(key) => toggleScope(key, "form")}
            />
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Description</label>
              <textarea
                title="Description"
                placeholder="Optional notes about this coupon"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
        </Modal>

        {/* Batch generation modal */}
        <Modal
          open={batchOpen}
          onClose={() => setBatchOpen(false)}
          title="Generate Coupon Batch"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBatchOpen(false)} disabled={batchSaving}>
                Cancel
              </Button>
              <Button onClick={() => void generateBatch()} loading={batchSaving}>
                Generate & Print
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Number of Coupons *"
              type="number"
              min={1}
              max={500}
              value={batchForm.count}
              onChange={(event) => setBatchForm((prev) => ({ ...prev, count: event.target.value }))}
              placeholder="15"
            />
            <Input
              label="Code Prefix (optional)"
              value={batchForm.prefix}
              onChange={(event) =>
                setBatchForm((prev) => ({ ...prev, prefix: event.target.value.toUpperCase() }))
              }
              placeholder="SUMMER → SUMMER-AB12345"
            />
            <Select
              label="Discount Type *"
              value={batchForm.discountType}
              onChange={(event) => setBatchForm((prev) => ({ ...prev, discountType: event.target.value }))}
              options={discountOptions}
            />
            <Input
              label="Discount Value *"
              type="number"
              min={0}
              value={batchForm.discountValue}
              onChange={(event) =>
                setBatchForm((prev) => ({ ...prev, discountValue: event.target.value }))
              }
              placeholder={batchForm.discountType === "PERCENTAGE_DISCOUNT" ? "20 (= 20%)" : "200 (= ₹200)"}
            />
            <Input
              label="Min Booking Amount"
              type="number"
              min={0}
              value={batchForm.minBookingAmount}
              onChange={(event) =>
                setBatchForm((prev) => ({ ...prev, minBookingAmount: event.target.value }))
              }
            />
            <Input
              label="Max Discount Cap (₹)"
              type="number"
              min={0}
              value={batchForm.maxDiscountCap}
              onChange={(event) =>
                setBatchForm((prev) => ({ ...prev, maxDiscountCap: event.target.value }))
              }
            />
            <Input
              label="Valid From *"
              type="datetime-local"
              value={batchForm.validFrom}
              onChange={(event) => setBatchForm((prev) => ({ ...prev, validFrom: event.target.value }))}
            />
            <Input
              label="Valid To *"
              type="datetime-local"
              value={batchForm.validTo}
              onChange={(event) => setBatchForm((prev) => ({ ...prev, validTo: event.target.value }))}
            />
            <Select
              label="Status"
              value={batchForm.isActive ? "1" : "0"}
              onChange={(event) =>
                setBatchForm((prev) => ({ ...prev, isActive: event.target.value === "1" }))
              }
              options={[
                { value: "1", label: "Active" },
                { value: "0", label: "Inactive" },
              ]}
            />
            <Input
              label="Title (printed on coupon)"
              value={batchForm.title}
              onChange={(event) => setBatchForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Summer Splash Discount"
            />
            <ScopeMatrix
              scope={batchForm.couponScope}
              onToggle={(key) => toggleScope(key, "batch")}
            />
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Description</label>
              <textarea
                title="Description"
                placeholder="Optional notes printed on coupon"
                value={batchForm.description}
                onChange={(event) =>
                  setBatchForm((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={2}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            Each generated code is unique and can be used only once. After generating, a print sheet opens so you can print and cut the coupon tickets.
          </p>
          {batchError ? <p className="mt-2 text-sm text-[var(--color-danger)]">{batchError}</p> : null}
        </Modal>
      </div>
    </>
  );
}

// ─── ScopeMatrix (shared) ─────────────────────────────────────────────────────

interface ScopeMatrixProps {
  scope: Record<string, boolean>;
  onToggle: (key: "ticket" | "food" | "locker" | "costume" | "ride" | "package") => void;
}

function ScopeMatrix({ scope, onToggle }: ScopeMatrixProps) {
  return (
    <div className="md:col-span-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
      <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Coupon Scope</p>
      <p className="mb-3 text-xs text-[var(--color-text-muted)]">
        Coupon applies only when selected cart types are present.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {scopeKeys.map(([key, label]) => (
          <label
            key={key}
            className="inline-flex items-center gap-2 rounded border border-[var(--color-border)] px-2 py-1.5 text-sm text-[var(--color-text)]"
          >
            <input type="checkbox" title={label} checked={Boolean(scope[key])} onChange={() => onToggle(key)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
