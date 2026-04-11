"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

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
};

const discountOptions = [
  { value: "PERCENTAGE_DISCOUNT", label: "Percentage Discount" },
  { value: "FLAT_DISCOUNT", label: "Flat Discount" },
  { value: "FREE_TICKET", label: "Free Ticket" },
  { value: "BUY_X_GET_Y", label: "Buy X Get Y" },
  { value: "FLAT_PER_TICKET", label: "Flat Per Ticket" },
  { value: "FOOD_DISCOUNT", label: "Food Discount" },
  { value: "LOCKER_FREE", label: "Locker Free" },
];

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
};

function toInputDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function CouponsAdminPage(): JSX.Element {
  const [items, setItems] = useState<CouponItem[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCoupons(): Promise<void> {
    setLoading(true);
    const response = await fetch(`/api/v1/coupons?q=${encodeURIComponent(query)}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { items?: CouponItem[] } | null;
    setItems(payload?.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadCoupons();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCoupons(), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const activeCount = useMemo(() => items.filter((item) => item.isActive).length, [items]);

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
    });
    setError(null);
    setOpen(true);
  }

  async function saveCoupon(): Promise<void> {
    setSaving(true);
    setError(null);
    const payload = {
      ...(editingId ? {} : { code: form.code.toUpperCase() }),
      title: form.title || undefined,
      description: form.description || undefined,
      discountType: form.discountType,
      discountValue: Number(form.discountValue || 0),
      minBookingAmount: form.minBookingAmount ? Number(form.minBookingAmount) : undefined,
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      maxUsesPerUser: form.maxUsesPerUser ? Number(form.maxUsesPerUser) : null,
      validFrom: new Date(form.validFrom).toISOString(),
      validTo: new Date(form.validTo).toISOString(),
      isPublicOffer: form.isPublicOffer,
      isActive: form.isActive,
    };

    const response = await fetch(editingId ? `/api/v1/coupons/${editingId}` : "/api/v1/coupons", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(result?.message ?? "Could not save coupon");
      setSaving(false);
      return;
    }

    setOpen(false);
    setSaving(false);
    resetForm();
    await loadCoupons();
  }

  async function deleteCoupon(id: string): Promise<void> {
    const ok = window.confirm("Delete this coupon?");
    if (!ok) return;
    await fetch(`/api/v1/coupons/${id}`, { method: "DELETE" });
    await loadCoupons();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons & Promotions"
        subtitle="Manage discount rules, validity windows and redemption limits."
        actions={[
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
                    <td className="px-3 py-2 font-medium text-[var(--color-text)]">{item.code}</td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">{item.discountType.replaceAll("_", " ")}</td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">Rs.{item.discountValue}</td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">
                      {item.currentUses} / {item.maxUses ?? "∞"}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">
                      {new Date(item.validFrom).toLocaleDateString("en-IN")} - {new Date(item.validTo).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={item.isActive ? "success" : "default"}>{item.isActive ? "Active" : "Inactive"}</Badge>
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
            {loading ? <p className="px-3 py-4 text-sm text-[var(--color-text-muted)]">Loading coupons...</p> : null}
            {!loading && items.length === 0 ? <p className="px-3 py-4 text-sm text-[var(--color-text-muted)]">No coupons found.</p> : null}
          </div>
        </CardBody>
      </Card>

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
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
              placeholder="WELCOME20"
            />
          ) : null}
          <Input label="Title" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
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
            onChange={(event) => setForm((prev) => ({ ...prev, isPublicOffer: event.target.value === "1" }))}
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
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={3}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
      </Modal>
    </div>
  );
}
