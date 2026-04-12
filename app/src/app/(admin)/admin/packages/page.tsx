"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Package as PackageIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/layout/DataTable";
import { useToast } from "@/components/feedback/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";

type ItemType = "TICKET" | "RIDE" | "LOCKER" | "COSTUME" | "FOOD";

interface PackageItem {
  id?: string;
  itemType: ItemType;
  ticketTypeId?: string | null;
  rideId?: string | null;
  lockerId?: string | null;
  costumeItemId?: string | null;
  foodItemId?: string | null;
  foodVariantId?: string | null;
  quantity: number;
  label?: string;
}

interface SalesPackage {
  id: string;
  name: string;
  description: string | null;
  listedPrice: number;
  salePrice: number;
  gstRate: number;
  sortOrder: number;
  isActive: boolean;
  items: PackageItem[];
}

interface OptionRow {
  id: string;
  label: string;
  foodItemId?: string;
  foodVariantId?: string;
}

interface OptionSets {
  tickets: OptionRow[];
  rides: OptionRow[];
  lockers: OptionRow[];
  costumes: OptionRow[];
  food: OptionRow[];
}

const DEFAULT_PACKAGE = {
  name: "",
  description: "",
  listedPrice: 0,
  salePrice: 0,
  gstRate: 18,
  sortOrder: 0,
  isActive: true,
};

function targetKey(type: ItemType): keyof OptionSets {
  if (type === "TICKET") return "tickets";
  if (type === "RIDE") return "rides";
  if (type === "LOCKER") return "lockers";
  if (type === "COSTUME") return "costumes";
  return "food";
}

function getItemSelection(item: PackageItem): string {
  if (item.itemType === "TICKET") return item.ticketTypeId ?? "";
  if (item.itemType === "RIDE") return item.rideId ?? "";
  if (item.itemType === "LOCKER") return item.lockerId ?? "";
  if (item.itemType === "COSTUME") return item.costumeItemId ?? "";
  return item.foodVariantId ? `${item.foodItemId}__${item.foodVariantId}` : item.foodItemId ?? "";
}

function applyItemSelection(item: PackageItem, value: string, options: OptionSets): PackageItem {
  if (item.itemType === "TICKET") return { ...item, ticketTypeId: value || null };
  if (item.itemType === "RIDE") return { ...item, rideId: value || null };
  if (item.itemType === "LOCKER") return { ...item, lockerId: value || null };
  if (item.itemType === "COSTUME") return { ...item, costumeItemId: value || null };
  const selected = options.food.find((row) => row.id === value);
  return {
    ...item,
    foodItemId: selected?.foodItemId ?? (value || null),
    foodVariantId: selected?.foodVariantId ?? null,
  };
}

function toPayloadItem(item: PackageItem) {
  return {
    itemType: item.itemType,
    ticketTypeId: item.itemType === "TICKET" ? item.ticketTypeId : null,
    rideId: item.itemType === "RIDE" ? item.rideId : null,
    lockerId: item.itemType === "LOCKER" ? item.lockerId : null,
    costumeItemId: item.itemType === "COSTUME" ? item.costumeItemId : null,
    foodItemId: item.itemType === "FOOD" ? item.foodItemId : null,
    foodVariantId: item.itemType === "FOOD" ? item.foodVariantId : null,
    quantity: Number(item.quantity || 1),
  };
}

