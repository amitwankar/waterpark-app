"use client";

import { useEffect, useState } from "react";
import { Lock, Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";

interface LockerZone {
  id: string;
  name: string;
  location: string | null;
  _count: { lockers: number };
}

interface Locker {
  id: string;
  number: string;
  size: "SMALL" | "MEDIUM" | "LARGE";
  rate: number;
  gstRate: number;
  status: "AVAILABLE" | "ASSIGNED" | "RETURNED" | "MAINTENANCE";
  zoneId: string;
  zone: { id: string; name: string };
}

const STATUS_COLORS: Record<Locker["status"], string> = {
  AVAILABLE: "success",
  ASSIGNED: "warning",
  RETURNED: "default",
  MAINTENANCE: "error",
};

export default function AdminLockersPage(): JSX.Element {
  const [zones, setZones] = useState<LockerZone[]>([]);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [zonesError, setZonesError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingLocker, setEditingLocker] = useState<Locker | null>(null);
  const [formZoneId, setFormZoneId] = useState("");
  const [formNumber, setFormNumber] = useState("");
  const [formSize, setFormSize] = useState<"SMALL" | "MEDIUM" | "LARGE">("MEDIUM");
  const [formRate, setFormRate] = useState("299");
  const [formGstRate, setFormGstRate] = useState("18");
  const [formStatus, setFormStatus] = useState<Locker["status"]>("AVAILABLE");
  const [formError, setFormError] = useState<string | null>(null);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [editingZone, setEditingZone] = useState<LockerZone | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zoneLocation, setZoneLocation] = useState("");
  const [zoneError, setZoneError] = useState<string | null>(null);

  async function loadZones() {
    setZonesLoading(true);
    setZonesError(null);
    try {
      const res = await fetch("/api/v1/lockers/zones");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setZonesError(body?.error ?? "Failed to load locker zones.");
        setZones([]);
        return;
      }
      setZones((await res.json()) as LockerZone[]);
    } finally {
      setZonesLoading(false);
    }
  }

  async function loadLockers() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (selectedZone) q.set("zoneId", selectedZone);
      if (selectedStatus) q.set("status", selectedStatus);
      const res = await fetch(`/api/v1/lockers?${q.toString()}`);
      if (res.ok) {
        const payload = (await res.json()) as Array<Locker & { rate: number | string; gstRate?: number | string }>;
        setLockers(
          payload.map((locker) => ({
            ...locker,
            rate: Number(locker.rate),
            gstRate: Number(locker.gstRate ?? 18),
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(lockerId: string, status: Locker["status"]) {
    await fetch(`/api/v1/lockers/${lockerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadLockers();
  }

  async function saveLocker(): Promise<void> {
    if (!formZoneId) {
      setFormError("Please select a zone.");
      return;
    }
    if (!formNumber.trim()) {
      setFormError("Locker number is required.");
      return;
    }
    setFormError(null);

    const payload = {
      zoneId: formZoneId,
      number: formNumber.trim(),
      size: formSize,
      rate: Math.max(1, Number(formRate || "299")),
      gstRate: Math.max(0, Number(formGstRate || "18")),
      status: formStatus,
    };
    const url = editingLocker ? `/api/v1/lockers/${editingLocker.id}` : "/api/v1/lockers";
    const method = editingLocker ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setFormError(body?.error ?? "Failed to save locker");
      return;
    }

    setShowForm(false);
    setEditingLocker(null);
    await loadLockers();
  }

  async function removeLocker(lockerId: string): Promise<void> {
    if (!confirm("Delete this locker from active inventory?")) return;
    await fetch(`/api/v1/lockers/${lockerId}`, { method: "DELETE" });
    await loadLockers();
  }

  function openCreate(): void {
    if (zones.length === 0) {
      setFormError("No locker zones found. Please add a zone first.");
      return;
    }
    setEditingLocker(null);
    setFormError(null);
    setFormZoneId(zones[0]?.id ?? "");
    setFormNumber("");
    setFormSize("MEDIUM");
    setFormRate("299");
    setFormGstRate("18");
    setFormStatus("AVAILABLE");
    setShowForm(true);
  }

  function openEdit(locker: Locker): void {
    setEditingLocker(locker);
    setFormError(null);
    setFormZoneId(locker.zoneId);
    setFormNumber(locker.number);
    setFormSize(locker.size);
    setFormRate(String(locker.rate));
    setFormGstRate(String(locker.gstRate ?? 18));
    setFormStatus(locker.status);
    setShowForm(true);
  }

  function openCreateZone(): void {
    setEditingZone(null);
    setZoneName("");
    setZoneLocation("");
    setZoneError(null);
    setShowZoneForm(true);
  }

  function openEditZone(zone: LockerZone): void {
    setEditingZone(zone);
    setZoneName(zone.name);
    setZoneLocation(zone.location ?? "");
    setZoneError(null);
    setShowZoneForm(true);
  }

  async function saveZone(): Promise<void> {
    if (!zoneName.trim()) {
      setZoneError("Zone name is required.");
      return;
    }
    const url = editingZone ? `/api/v1/lockers/zones/${editingZone.id}` : "/api/v1/lockers/zones";
    const method = editingZone ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: zoneName.trim(),
        location: zoneLocation.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setZoneError(body?.error ?? "Failed to save zone.");
      return;
    }
    setShowZoneForm(false);
    setEditingZone(null);
    await loadZones();
    if (!formZoneId) {
      const fresh = await fetch("/api/v1/lockers/zones").then((r) => r.json() as Promise<LockerZone[]>).catch(() => []);
      setFormZoneId(fresh[0]?.id ?? "");
    }
  }

  async function deleteZone(id: string): Promise<void> {
    if (!confirm("Delete this zone?")) return;
    const res = await fetch(`/api/v1/lockers/zones/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setZonesError(body?.error ?? "Failed to delete zone.");
      return;
    }
    await loadZones();
  }

  useEffect(() => {
    void loadZones();
  }, []);

  useEffect(() => {
    if (showForm && !formZoneId && zones.length > 0) {
      setFormZoneId(zones[0].id);
    }
  }, [showForm, formZoneId, zones]);

  useEffect(() => {
    void loadLockers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZone, selectedStatus]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadLockers();
    }, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZone, selectedStatus]);

  const counts = {
    AVAILABLE: lockers.filter((l) => l.status === "AVAILABLE").length,
    ASSIGNED: lockers.filter((l) => l.status === "ASSIGNED").length,
    RETURNED: lockers.filter((l) => l.status === "RETURNED").length,
    MAINTENANCE: lockers.filter((l) => l.status === "MAINTENANCE").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locker Management"
        subtitle="Track locker availability and assignments across all zones."
        actions={[
          {
            key: "add-locker",
            element: (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Locker
              </Button>
            ),
          },
        ]}
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["AVAILABLE", "ASSIGNED", "RETURNED", "MAINTENANCE"] as const).map((s) => (
          <div
            key={s}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center"
          >
            <p className="text-2xl font-bold text-[var(--color-text)]">{counts[s]}</p>
            <p className="text-xs text-[var(--color-muted)] capitalize">{s.toLowerCase().replace("_", " ")}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <Select
          value={selectedZone}
          onChange={(e) => setSelectedZone(e.target.value)}
          options={[
            { label: "All Zones", value: "" },
            ...zones.map((z) => ({ label: z.name, value: z.id })),
          ]}
        />
        <Select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          options={[
            { label: "All Status", value: "" },
            { label: "Available", value: "AVAILABLE" },
            { label: "Assigned", value: "ASSIGNED" },
            { label: "Returned", value: "RETURNED" },
            { label: "Maintenance", value: "MAINTENANCE" },
          ]}
        />
        <Button variant="outline" onClick={openCreateZone}>
          <Plus className="mr-2 h-4 w-4" />
          Add Zone
        </Button>
        {zonesError ? <p className="w-full text-sm text-red-500">{zonesError}</p> : null}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <p className="mb-3 text-sm font-medium text-[var(--color-text)]">Locker Zones</p>
        {zonesLoading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading zones...</p>
        ) : zones.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No zones found. Add a locker zone to enable locker creation.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {zones.map((zone) => (
              <div key={zone.id} className="inline-flex items-center gap-2 rounded border border-[var(--color-border)] px-2 py-1 text-xs">
                <span>{zone.name}</span>
                <span className="text-[var(--color-muted)]">({zone._count.lockers})</span>
                <button type="button" className="text-[var(--color-primary)]" onClick={() => openEditZone(zone)}>Edit</button>
                <button type="button" className="text-red-500" onClick={() => void deleteZone(zone.id)}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : lockers.length === 0 ? (
        <EmptyState icon={Lock} title="No lockers found" message="Try adjusting filters or add lockers." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {lockers.map((locker) => (
            <div
              key={locker.id}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--color-text)]">{locker.number}</span>
                <Badge variant={STATUS_COLORS[locker.status] as never}>
                  {locker.status}
                </Badge>
              </div>
              <p className="text-xs text-[var(--color-muted)]">
                {locker.zone.name} · {locker.size}
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                Rate: ₹{locker.rate.toFixed(2)} · GST {locker.gstRate?.toFixed(1) ?? "18"}%
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(locker)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void removeLocker(locker.id)}>
                  Delete
                </Button>
              </div>
              {locker.status === "RETURNED" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => void updateStatus(locker.id, "AVAILABLE")}
                >
                  Mark Available
                </Button>
              )}
              {locker.status === "AVAILABLE" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => void updateStatus(locker.id, "MAINTENANCE")}
                >
                  Set Maintenance
                </Button>
              )}
              {locker.status === "MAINTENANCE" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => void updateStatus(locker.id, "AVAILABLE")}
                >
                  Mark Available
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {showForm ? (
        <Modal
          open
          title={editingLocker ? "Edit Locker" : "Add Locker"}
          onClose={() => {
            setShowForm(false);
            setEditingLocker(null);
          }}
        >
          <div className="space-y-3">
            <Select
              label="Zone"
              value={formZoneId}
              onChange={(event) => setFormZoneId(event.target.value)}
              placeholder="Select zone"
              options={zones.map((zone) => ({ label: zone.name, value: zone.id }))}
            />
            <Input label="Locker Number" value={formNumber} onChange={(event) => setFormNumber(event.target.value)} />
            <Select
              label="Size"
              value={formSize}
              onChange={(event) => setFormSize(event.target.value as "SMALL" | "MEDIUM" | "LARGE")}
              options={[
                { label: "Small", value: "SMALL" },
                { label: "Medium", value: "MEDIUM" },
                { label: "Large", value: "LARGE" },
              ]}
            />
            <Input
              label="Locker Price"
              type="number"
              min={1}
              value={formRate}
              onChange={(event) => setFormRate(event.target.value)}
            />
            <Input
              label="GST Rate (%)"
              type="number"
              min={0}
              max={100}
              value={formGstRate}
              onChange={(event) => setFormGstRate(event.target.value)}
            />
            <Select
              label="Status"
              value={formStatus}
              onChange={(event) => setFormStatus(event.target.value as Locker["status"])}
              options={[
                { label: "Available", value: "AVAILABLE" },
                { label: "Assigned", value: "ASSIGNED" },
                { label: "Returned", value: "RETURNED" },
                { label: "Maintenance", value: "MAINTENANCE" },
              ]}
            />
            {formError ? <p className="text-sm text-red-500">{formError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={() => void saveLocker()}>{editingLocker ? "Update" : "Create"}</Button>
            </div>
          </div>
        </Modal>
      ) : null}
      {showZoneForm ? (
        <Modal
          open
          title={editingZone ? "Edit Locker Zone" : "Add Locker Zone"}
          onClose={() => {
            setShowZoneForm(false);
            setEditingZone(null);
          }}
        >
          <div className="space-y-3">
            <Input label="Zone Name" value={zoneName} onChange={(event) => setZoneName(event.target.value)} />
            <Input label="Location" value={zoneLocation} onChange={(event) => setZoneLocation(event.target.value)} />
            {zoneError ? <p className="text-sm text-red-500">{zoneError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowZoneForm(false)}>Cancel</Button>
              <Button onClick={() => void saveZone()}>{editingZone ? "Update Zone" : "Create Zone"}</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
