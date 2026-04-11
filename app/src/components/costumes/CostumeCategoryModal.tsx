"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

interface Category {
  id?: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
}

interface Props {
  initial?: Category;
  onClose: () => void;
  onSaved: () => void;
}

export function CostumeCategoryModal({ initial, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Category>(
    initial ?? { name: "", description: "", imageUrl: "", sortOrder: 0 }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(initial?.id);

  async function handleSubmit() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError(null);
    try {
      const url = isEdit
        ? `/api/v1/costumes/categories/${initial!.id}`
        : "/api/v1/costumes/categories";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description || undefined,
          imageUrl: form.imageUrl || undefined,
          sortOrder: Number(form.sortOrder ?? 0),
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
    <Modal open onClose={onClose} title={isEdit ? "Edit Category" : "New Category"}>
      <div className="space-y-4">
        <Input
          label="Category Name *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Mermaid, Pirate, Superhero"
        />
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Description</label>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            placeholder="Optional description"
          />
        </div>
        <Input
          label="Image URL"
          value={form.imageUrl ?? ""}
          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
          placeholder="https://..."
        />
        <Input
          label="Sort Order"
          type="number"
          value={String(form.sortOrder ?? 0)}
          onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? "Save Changes" : "Create Category"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
