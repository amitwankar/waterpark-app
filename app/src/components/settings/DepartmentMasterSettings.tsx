"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/Toast";
import { fetchJson } from "@/components/settings/http";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

interface DepartmentRow {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
}

export function DepartmentMasterSettings(): JSX.Element {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newRow, setNewRow] = useState({ name: "", code: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; code: string; isActive: boolean }>({ name: "", code: "", isActive: true });

  async function load() {
    setLoading(true);
    try {
      const data = await fetchJson<DepartmentRow[]>("/api/v1/settings/departments");
      setRows(data);
    } catch (error: unknown) {
      pushToast({
        title: "Load failed",
        message: error instanceof Error ? error.message : "Could not load departments",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeCount = useMemo(() => rows.filter((row) => row.isActive).length, [rows]);

  async function createDepartment() {
    if (!newRow.name.trim()) return;
    setCreating(true);
    try {
      await fetchJson("/api/v1/settings/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRow.name.trim(),
          code: newRow.code.trim() || undefined,
        }),
      });
      setNewRow({ name: "", code: "" });
      await load();
      pushToast({ title: "Department added", variant: "success" });
    } catch (error: unknown) {
      pushToast({
        title: "Create failed",
        message: error instanceof Error ? error.message : "Could not create department",
        variant: "error",
      });
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(id: string) {
    try {
      await fetchJson(`/api/v1/settings/departments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          code: draft.code.trim() || null,
          isActive: draft.isActive,
        }),
      });
      setEditingId(null);
      await load();
      pushToast({ title: "Department updated", variant: "success" });
    } catch (error: unknown) {
      pushToast({
        title: "Update failed",
        message: error instanceof Error ? error.message : "Could not update department",
        variant: "error",
      });
    }
  }

  async function deleteDepartment(id: string) {
    const ok = window.confirm("Delete this department?");
    if (!ok) return;
    try {
      await fetchJson(`/api/v1/settings/departments/${id}`, { method: "DELETE" });
      await load();
      pushToast({ title: "Department deleted", variant: "success" });
    } catch (error: unknown) {
      pushToast({
        title: "Delete failed",
        message: error instanceof Error ? error.message : "Could not delete department",
        variant: "error",
      });
    }
  }

  return (
    <section id="department-master">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Department Master</h2>
              <p className="text-sm text-[var(--color-text-muted)]">Manage department LOV used in staff forms.</p>
            </div>
            <Badge variant="info">{activeCount} active</Badge>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 md:grid-cols-[1fr_180px_auto]">
            <Input label="Department Name" value={newRow.name} onChange={(e) => setNewRow((prev) => ({ ...prev, name: e.target.value }))} />
            <Input label="Code" value={newRow.code} onChange={(e) => setNewRow((prev) => ({ ...prev, code: e.target.value }))} placeholder="OPS" />
            <div className="flex items-end">
              <Button onClick={() => void createDepartment()} disabled={creating || !newRow.name.trim()}>
                {creating ? "Adding..." : "Add Department"}
              </Button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Loading departments...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No departments yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
              <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
                <thead className="bg-[var(--color-surface-muted)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]">Code</th>
                    <th className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]">Status</th>
                    <th className="px-3 py-2 text-right font-medium text-[var(--color-text-muted)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {rows.map((row) => {
                    const isEdit = editingId === row.id;
                    return (
                      <tr key={row.id}>
                        <td className="px-3 py-2">
                          {isEdit ? (
                            <Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
                          ) : (
                            row.name
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isEdit ? (
                            <Input value={draft.code} onChange={(e) => setDraft((prev) => ({ ...prev, code: e.target.value }))} />
                          ) : (
                            row.code ?? "-"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isEdit ? (
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={draft.isActive}
                                onChange={(e) => setDraft((prev) => ({ ...prev, isActive: e.target.checked }))}
                              />
                              <span>{draft.isActive ? "Active" : "Inactive"}</span>
                            </label>
                          ) : (
                            <Badge variant={row.isActive ? "success" : "default"}>{row.isActive ? "Active" : "Inactive"}</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isEdit ? (
                            <div className="inline-flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                              <Button size="sm" onClick={() => void saveEdit(row.id)}>Save</Button>
                            </div>
                          ) : (
                            <div className="inline-flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingId(row.id);
                                  setDraft({ name: row.name, code: row.code ?? "", isActive: row.isActive });
                                }}
                              >
                                Edit
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => void deleteDepartment(row.id)}>
                                Delete
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </section>
  );
}
