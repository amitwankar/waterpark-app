"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/layout/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface ZoneItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  activeRideCount: number;
  rideCount: number;
}

interface ZonesResponse {
  items: ZoneItem[];
}

export default function AdminZonesPage(): JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ZoneItem[]>([]);
  const [newName, setNewName] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("0");
  const [editingZone, setEditingZone] = useState<ZoneItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  async function loadZones(): Promise<void> {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/zones", { method: "GET" });
      const payload = (await response.json().catch(() => ({ items: [] }))) as ZonesResponse;
      if (response.ok) {
        setItems(payload.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadZones();
  }, []);

  function openEdit(zone: ZoneItem): void {
    setEditingZone(zone);
    setEditName(zone.name);
    setEditDescription(zone.description ?? "");
    setEditSortOrder(String(zone.sortOrder));
    setEditIsActive(zone.isActive);
    setEditError(null);
  }

  function closeEdit(): void {
    setEditingZone(null);
    setEditError(null);
  }

  async function saveEdit(): Promise<void> {
    if (!editingZone) return;
    if (!editName.trim()) {
      setEditError("Zone name is required.");
      return;
    }
    setEditError(null);
    const res = await fetch(`/api/v1/zones/${editingZone.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        description: editDescription.trim() || null,
        sortOrder: Number(editSortOrder || "0"),
        isActive: editIsActive,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setEditError(body?.message ?? "Failed to update zone.");
      return;
    }
    closeEdit();
    await loadZones();
  }

  const columns = useMemo<Array<DataTableColumn<ZoneItem>>>(
    () => [
      {
        key: "name",
        header: "Zone",
        render: (row) => (
          <div>
            <p className="font-medium text-[var(--color-text)]">{row.name}</p>
            {row.description ? <p className="text-xs text-[var(--color-text-muted)]">{row.description}</p> : null}
          </div>
        ),
      },
      {
        key: "activeRideCount",
        header: "Active Rides",
        render: (row) => String(row.activeRideCount),
      },
      {
        key: "rideCount",
        header: "Total Rides",
        render: (row) => String(row.rideCount),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={row.isActive ? "success" : "danger"}>{row.isActive ? "ACTIVE" : "INACTIVE"}</Badge>,
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openEdit(row)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                startTransition(() => {
                  void fetch(`/api/v1/zones/${row.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isActive: !row.isActive }),
                  }).then(() => loadZones());
                });
              }}
              loading={isPending}
            >
              {row.isActive ? "Disable" : "Enable"}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                startTransition(() => {
                  void fetch(`/api/v1/zones/${row.id}`, { method: "DELETE" }).then(() => loadZones());
                });
              }}
              loading={isPending}
              disabled={row.rideCount > 0}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [isPending],
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Zones" subtitle="Manage park zones and active status." />

      <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-[1fr_140px_auto]">
        <Input
          label="Zone name"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="e.g. Thrill Zone"
        />
        <Input
          label="Sort"
          type="number"
          value={newSortOrder}
          onChange={(event) => setNewSortOrder(event.target.value)}
        />
        <div className="flex items-end">
          <Button
            className="w-full"
            loading={isPending}
            onClick={() => {
              if (!newName.trim()) return;
              startTransition(() => {
                void fetch("/api/v1/zones", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: newName.trim(), sortOrder: Number(newSortOrder || "0") }),
                }).then(() => {
                  setNewName("");
                  setNewSortOrder("0");
                  loadZones();
                });
              });
            }}
          >
            <Plus className="h-4 w-4" />
            Add Zone
          </Button>
        </div>
      </div>

      <DataTable
        data={items}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle="No zones"
        emptyMessage="Create a zone to start assigning rides."
      />

      {editingZone ? (
        <Modal open title="Edit Zone" onClose={closeEdit}>
          <div className="space-y-3">
            <Input
              label="Zone name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Description</label>
              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={3}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>
            <Input
              label="Sort order"
              type="number"
              value={editSortOrder}
              onChange={(event) => setEditSortOrder(event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={editIsActive}
                onChange={(event) => setEditIsActive(event.target.checked)}
              />
              Active zone
            </label>
            {editError ? <p className="text-sm text-red-500">{editError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeEdit}>Cancel</Button>
              <Button onClick={() => void saveEdit()}>Save Changes</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
