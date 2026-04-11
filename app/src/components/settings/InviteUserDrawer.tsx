"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface InviteUserDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function InviteUserDrawer({ open, onClose, onSaved }: InviteUserDrawerProps): JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Staff@1234");
  const [subRole, setSubRole] = useState("TICKET_COUNTER");
  const [employeeCode, setEmployeeCode] = useState("");
  const [department, setDepartment] = useState("");
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().slice(0, 10));
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; isActive: boolean }>>([]);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/v1/settings/departments")
      .then((res) => res.json())
      .then((rows) => setDepartments((rows as Array<{ id: string; name: string; isActive: boolean }>).filter((row) => row.isActive)))
      .catch(() => setDepartments([]));
  }, [open]);

  return (
    <Drawer open={open} onClose={onClose} title="Invite User">
      <div className="space-y-3">
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <Input label="Mobile" value={mobile} onChange={(event) => setMobile(event.target.value)} />
        <Input label="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input label="Temporary Password" value={password} onChange={(event) => setPassword(event.target.value)} />

        <Select
          label="Sub Role"
          value={subRole}
          onChange={(event) => setSubRole(event.target.value)}
          options={[
            { label: "Ticket Counter", value: "TICKET_COUNTER" },
            { label: "F&B Staff", value: "FB_STAFF" },
            { label: "Ride Operator", value: "RIDE_OPERATOR" },
            { label: "Maintenance Tech", value: "MAINTENANCE_TECH" },
            { label: "Locker Attendant", value: "LOCKER_ATTENDANT" },
            { label: "Costume Attendant", value: "COSTUME_ATTENDANT" },
            { label: "Sales Executive", value: "SALES_EXECUTIVE" },
            { label: "Security Staff", value: "SECURITY_STAFF" },
            { label: "Event Coordinator", value: "EVENT_COORDINATOR" },
          ]}
        />

        <Input label="Employee Code" value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} />
        <Select
          label="Department"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          options={[
            { label: "Select Department", value: "" },
            ...departments.map((row) => ({ label: row.name, value: row.name })),
          ]}
        />
        <Input label="Joining Date" type="date" value={joiningDate} onChange={(event) => setJoiningDate(event.target.value)} />

        <Button
          loading={isPending}
          onClick={() => {
            startTransition(() => {
              void fetch("/api/v1/staff", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name,
                  mobile,
                  email,
                  password,
                  subRole,
                  employeeCode,
                  department,
                  joiningDate,
                }),
              }).then(() => {
                onSaved();
                onClose();
              });
            });
          }}
        >
          Invite Staff User
        </Button>
      </div>
    </Drawer>
  );
}
