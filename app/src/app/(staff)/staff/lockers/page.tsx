"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LockerAssignModal } from "@/components/staff/LockerAssignModal";
import { LockerReleaseModal } from "@/components/staff/LockerReleaseModal";

interface LockerZone { id: string; name: string }
interface Locker {
  id: string;
  number: string;
  size: "SMALL" | "MEDIUM" | "LARGE";
  rate?: number;
  status: "AVAILABLE" | "ASSIGNED" | "RETURNED" | "MAINTENANCE";
  zone: { id: string; name: string };
  assignments: Array<{
    id: string;
    guestName: string;
    guestMobile: string;
    dueAt: string;
    assignedAt: string;
  }>;
}

const STATUS_COLORS: Record<Locker["status"], string> = {
  AVAILABLE: "success",
  ASSIGNED: "warning",
  RETURNED: "default",
  MAINTENANCE: "error",
};

export default function StaffLockersPage(): JSX.Element {
  const [zones, setZones] = useState<LockerZone[]>([]);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState("");
  const [assignTarget, setAssignTarget] = useState<Locker | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<Locker | null>(null);

  async function loadZones() {
    const res = await fetch("/api/v1/lockers/zones");
    if (res.ok) setZones((await res.json()) as LockerZone[]);
  }

  async function loadLockers() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (selectedZone) q.set("zoneId", selectedZone);
      const res = await fetch(`/api/v1/lockers?${q.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as Locker[];
        const visible = data.filter((locker) => locker.status !== "MAINTENANCE");
        // Fetch active assignment for ASSIGNED lockers
        const enriched = await Promise.all(
          visible.map(async (l) => {
            if (l.status !== "ASSIGNED") return { ...l, assignments: [] };
            const aRes = await fetch(`/api/v1/lockers/${l.id}`);
            if (!aRes.ok) return { ...l, assignments: [] };
            const detail = (await aRes.json()) as Locker;
            return { ...l, assignments: detail.assignments };
          })
        );
        setLockers(enriched);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadZones(); }, []);
  useEffect(() => { void loadLockers(); }, [selectedZone]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <PageHeader title="Lockers" subtitle="Assign and release lockers for guests." />

      <div className="flex gap-3">
        <Select
          value={selectedZone}
          onChange={(e) => setSelectedZone(e.target.value)}
          options={[
            { label: "All Zones", value: "" },
            ...zones.map((z) => ({ label: z.name, value: z.id })),
          ]}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : lockers.length === 0 ? (
        <EmptyState icon={Lock} title="No lockers found" message="No lockers match the current filter." />
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

              {locker.status === "ASSIGNED" && locker.assignments[0] && (
                <div className="text-xs text-[var(--color-muted)] space-y-0.5">
                  <p className="font-medium text-[var(--color-text)]">{locker.assignments[0].guestName}</p>
                  <p>{locker.assignments[0].guestMobile}</p>
                  <p>Due: {new Date(locker.assignments[0].dueAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              )}

              {locker.status === "AVAILABLE" && (
                <Button size="sm" className="w-full" onClick={() => setAssignTarget(locker)}>
                  Assign
                </Button>
              )}
              {locker.status === "ASSIGNED" && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => setReleaseTarget(locker)}>
                  Release
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {assignTarget && (
        <LockerAssignModal
          locker={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={() => { setAssignTarget(null); void loadLockers(); }}
        />
      )}

      {releaseTarget && (
        <LockerReleaseModal
          locker={releaseTarget}
          onClose={() => setReleaseTarget(null)}
          onReleased={() => { setReleaseTarget(null); void loadLockers(); }}
        />
      )}
    </div>
  );
}
