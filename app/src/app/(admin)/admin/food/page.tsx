"use client";

import { useEffect, useState } from "react";
import { Plus, ToggleLeft, ToggleRight, Utensils } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { OutletFormModal } from "@/components/food/OutletFormModal";
import { MenuDrawer } from "@/components/food/MenuDrawer";

interface Outlet {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  isOpen: boolean;
  isActive: boolean;
  sortOrder: number;
  _count: { categories: number; orders: number };
}

export default function AdminFoodPage(): JSX.Element {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Outlet | null>(null);
  const [menuTarget, setMenuTarget] = useState<Outlet | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/food/outlets");
      if (res.ok) setOutlets((await res.json()) as Outlet[]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleOpen(outlet: Outlet) {
    await fetch(`/api/v1/food/outlets/${outlet.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: !outlet.isOpen }),
    });
    await load();
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this outlet? It will be hidden from all views.")) return;
    await fetch(`/api/v1/food/outlets/${id}`, { method: "DELETE" });
    await load();
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Food & Beverage"
        subtitle="Manage outlets, menus, and live orders."
        actions={[
          {
            key: "new-outlet",
            element: (
              <Button onClick={() => { setEditTarget(null); setShowForm(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                New Outlet
              </Button>
            ),
          },
        ]}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : outlets.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title="No outlets yet"
          message="Create your first food outlet to start managing menus and orders."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {outlets.map((outlet) => (
            <div
              key={outlet.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-[var(--color-text)]">{outlet.name}</h3>
                  {outlet.location && (
                    <p className="text-xs text-[var(--color-muted)]">{outlet.location}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void toggleOpen(outlet)}
                  title={outlet.isOpen ? "Click to close" : "Click to open"}
                  className="shrink-0"
                >
                  {outlet.isOpen ? (
                    <ToggleRight className="h-6 w-6 text-[var(--color-primary)]" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-[var(--color-muted)]" />
                  )}
                </button>
              </div>

              <div className="flex gap-2 text-xs">
                <Badge variant={outlet.isOpen ? "success" : "default"}>
                  {outlet.isOpen ? "Open" : "Closed"}
                </Badge>
                <span className="text-[var(--color-muted)]">
                  {outlet._count.categories} categories · {outlet._count.orders} orders
                </span>
              </div>

              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setMenuTarget(outlet)}>
                  Menu
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditTarget(outlet); setShowForm(true); }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-red-500 hover:text-red-600"
                  onClick={() => void deactivate(outlet.id)}
                >
                  Deactivate
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <OutletFormModal
          outlet={editTarget}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(); }}
        />
      )}

      {menuTarget && (
        <MenuDrawer
          outlet={menuTarget}
          onClose={() => setMenuTarget(null)}
        />
      )}
    </div>
  );
}
