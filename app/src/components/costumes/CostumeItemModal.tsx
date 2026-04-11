"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";

const SIZES = ["XS","S","M","L","XL","XXL","KIDS_S","KIDS_M","KIDS_L"] as const;
const SIZE_LABELS: Record<string, string> = {
  XS: "XS", S: "S", M: "M", L: "L", XL: "XL", XXL: "XXL",
  KIDS_S: "Kids S (3-5yr)", KIDS_M: "Kids M (6-9yr)", KIDS_L: "Kids L (10-12yr)",
};

interface Category { id: string; name: string }

interface CostumeItem {
  id?: string;
  categoryId: string;
  tagNumber: string;
  name: string;
  size: typeof SIZES[number];
  rentalRate: number;
  gstRate: number;
  availableQuantity?: number;
  notes?: string | null;
}

interface Props {
  categories: Category[];
  initial?: CostumeItem;
  defaultCategoryId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CostumeItemModal({ categories, initial, defaultCategoryId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<CostumeItem>(
    initial ?? {
      categoryId: defaultCategoryId ?? (categories[0]?.id ?? ""),
      tagNumber: "",
      name: "",
      size: "M",
      rentalRate: 100,
      gstRate: 18,
      availableQuantity: 1,
    }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(initial?.id);

  async function handleSubmit() {
    if (!form.tagNumber.trim() || !form.name.trim() || !form.categoryId) {
      setError("Tag number, name, and category are required.");
      return;
    }
    setSaving(true); setError(null);
    try {
      const url = isEdit
        ? `/api/v1/costumes/items/${initial!.id}`
        : "/api/v1/costumes/items";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: form.categoryId,
          tagNumber: form.tagNumber.trim().toUpperCase(),
          name: form.name.trim(),
          size: form.size,
          rentalRate: Number(form.rentalRate),
          gstRate: Number(form.gstRate),
          availableQuantity: Math.max(0, Number(form.availableQuantity ?? 1)),
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit Costume Item" : "Add Costume Item"}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Category *"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            label="Size *"
            value={form.size}
            onChange={(e) => setForm({ ...form, size: e.target.value as typeof SIZES[number] })}
            options={SIZES.map((s) => ({ value: s, label: SIZE_LABELS[s] }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Tag Number *"
            value={form.tagNumber}
            onChange={(e) => setForm({ ...form, tagNumber: e.target.value.toUpperCase() })}
            placeholder="e.g. CST-001"
          />
          <Input
            label="Display Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Mermaid Dress - M"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Rental Rate (₹) *"
            type="number"
            min="0"
            value={String(form.rentalRate)}
            onChange={(e) => setForm({ ...form, rentalRate: Number(e.target.value) })}
          />
          <Input
            label="GST Rate (%)"
            type="number"
            min="0"
            max="100"
            value={String(form.gstRate)}
            onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })}
          />
        </div>
        <Input
          label="Available Quantity *"
          type="number"
          min="0"
          value={String(form.availableQuantity ?? 1)}
          onChange={(e) => setForm({ ...form, availableQuantity: Number(e.target.value) })}
        />
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Notes</label>
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            placeholder="Internal notes..."
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? "Save Changes" : "Add Item"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
