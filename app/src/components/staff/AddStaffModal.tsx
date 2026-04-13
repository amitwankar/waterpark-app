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
  { label: "Parking Attendant", value: "PARKING_ATTENDANT" },
  { label: "Sales Executive", value: "SALES_EXECUTIVE" },
  { label: "Security Staff", value: "SECURITY_STAFF" },
  { label: "Event Coordinator", value: "EVENT_COORDINATOR" },
];

interface Props { onClose: () => void; onSaved: () => void }

interface DepartmentRow {
  id: string;
  name: string;
  isActive: boolean;
}

export function AddStaffModal({ onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    email: "",
    password: "",
    subRole: "TICKET_COUNTER",
    employeeCode: "",
    department: "",
    joiningDate: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile || !form.password || !form.employeeCode || !form.joiningDate) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          email: form.email.trim() || undefined,
          department: form.department.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Failed to create staff member");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Add Staff Member" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Full Name *" value={form.name} onChange={set("name")} placeholder="Staff name" />
          <Input label="Mobile *" value={form.mobile} onChange={set("mobile")} placeholder="10-digit mobile" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Email" value={form.email} onChange={set("email")} placeholder="Optional" type="email" />
          <Input label="Password *" value={form.password} onChange={set("password")} type="password" placeholder="Min 8 chars" />
        </div>
        <Select
          value={form.subRole}
          onChange={set("subRole")}
          options={SUB_ROLES}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Employee Code *" value={form.employeeCode} onChange={set("employeeCode")} placeholder="WP-EMP-0001" />
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
        <Input label="Joining Date *" type="date" value={form.joiningDate} onChange={set("joiningDate")} />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create Staff Member"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
