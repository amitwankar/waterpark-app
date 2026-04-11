"use client";

import { useState } from "react";
import { z } from "zod";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  location: z.string().optional(),
  isOpen: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

interface Outlet {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  isOpen: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface Props {
  outlet: Outlet | null;
  onClose: () => void;
  onSaved: () => void;
}

export function OutletFormModal({ outlet, onClose, onSaved }: Props) {
  const [name, setName] = useState(outlet?.name ?? "");
  const [description, setDescription] = useState(outlet?.description ?? "");
  const [location, setLocation] = useState(outlet?.location ?? "");
  const [isOpen, setIsOpen] = useState(outlet?.isOpen ?? true);
  const [isActive, setIsActive] = useState(outlet?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(String(outlet?.sortOrder ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ name, description, location, isOpen, isActive, sortOrder });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = outlet ? `/api/v1/food/outlets/${outlet.id}` : "/api/v1/food/outlets";
      const method = outlet ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Failed to save outlet");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={outlet ? "Edit Outlet" : "New Food Outlet"}
      onClose={onClose}
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <Input
          label="Outlet Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Wave Pool Snack Bar"
          required
        />
        <Input
          label="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Near Wave Pool Entrance"
        />
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional description..."
            className="w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          />
        </div>
        <Input
          label="Sort Order"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={isOpen}
              onChange={(e) => setIsOpen(e.target.checked)}
            />
            Outlet Open
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Outlet Active
          </label>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : outlet ? "Save Changes" : "Create Outlet"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
