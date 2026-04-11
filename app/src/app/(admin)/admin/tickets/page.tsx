"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/layout/DataTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/components/feedback/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";

interface TicketType {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  gstRate: number;
  minAge: number | null;
  maxAge: number | null;
  maxPerBooking: number;
  validDays: number;
  sortOrder: number;
  isActive: boolean;
  imageUrl: string | null;
  rideId?: string | null;
  ride?: { id: string; name: string } | null;
}

type FormState = {
  name: string;
  description: string | null;
  category: string;
  price: number;
  gstRate: number;
  minAge: number | null;
  maxAge: number | null;
  maxPerBooking: number | null;
  validDays: number;
  sortOrder: number;
  imageUrl: string | null;
  rideId: string | null;
  isActive: boolean;
};

const DEFAULT_FORM: FormState = {
  name: "",
  description: "",
  category: "General",
  price: 500,
  gstRate: 18,
  minAge: null,
  maxAge: null,
  maxPerBooking: 10,
  validDays: 1,
  sortOrder: 0,
  imageUrl: null,
  rideId: null,
  isActive: true,
};

const COLUMNS: DataTableColumn<TicketType>[] = [
  {
    key: "name",
    header: "Name / Category",
    render: (r) => (
      <div>
        <p className="text-sm font-semibold text-[var(--color-text)]">{r.name}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{r.category}</p>
        {r.description && <p className="max-w-xs truncate text-xs text-[var(--color-text-muted)]">{r.description}</p>}
      </div>
    ),
  },
  {
    key: "price",
    header: "Price",
    render: (r) => (
      <div>
        <span className="text-sm font-semibold text-[var(--color-text)]">₹{Number(r.price).toFixed(2)}</span>
        <span className="ml-1 text-xs text-[var(--color-text-muted)]">+{r.gstRate}% GST</span>
      </div>
    ),
  },
  {
    key: "minAge",
    header: "Age Range",
    render: (r) => (
      <span className="text-sm text-[var(--color-text-muted)]">
        {r.minAge !== null || r.maxAge !== null
          ? `${r.minAge ?? 0}–${r.maxAge ?? "∞"} yrs`
          : "Any age"}
      </span>
    ),
  },
  { key: "maxPerBooking", header: "Max/Booking", render: (r) => <span className="text-sm">{r.maxPerBooking ?? "Unlimited"}</span> },
  { key: "validDays", header: "Valid Days", render: (r) => <span className="text-sm">{r.validDays}</span> },
  { key: "sortOrder", header: "Order", render: (r) => <span className="text-sm text-[var(--color-text-muted)]">{r.sortOrder}</span> },
  {
    key: "isActive",
    header: "Status",
    render: (r) => <Badge variant={r.isActive ? "success" : "danger"}>{r.isActive ? "Active" : "Inactive"}</Badge>,
  },
];

