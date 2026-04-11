"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Plus, RefreshCw, Tag } from "lucide-react";

import { CostumeCategoryModal } from "@/components/costumes/CostumeCategoryModal";
import { CostumeItemModal } from "@/components/costumes/CostumeItemModal";
import { CostumeStatusBadge } from "@/components/costumes/CostumeStatusBadge";
import { DataTable, type DataTableColumn } from "@/components/layout/DataTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/components/feedback/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";

type CostumeStatus = "AVAILABLE" | "RENTED" | "RETURNED" | "MAINTENANCE";

interface CostumeItem {
  id: string;
  stockCode?: string | null;
  tagNumber: string;
  name: string;
  size: string;
  status: CostumeStatus;
  rentalRate: number;
  gstRate: number;
  availableQuantity?: number;
  notes: string | null;
  categoryId: string;
  category: { id: string; name: string };
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  _count: { items: number };
}

type Tab = "items" | "categories" | "rentals";

interface ActiveRental {
  id: string;
  guestName: string;
  guestMobile: string | null;
  rentedAt: string;
  dueAt: string;
  rentalAmount: number;
  depositPaid: boolean;
  costumeItem: { tagNumber: string; name: string; category: { name: string } };
  rentedBy: { name: string };
}

interface GroupedCostumeItem extends CostumeItem {
  unitIds: string[];
}

function normalizeTagBase(tagNumber: string): string {
  return tagNumber.trim().toUpperCase().replace(/-\d{3}$/i, "");
}

function getProductGroupKey(item: CostumeItem): string {
  if (item.stockCode && item.stockCode.trim().length > 0) {
    return `stock:${item.stockCode}`;
  }
  const baseTag = normalizeTagBase(item.tagNumber);
  return [
    "legacy",
    item.categoryId,
    item.name.trim().toLowerCase(),
    item.size,
    Number(item.rentalRate).toFixed(2),
    Number(item.gstRate).toFixed(2),
    baseTag,
  ].join("|");
}

const ITEM_COLUMNS: DataTableColumn<GroupedCostumeItem>[] = [
  { key: "tagNumber", header: "Tag #", render: (r) => <span className="font-mono font-semibold text-sm text-[var(--color-text)]">{r.tagNumber}</span> },
  { key: "name", header: "Name / Category", render: (r) => (
    <div>
      <p className="font-medium text-[var(--color-text)] text-sm">{r.name}</p>
      <p className="text-xs text-[var(--color-text-muted)]">{r.category.name} · {r.size}</p>
    </div>
  )},
  { key: "status", header: "Status", render: (r) => <CostumeStatusBadge status={r.status} /> },
  { key: "availableQuantity", header: "Available Qty", render: (r) => <span className="text-sm text-[var(--color-text-muted)]">{r.availableQuantity ?? 0}</span> },
  { key: "rentalRate", header: "Rental", render: (r) => <span className="text-sm font-medium">₹{Number(r.rentalRate).toFixed(2)}</span> },
  { key: "gstRate", header: "GST", render: (r) => <span className="text-xs text-[var(--color-text-muted)]">{Number(r.gstRate)}%</span> },
];

