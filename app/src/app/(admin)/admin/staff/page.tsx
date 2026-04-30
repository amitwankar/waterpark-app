"use client";

import { useEffect, useMemo, useState } from "react";
import { UserPlus, Users } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/layout/DataTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { AddStaffModal } from "@/components/staff/AddStaffModal";
import { EditStaffModal } from "@/components/staff/EditStaffModal";

interface StaffMember {
  id: string;
  name: string;
  role: "ADMIN" | "EMPLOYEE";
  mobile: string;
  email: string | null;
  subRole: string | null;
  isActive: boolean;
  staffProfile: {
    employeeCode: string;
    department: string | null;
    joiningDate: string;
  } | null;
}

const SUB_ROLE_LABELS: Record<string, string> = {
  TICKET_COUNTER: "Ticket Counter",
  FB_STAFF: "F&B Staff",
  RIDE_OPERATOR: "Ride Operator",
  MAINTENANCE_TECH: "Maintenance",
  LOCKER_ATTENDANT: "Locker",
  PARKING_ATTENDANT: "Parking",
  SALES_EXECUTIVE: "Sales",
  SECURITY_STAFF: "Security",
  EVENT_COORDINATOR: "Events",
};

export default function AdminStaffPage(): JSX.Element {
  const { pushToast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [subRole, setSubRole] = useState("");
  const [isActive, setIsActive] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (role) q.set("role", role);
      if (subRole) q.set("subRole", subRole);
      if (isActive) q.set("isActive", isActive);
      if (search.trim()) q.set("q", search.trim());
      const res = await fetch(`/api/v1/staff?${q.toString()}`);
      if (res.ok) setStaff((await res.json()) as StaffMember[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, subRole, isActive]);

  const columns = useMemo<Array<DataTableColumn<StaffMember>>>(
    () => [
      {
        key: "name",
        header: "Staff Member",
        render: (row) => (
          <div>
            <p className="font-medium text-[var(--color-text)]">{row.name}</p>
            <p className="text-xs text-[var(--color-muted)]">{row.mobile}</p>
          </div>
        ),
      },
      {
        key: "code",
        header: "Employee Code",
        render: (row) => (
          <span className="font-mono text-sm">{row.staffProfile?.employeeCode ?? "—"}</span>
        ),
      },
      {
        key: "role",
        header: "Role",
        render: (row) => (
          <span className="text-sm">
            {row.role === "ADMIN" ? "Admin" : row.subRole ? (SUB_ROLE_LABELS[row.subRole] ?? row.subRole) : "Employee"}
          </span>
        ),
      },
      {
        key: "department",
        header: "Department",
        render: (row) => row.staffProfile?.department ?? "—",
      },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <Badge variant={row.isActive ? "success" : "default"}>
            {row.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        key: "actions",
        header: "",
        render: (row) => (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const res = await fetch(`/api/v1/staff/${row.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isActive: !row.isActive }),
                  });
                  if (!res.ok) throw new Error("Status update failed");
                  pushToast({ title: row.isActive ? "Staff deactivated" : "Staff activated", variant: "success" });
                  await load();
                } catch {
                  pushToast({ title: "Status update failed", variant: "error" });
                }
              }}
            >
              {row.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              onClick={async () => {
                const ok = window.confirm(`Delete ${row.name} permanently? This removes the staff record from the database.`);
                if (!ok) return;
                try {
                  const res = await fetch(`/api/v1/staff/${row.id}`, { method: "DELETE" });
                  if (!res.ok) {
                    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
                    throw new Error(payload?.error ?? "Delete failed");
                  }
                  pushToast({ title: "Staff deleted permanently", variant: "success" });
                  await load();
                } catch (error) {
                  pushToast({
                    title: "Delete failed",
                    message: error instanceof Error ? error.message : "Could not delete staff",
                    variant: "error",
                  });
                }
              }}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff Management"
        subtitle="Manage employees, roles, and shift assignments."
        actions={[
          {
            key: "add-staff",
            element: (
              <Button onClick={() => setShowAdd(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Staff
              </Button>
            ),
          },
        ]}
      />

      <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-[1fr_170px_200px_180px_auto]">
        <Input
          placeholder="Search by name, mobile, or code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          options={[
            { label: "All Users", value: "" },
            { label: "Admin", value: "ADMIN" },
            { label: "Employee", value: "EMPLOYEE" },
          ]}
        />
        <Select
          value={subRole}
          onChange={(e) => setSubRole(e.target.value)}
          options={[
            { label: "All Roles", value: "" },
            ...Object.entries(SUB_ROLE_LABELS).map(([v, l]) => ({ label: l, value: v })),
          ]}
        />
        <Select
          value={isActive}
          onChange={(e) => setIsActive(e.target.value)}
          options={[
            { label: "All Status", value: "" },
            { label: "Active", value: "true" },
            { label: "Inactive", value: "false" },
          ]}
        />
        <Button variant="outline" onClick={() => void load()}>
          Search
        </Button>
      </div>

      {staff.length === 0 && !loading ? (
        <EmptyState icon={Users} title="No staff found" message="Add your first staff member to get started." />
      ) : (
        <DataTable
          data={staff}
          columns={columns}
          loading={loading}
          rowKey={(row) => row.id}
          emptyTitle="No staff found"
          emptyMessage="Adjust filters or add a new staff member."
        />
      )}

      {showAdd && (
        <AddStaffModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); void load(); }}
        />
      )}

      {editing && (
        <EditStaffModal
          staff={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
