"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const SUB_ROLES = [
  { label: "Ticket Counter", value: "TICKET_COUNTER" },
  { label: "F&B Staff", value: "FB_STAFF" },
  { label: "Ride Operator", value: "RIDE_OPERATOR" },
  { label: "Maintenance Tech", value: "MAINTENANCE_TECH" },
  { label: "Locker Attendant", value: "LOCKER_ATTENDANT" },
  { label: "Costume Attendant", value: "COSTUME_ATTENDANT" },
  { label: "Sales Executive", value: "SALES_EXECUTIVE" },
  { label: "Security Staff", value: "SECURITY_STAFF" },
  { label: "Event Coordinator", value: "EVENT_COORDINATOR" },
];

interface DepartmentRow {
  id: string;
  name: string;
  isActive: boolean;
}

interface StaffPayload {
  id: string;
  name: string;
  email: string | null;
  subRole: string | null;
  isActive: boolean;
  staffProfile: {
    department: string | null;
  } | null;
}

interface Props {
  staff: StaffPayload;
  onClose: () => void;
  onSaved: () => void;
}

export function EditStaffModal({ staff, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: staff.name,
    email: staff.email ?? "",
    subRole: staff.subRole ?? "TICKET_COUNTER",
    department: staff.staffProfile?.department ?? "",
    isActive: staff.isActive,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);

  useEffect(() => {
    void fetch("/api/v1/settings/departments")
      .then((res) => res.json())
      .then((rows) => {
        setDepartments((rows as DepartmentRow[]).filter((row) => row.isActive));
      })
      .catch(() => {
        setDepartments([]);
      });
  }, []);

  function set<K extends keyof typeof form>(field: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setForm((prev) => ({
        ...prev,
        [field]: field === "isActive" ? value === "true" : value,
      }));
    };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/staff/${staff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() ? form.email.trim() : null,
          subRole: form.subRole,
          department: form.department || null,
          isActive: form.isActive,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Failed to update staff member");
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Edit Staff Member" onClose={onClose}>
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Full Name" value={form.name} onChange={set("name")} />
          <Input label="Email" type="email" value={form.email} onChange={set("email")} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Sub Role" value={form.subRole} onChange={set("subRole")} options={SUB_ROLES} />
          <Select
            label="Department"
            value={form.department}
            onChange={set("department")}
            options={[
              { label: "Select Department", value: "" },
              ...departments.map((row) => ({ label: row.name, value: row.name })),
            ]}
          />
        </div>

        <Select
          label="Status"
          value={String(form.isActive)}
          onChange={set("isActive")}
          options={[
            { label: "Active", value: "true" },
            { label: "Inactive", value: "false" },
          ]}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}