export default function AdminCostumesPage() {
  const { pushToast } = useToast();
  const [tab, setTab] = useState<Tab>("items");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<CostumeItem[]>([]);
  const [rentals, setRentals] = useState<ActiveRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [catFilter, setCatFilter] = useState<string>("ALL");

  const [showCatModal, setShowCatModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | undefined>(undefined);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState<CostumeItem | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, itemRes, rentalRes] = await Promise.all([
        fetch("/api/v1/costumes/categories"),
        fetch("/api/v1/costumes/items"),
        fetch("/api/v1/costumes/rentals?active=true"),
      ]);
      if (catRes.ok) setCategories(await catRes.json());
      if (itemRes.ok) setItems(await itemRes.json());
      if (rentalRes.ok) {
        const d = await rentalRes.json();
        setRentals(d.items ?? d);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      void load();
    }, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.tagNumber.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "ALL" || item.status === statusFilter;
      const matchCat = catFilter === "ALL" || item.categoryId === catFilter;
      return matchSearch && matchStatus && matchCat;
    });
  }, [items, search, statusFilter, catFilter]);

  const groupedFilteredItems = useMemo<GroupedCostumeItem[]>(() => {
    const groups = new Map<string, CostumeItem[]>();
    for (const item of filteredItems) {
      const key = getProductGroupKey(item);
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return Array.from(groups.values()).map((group) => {
      const first = group[0]!;
      const available = group.filter((row) => row.status === "AVAILABLE").length;
      const rented = group.filter((row) => row.status === "RENTED").length;
      const returned = group.filter((row) => row.status === "RETURNED").length;
      const maintenance = group.filter((row) => row.status === "MAINTENANCE").length;
      const derivedStatus: CostumeStatus =
        available > 0 ? "AVAILABLE" : rented > 0 ? "RENTED" : returned > 0 ? "RETURNED" : maintenance > 0 ? "MAINTENANCE" : first.status;
      return {
        ...first,
        tagNumber: normalizeTagBase(first.tagNumber),
        status: derivedStatus,
        availableQuantity: available,
        unitIds: group.map((row) => row.id),
      };
    });
  }, [filteredItems]);

  const categoryUniqueCounts = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of items) {
      const set = map.get(item.categoryId) ?? new Set<string>();
      set.add(getProductGroupKey(item));
      map.set(item.categoryId, set);
    }
    const counts = new Map<string, number>();
    for (const [categoryId, groupedKeys] of map.entries()) {
      counts.set(categoryId, groupedKeys.size);
    }
    return counts;
  }, [items]);

  async function handleMarkAvailable(itemId: string, tagNumber: string) {
    try {
      const res = await fetch(`/api/v1/costumes/items/${itemId}/mark-available`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      pushToast({ title: `${tagNumber} marked as Available`, variant: "success" });
      load();
    } catch (e: unknown) {
      pushToast({ title: e instanceof Error ? e.message : "Failed", variant: "error" });
    }
  }

  async function handleDeleteCat(id: string) {
    if (!confirm("Deactivate this category?")) return;
    await fetch(`/api/v1/costumes/categories/${id}`, { method: "DELETE" });
    load();
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { AVAILABLE: 0, RENTED: 0, RETURNED: 0, MAINTENANCE: 0 };
    items.forEach((i) => { counts[i.status] = (counts[i.status] ?? 0) + 1; });
    return counts;
  }, [items]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Costume Rental"
        subtitle="Manage costume inventory and active rentals"
        actions={[
          {
            key: "refresh",
            element: (
              <Button variant="ghost" onClick={load}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            ),
          },
          ...(tab === "categories"
            ? [{
                key: "new-category",
                element: (
                  <Button onClick={() => { setEditCat(undefined); setShowCatModal(true); }}>
                    <Plus className="h-4 w-4" />
                    New Category
                  </Button>
                ),
              }]
            : tab === "items"
              ? [{
                  key: "new-item",
                  element: (
                    <Button onClick={() => { setEditItem(undefined); setShowItemModal(true); }}>
                      <Plus className="h-4 w-4" />
                      Add Costume
                    </Button>
                  ),
                }]
              : []),
        ]}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Available", count: statusCounts.AVAILABLE, color: "text-emerald-700 bg-emerald-100/80 dark:text-emerald-300 dark:bg-emerald-950/40" },
          { label: "Rented", count: statusCounts.RENTED, color: "text-amber-700 bg-amber-100/80 dark:text-amber-300 dark:bg-amber-950/40" },
          { label: "Returned", count: statusCounts.RETURNED, color: "text-blue-700 bg-blue-100/80 dark:text-blue-300 dark:bg-blue-950/40" },
          { label: "Maintenance", count: statusCounts.MAINTENANCE, color: "text-rose-700 bg-rose-100/80 dark:text-rose-300 dark:bg-rose-950/40" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-sm font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--color-border)] flex gap-6">
        {(["items", "categories", "rentals"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-teal-500 text-teal-400" : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {t === "items" ? `Inventory (${new Set(items.map((item) => getProductGroupKey(item))).size})` : t === "categories" ? `Categories (${categories.length})` : `Active Rentals (${rentals.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : tab === "items" ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Search tag or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              options={[{ value: "ALL", label: "All Categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "ALL", label: "All Statuses" },
                { value: "AVAILABLE", label: "Available" },
                { value: "RENTED", label: "Rented" },
                { value: "RETURNED", label: "Returned" },
                { value: "MAINTENANCE", label: "Maintenance" },
              ]}
            />
          </div>

          {groupedFilteredItems.length === 0 ? (
            <EmptyState icon={Package} title="No costumes found" message="Add your first costume using the button above." />
          ) : (
            <DataTable
              columns={[
                ...ITEM_COLUMNS,
                {
                  key: "id",
                  header: "Actions",
                  render: (r) => (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditItem(r); setShowItemModal(true); }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm("Delete this costume item from active inventory?")) return;
                          const targets = r.unitIds.length > 0 ? r.unitIds : [r.id];
                          for (const targetId of targets) {
                            // delete all units in the grouped product view
                            await fetch(`/api/v1/costumes/items/${targetId}`, { method: "DELETE" });
                          }
                          await load();
                        }}
                      >
                        Delete
                      </Button>
                      {(r.status === "RETURNED" || r.status === "MAINTENANCE") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMarkAvailable(r.id, r.tagNumber)}
                        >
                          Mark Available
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
              data={groupedFilteredItems}
            />
          )}
        </div>
      ) : tab === "categories" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {categories.length === 0 ? (
            <EmptyState icon={Tag} title="No categories" message="Create your first costume category." />
          ) : (
            categories.map((cat) => (
              <div key={cat.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
                {cat.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cat.imageUrl} alt={cat.name} className="w-full h-32 object-cover rounded-lg mb-3" />
                )}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-[var(--color-text)]">{cat.name}</p>
                    {cat.description && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{cat.description}</p>}
                    <Badge variant="info" className="mt-1">{categoryUniqueCounts.get(cat.id) ?? 0} items</Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setEditCat(cat); setShowCatModal(true); }}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDeleteCat(cat.id)}>Remove</Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Active Rentals */
        <div>
          {rentals.length === 0 ? (
            <EmptyState icon={Package} title="No active rentals" message="All costumes are accounted for." />
          ) : (
            <div className="space-y-3">
              {rentals.map((r) => {
                const isOverdue = new Date(r.dueAt) < new Date();
                return (
                  <div key={r.id} className={`bg-[var(--color-surface)] border rounded-xl p-4 flex items-start justify-between gap-4 ${isOverdue ? "border-rose-500/40 bg-rose-950/15" : "border-[var(--color-border)]"}`}>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-sm">{r.costumeItem.tagNumber}</span>
                        <span className="text-[var(--color-text-muted)] text-sm">{r.costumeItem.name}</span>
                        <Badge variant="info">{r.costumeItem.category.name}</Badge>
                        {isOverdue && <Badge variant="danger">OVERDUE</Badge>}
                      </div>
                      <p className="text-sm text-[var(--color-text)] mt-1">{r.guestName}{r.guestMobile ? ` · ${r.guestMobile}` : ""}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        Rented: {new Date(r.rentedAt).toLocaleTimeString()} · Due: {new Date(r.dueAt).toLocaleTimeString()} · By: {r.rentedBy.name}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">₹{Number(r.rentalAmount).toFixed(2)}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{r.depositPaid ? "Deposit paid" : "No deposit"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showCatModal && (
        <CostumeCategoryModal
          initial={editCat}
          onClose={() => setShowCatModal(false)}
          onSaved={load}
        />
      )}

      {showItemModal && (
        <CostumeItemModal
          categories={categories}
          initial={editItem as never}
          onClose={() => setShowItemModal(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