function PackageModal({
  initial,
  options,
  onClose,
  onSaved,
}: {
  initial?: SalesPackage;
  options: OptionSets;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    ...DEFAULT_PACKAGE,
    ...(initial
      ? {
          name: initial.name,
          description: initial.description ?? "",
          listedPrice: initial.listedPrice,
          salePrice: initial.salePrice,
          gstRate: initial.gstRate,
          sortOrder: initial.sortOrder,
          isActive: initial.isActive,
        }
      : {}),
  });
  const [items, setItems] = useState<PackageItem[]>(
    initial?.items?.length ? initial.items.map((item) => ({ ...item })) : [{ itemType: "TICKET", quantity: 1 }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial);

  function patchItem(index: number, patch: Partial<PackageItem>): void {
    setItems((current) => current.map((item, rowIndex) => (rowIndex === index ? { ...item, ...patch } : item)));
  }

  async function save(): Promise<void> {
    setError(null);
    if (!form.name.trim()) {
      setError("Package name is required.");
      return;
    }
    if (items.some((item) => !getItemSelection(item))) {
      setError("Select an item for every included row.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/v1/packages/${initial!.id}` : "/api/v1/packages", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          description: form.description.trim() || null,
          listedPrice: Number(form.listedPrice),
          salePrice: Number(form.salePrice),
          gstRate: Number(form.gstRate),
          sortOrder: Number(form.sortOrder),
          items: items.map(toPayloadItem),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save package");
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save package");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit Package" : "Create Package"} className="max-w-5xl">
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Package Name *" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input label="Sort Order" type="number" value={String(form.sortOrder)} onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))} />
          <Input label="Listed Price (₹)" type="number" min="0" value={String(form.listedPrice)} onChange={(e) => setForm((p) => ({ ...p, listedPrice: Number(e.target.value) }))} />
          <Input label="Sale Price (₹)" type="number" min="0" value={String(form.salePrice)} onChange={(e) => setForm((p) => ({ ...p, salePrice: Number(e.target.value) }))} />
          <Input label="GST Rate (%)" type="number" min="0" max="100" value={String(form.gstRate)} onChange={(e) => setForm((p) => ({ ...p, gstRate: Number(e.target.value) }))} />
          <Select
            label="Status"
            value={form.isActive ? "active" : "inactive"}
            onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value === "active" }))}
            options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            rows={2}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Included Items</h3>
            <Button size="sm" variant="outline" onClick={() => setItems((p) => [...p, { itemType: "TICKET", quantity: 1 }])}>
              <Plus className="h-4 w-4" />
              Add Included Item
            </Button>
          </div>
          {items.map((item, index) => {
            const list = options[targetKey(item.itemType)];
            return (
              <div key={index} className="grid gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 md:grid-cols-[160px_1fr_120px_44px]">
                <Select
                  label="Type"
                  value={item.itemType}
                  onChange={(e) => patchItem(index, { itemType: e.target.value as ItemType, quantity: item.quantity })}
                  options={[
                    { value: "TICKET", label: "Ticket" },
                    { value: "RIDE", label: "Ride" },
                    { value: "LOCKER", label: "Locker" },
                    { value: "COSTUME", label: "Costume" },
                    { value: "FOOD", label: "Food" },
                  ]}
                />
                <Select
                  label="Included"
                  value={getItemSelection(item)}
                  onChange={(e) => patchItem(index, applyItemSelection(item, e.target.value, options))}
                  options={[{ value: "", label: `Select ${item.itemType.toLowerCase()}` }, ...list.map((row) => ({ value: row.id, label: row.label }))]}
                />
                <Input
                  label="Qty"
                  type="number"
                  min="1"
                  value={String(item.quantity)}
                  onChange={(e) => patchItem(index, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                />
                <button
                  type="button"
                  className="mt-6 flex h-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                  onClick={() => setItems((p) => p.filter((_, rowIndex) => rowIndex !== index))}
                  aria-label="Remove included item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} loading={saving}>{isEdit ? "Save Package" : "Create Package"}</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function AdminPackagesPage(): JSX.Element {
  const { pushToast } = useToast();
  const [packages, setPackages] = useState<SalesPackage[]>([]);
  const [options, setOptions] = useState<OptionSets>({ tickets: [], rides: [], lockers: [], costumes: [], food: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SalesPackage | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgRes, ticketRes, rideRes, lockerRes, costumeRes, foodRes] = await Promise.all([
        fetch("/api/v1/packages"),
        fetch("/api/v1/ticket-types?activeOnly=true"),
        fetch("/api/v1/rides?status=ACTIVE"),
        fetch("/api/v1/lockers?status=AVAILABLE"),
        fetch("/api/v1/costumes/items?availableOnly=true"),
        fetch("/api/v1/food/items?available=true"),
      ]);

      if (pkgRes.ok) setPackages(await pkgRes.json());
      const tickets = ticketRes.ok ? await ticketRes.json() as Array<{ id: string; name: string; price: number }> : [];
      const ridePayload = rideRes.ok ? await rideRes.json() as { items?: Array<{ id: string; name: string; entryFee?: number }> } : {};
      const lockers = lockerRes.ok ? await lockerRes.json() as Array<{ id: string; number: string; rate?: number }> : [];
      const costumes = costumeRes.ok ? await costumeRes.json() as Array<{ id: string; name: string; tagNumber: string; rentalRate?: number }> : [];
      const food = foodRes.ok ? await foodRes.json() as Array<{ id: string; name: string; price: number; variants?: Array<{ id: string; name: string; price: number; isAvailable?: boolean }> }> : [];

      const foodOptions: OptionRow[] = [];
      for (const item of food) {
        foodOptions.push({ id: item.id, foodItemId: item.id, label: `${item.name} - ₹${Number(item.price).toFixed(2)}` });
        for (const variant of item.variants ?? []) {
          if (variant.isAvailable === false) continue;
          foodOptions.push({
            id: `${item.id}__${variant.id}`,
            foodItemId: item.id,
            foodVariantId: variant.id,
            label: `${item.name} / ${variant.name} - ₹${Number(variant.price).toFixed(2)}`,
          });
        }
      }

      setOptions({
        tickets: tickets.map((row) => ({ id: row.id, label: `${row.name} - ₹${Number(row.price).toFixed(2)}` })),
        rides: (ridePayload.items ?? []).map((row) => ({ id: row.id, label: `${row.name} - ₹${Number(row.entryFee ?? 0).toFixed(2)}` })),
        lockers: lockers.map((row) => ({ id: row.id, label: `${row.number} - ₹${Number(row.rate ?? 0).toFixed(2)}` })),
        costumes: costumes.map((row) => ({ id: row.id, label: `${row.name} (${row.tagNumber}) - ₹${Number(row.rentalRate ?? 0).toFixed(2)}` })),
        food: foodOptions,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function removePackage(pkg: SalesPackage): Promise<void> {
    if (!confirm(`Delete package "${pkg.name}"?`)) return;
    const res = await fetch(`/api/v1/packages/${pkg.id}`, { method: "DELETE" });
    if (!res.ok) {
      pushToast({ title: "Delete failed", variant: "error" });
      return;
    }
    pushToast({ title: "Package deleted", variant: "success" });
    await load();
  }

  const columns: DataTableColumn<SalesPackage>[] = [
    {
      key: "name",
      header: "Package",
      render: (row) => (
        <div>
          <p className="font-semibold text-[var(--color-text)]">{row.name}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{row.items.length} included item(s)</p>
        </div>
      ),
    },
    {
      key: "salePrice",
      header: "Price",
      render: (row) => (
        <div>
          <p className="font-semibold text-[var(--color-text)]">₹{row.salePrice.toFixed(2)}</p>
          <p className="text-xs text-[var(--color-text-muted)]">Listed ₹{row.listedPrice.toFixed(2)} + {row.gstRate}% GST</p>
        </div>
      ),
    },
    { key: "isActive", header: "Status", render: (row) => <Badge variant={row.isActive ? "success" : "danger"}>{row.isActive ? "Active" : "Inactive"}</Badge> },
    {
      key: "id",
      header: "Actions",
      render: (row) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => { setEditing(row); setShowModal(true); }}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => void removePackage(row)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages"
        subtitle="Create bundled offers with tickets, rides, lockers, costumes, and food."
        actions={[{
          key: "new-package",
          element: (
            <Button onClick={() => { setEditing(undefined); setShowModal(true); }}>
              <Plus className="h-4 w-4" />
              Add Package
            </Button>
          ),
        }]}
      />

      <Card>
        <CardBody>
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : packages.length === 0 ? (
            <EmptyState icon={PackageIcon} title="No packages" message="Create a package to sell bundled offers from POS." />
          ) : (
            <DataTable columns={columns} data={packages} rowKey={(row) => row.id} />
          )}
        </CardBody>
      </Card>

      {showModal ? (
        <PackageModal
          initial={editing}
          options={options}
          onClose={() => setShowModal(false)}
          onSaved={() => void load()}
        />
      ) : null}
    </div>
  );
}
