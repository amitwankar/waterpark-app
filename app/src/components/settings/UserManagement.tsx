"use client";

import { useState, useTransition } from "react";

import { InviteUserDrawer } from "@/components/settings/InviteUserDrawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface UserRow {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  role: string;
  subRole: string | null;
  isActive: boolean;
}

export interface UserManagementProps {
  initialUsers: UserRow[];
}

export function UserManagement({ initialUsers }: UserManagementProps): JSX.Element {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function refresh(): Promise<void> {
    const response = await fetch("/api/v1/staff");
    const staff = (await response.json()) as Array<{ id: string; name: string; mobile: string; email: string | null; subRole: string | null; isActive: boolean }>;

    const admins = users.filter((user) => user.role === "ADMIN");
    setUsers([
      ...admins,
      ...staff.map((row) => ({
        id: row.id,
        name: row.name,
        mobile: row.mobile,
        email: row.email,
        role: "EMPLOYEE",
        subRole: row.subRole,
        isActive: row.isActive,
      })),
    ]);
  }

  return (
    <section id="users">
      <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">System User Management</h2>
          <Button size="sm" onClick={() => setDrawerOpen(true)}>Invite User</Button>
        </div>
      </CardHeader>
      <CardBody>
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/40">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Mobile</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-[var(--color-text)]">{user.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{user.email ?? "-"}</p>
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{user.mobile}</td>
                  <td className="px-3 py-2">
                    <Badge variant={user.role === "ADMIN" ? "info" : "default"}>{user.role}{user.subRole ? ` • ${user.subRole}` : ""}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={user.isActive ? "success" : "danger"}>{user.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {user.role === "EMPLOYEE" ? (
                      <Button
                        size="sm"
                        variant={user.isActive ? "danger" : "outline"}
                        loading={isPending}
                        onClick={() => {
                          startTransition(() => {
                            void fetch(`/api/v1/staff/${user.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ isActive: !user.isActive }),
                            }).then(() => {
                              setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, isActive: !item.isActive } : item)));
                            });
                          });
                        }}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)]">Protected</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <InviteUserDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => {
            void refresh();
          }}
        />
      </CardBody>
      </Card>
    </section>
  );
}
