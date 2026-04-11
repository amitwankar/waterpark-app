"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export interface AuditLogRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; name: string; mobile: string; role: string } | null;
}

export interface AuditLogTableProps {
  initialRows: AuditLogRow[];
}

export function AuditLogTable({ initialRows }: AuditLogTableProps): JSX.Element {
  const [rows, setRows] = useState<AuditLogRow[]>(initialRows);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", "20");
    if (actionFilter) params.set("action", actionFilter);
    if (entityFilter) params.set("entity", entityFilter);
    return params.toString();
  }, [page, actionFilter, entityFilter]);

  useEffect(() => {
    startTransition(() => {
      void fetch(`/api/v1/settings/audit-log?${queryString}`)
        .then((res) => res.json())
        .then((data) => setRows(data.rows ?? []));
    });
  }, [queryString]);

  return (
    <section id="audit-log">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Audit Log</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input label="Action" value={actionFilter} onChange={(event) => { setPage(1); setActionFilter(event.target.value); }} />
            <Input label="Entity" value={entityFilter} onChange={(event) => { setPage(1); setEntityFilter(event.target.value); }} />
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => { setActionFilter(""); setEntityFilter(""); setPage(1); }}>
                Clear
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
            <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/40">
                <tr>
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Entity</th>
                  <th className="px-3 py-2 text-left">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">{new Date(row.createdAt).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2">{row.user?.name ?? "System"}</td>
                    <td className="px-3 py-2">{row.action}</td>
                    <td className="px-3 py-2">{row.entity}{row.entityId ? ` (${row.entityId})` : ""}</td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(row)}>
                        View diff
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1 || isPending} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
              Previous
            </Button>
            <span className="text-sm text-[var(--color-text-muted)]">Page {page}</span>
            <Button size="sm" variant="outline" disabled={isPending || rows.length < 20} onClick={() => setPage((prev) => prev + 1)}>
              Next
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Audit Diff">
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-semibold text-[var(--color-text)]">Old Value</p>
            <pre className="mt-1 overflow-x-auto rounded-[var(--radius-md)] bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
              {JSON.stringify(selected?.oldValue ?? null, null, 2)}
            </pre>
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text)]">New Value</p>
            <pre className="mt-1 overflow-x-auto rounded-[var(--radius-md)] bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
              {JSON.stringify(selected?.newValue ?? null, null, 2)}
            </pre>
          </div>
        </div>
      </Modal>
    </section>
  );
}