function TicketTypeModal({
  initial,
  rides,
  onClose,
  onSaved,
}: {
  initial?: TicketType;
  rides: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          name: initial.name,
          description: initial.description ?? "",
          category: initial.category,
          price: initial.price,
          gstRate: initial.gstRate,
          minAge: initial.minAge,
          maxAge: initial.maxAge,
          maxPerBooking: initial.maxPerBooking ?? null,
          validDays: initial.validDays,
          sortOrder: initial.sortOrder,
          imageUrl: initial.imageUrl ?? null,
          rideId: initial.rideId ?? null,
          isActive: initial.isActive,
        }
      : DEFAULT_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial?.id);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError(null);
    try {
      const url = isEdit ? `/api/v1/ticket-types/${initial!.id}` : "/api/v1/ticket-types";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description?.trim() || undefined,
          category: form.category.trim() || "General",
          price: Number(form.price),
          gstRate: Number(form.gstRate),
          minAge: form.minAge !== null ? Number(form.minAge) : null,
          maxAge: form.maxAge !== null ? Number(form.maxAge) : null,
          maxPerBooking: form.maxPerBooking !== null ? Number(form.maxPerBooking) : null,
          validDays: Number(form.validDays),
          sortOrder: Number(form.sortOrder),
          imageUrl: form.imageUrl?.trim() || null,
          rideId: form.rideId ?? null,
          isActive: form.isActive,
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
    <Modal open onClose={onClose} title={isEdit ? "Edit Ticket Type" : "New Ticket Type"} className="max-w-3xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input
              label="Name *"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Adult Day Pass"
            />
          </div>
          <Input
            label="Category"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            placeholder="General, VIP, Family…"
          />
          <Input
            label="Sort Order"
            type="number"
            value={String(form.sortOrder)}
            onChange={(e) => set("sortOrder", Number(e.target.value))}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Description</label>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            placeholder="Shown on booking page…"
            className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Price (₹) *"
            type="number"
            min="0"
            value={String(form.price)}
            onChange={(e) => set("price", Number(e.target.value))}
          />
          <Input
            label="GST Rate (%)"
            type="number"
            min="0"
            max="100"
            value={String(form.gstRate)}
            onChange={(e) => set("gstRate", Number(e.target.value))}
          />
          <Input
            label="Max Per Booking"
            type="number"
            min="1"
            value={form.maxPerBooking === null ? "" : String(form.maxPerBooking)}
            onChange={(e) => set("maxPerBooking", e.target.value ? Number(e.target.value) : null)}
            disabled={form.maxPerBooking === null}
            helper={form.maxPerBooking === null ? "Unlimited" : undefined}
          />
        </div>

        <label className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={form.maxPerBooking === null}
            onChange={(e) => set("maxPerBooking", e.target.checked ? null : 10)}
          />
          Allow unlimited bookings for this ticket type
        </label>

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Min Age"
            type="number"
            min="0"
            placeholder="Any"
            value={form.minAge !== null ? String(form.minAge) : ""}
            onChange={(e) => set("minAge", e.target.value ? Number(e.target.value) : null)}
          />
          <Input
            label="Max Age"
            type="number"
            min="0"
            placeholder="Any"
            value={form.maxAge !== null ? String(form.maxAge) : ""}
            onChange={(e) => set("maxAge", e.target.value ? Number(e.target.value) : null)}
          />
          <Input
            label="Valid Days"
            type="number"
            min="1"
            value={String(form.validDays)}
            onChange={(e) => set("validDays", Number(e.target.value))}
          />
        </div>

        <Input
          label="Image URL"
          value={form.imageUrl ?? ""}
          onChange={(e) => set("imageUrl", e.target.value || null)}
          placeholder="https://…"
        />

        <Select
          label="Linked Ride (optional)"
          value={form.rideId ?? ""}
          onChange={(e) => set("rideId", e.target.value || null)}
          options={[
            { value: "", label: "General (not ride-specific)" },
            ...rides.map((ride) => ({ value: ride.id, label: ride.name })),
          ]}
        />

        {isEdit && (
          <Select
            label="Status"
            value={form.isActive ? "active" : "inactive"}
            onChange={(e) => set("isActive", e.target.value === "active")}
            options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
          />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>
            {isEdit ? "Save Changes" : "Create Ticket Type"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function AdminTicketsPage() {
  const { pushToast } = useToast();
  const [types, setTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TicketType | undefined>(undefined);
  const [rides, setRides] = useState<Array<{ id: string; name: string }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ticket-types");
      if (res.ok) setTypes(await res.json());
      const ridesRes = await fetch("/api/v1/rides");
      if (ridesRes.ok) {
        const payload = (await ridesRes.json()) as { items?: Array<{ id: string; name: string }> };
        setRides(payload.items?.map((ride) => ({ id: ride.id, name: ride.name })) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    types.filter((t) => {
      const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "ALL" || (statusFilter === "active" ? t.isActive : !t.isActive);
      return matchSearch && matchStatus;
    }),
  [types, search, statusFilter]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This is irreversible.`)) return;
    try {
      const res = await fetch(`/api/v1/ticket-types/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      pushToast({ title: "Ticket type deleted", variant: "success" });
      await load();
    } catch {
      pushToast({ title: "Delete failed", variant: "error" });
    }
  }

  async function handleToggle(id: string, current: boolean) {
    try {
      const res = await fetch(`/api/v1/ticket-types/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }),
      });
      if (!res.ok) throw new Error("Update failed");
      pushToast({ title: current ? "Ticket deactivated" : "Ticket activated", variant: "success" });
      await load();
    } catch {
      pushToast({ title: "Status update failed", variant: "error" });
    }
  }

  const categories = Array.from(new Set(types.map((t) => t.category))).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ticket Types"
        subtitle="Manage ticket categories, prices, and availability"
        actions={[
          {
            key: "new-ticket",
            element: (
              <Button onClick={() => { setEditing(undefined); setShowModal(true); }}>
                <Plus className="h-4 w-4" />
                Add Ticket Type
              </Button>
            ),
          },
        ]}
      />

      {/* Category summary */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat, index) => {
            const count = types.filter((t) => t.category === cat).length;
            return (
              <div key={`${String(cat).trim().toLowerCase() || "uncategorized"}-${index}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-sm">
                <span className="font-medium text-[var(--color-text)]">{cat}</span>
                <span className="ml-1 text-[var(--color-text-muted)]">({count})</span>
              </div>
            );
          })}
        </div>
      )}

      <Card>
        <CardBody>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <Input
              placeholder="Search by name or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "ALL", label: "All Statuses" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Tag} title="No ticket types" message="Create your first ticket type to get started." />
          ) : (
            <DataTable
              columns={[
                ...COLUMNS,
                {
                  key: "id",
                  header: "Actions",
                  render: (r) => (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditing(r); setShowModal(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggle(r.id, r.isActive)}
                      >
                        {r.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(r.id, r.name)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={filtered}
            />
          )}
        </CardBody>
      </Card>

      {showModal && (
        <TicketTypeModal
          initial={editing}
          rides={rides}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
