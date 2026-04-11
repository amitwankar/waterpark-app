"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export type SplitMethod = "GATEWAY" | "MANUAL_UPI" | "CASH";

export interface SplitRow {
  id: string;
  method: SplitMethod;
  amount: number;
}

export interface SplitBuilderProps {
  totalAmount: number;
  rows: SplitRow[];
  onChange: (rows: SplitRow[]) => void;
  maxRows?: number;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function createRow(): SplitRow {
  return {
    id: crypto.randomUUID(),
    method: "GATEWAY",
    amount: 50,
  };
}

export function createDefaultSplitRows(totalAmount: number): SplitRow[] {
  return [
    {
      id: crypto.randomUUID(),
      method: "GATEWAY",
      amount: totalAmount,
    },
  ];
}

export function SplitBuilder({ totalAmount, rows, onChange, maxRows = 4 }: SplitBuilderProps): JSX.Element {
  const allocated = round(rows.reduce((acc, row) => acc + (Number.isFinite(row.amount) ? row.amount : 0), 0));
  const remaining = round(totalAmount - allocated);
  const exactMatch = remaining === 0;

  function updateRow(id: string, patch: Partial<SplitRow>): void {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string): void {
    if (rows.length <= 1) {
      return;
    }
    onChange(rows.filter((row) => row.id !== id));
  }

  function addRow(): void {
    if (rows.length >= maxRows) {
      return;
    }
    onChange([...rows, createRow()]);
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Custom Split Builder</h3>
        <p className="text-sm text-[var(--color-text-muted)]">1 to {maxRows} rows. Minimum Rs.50 per row.</p>
      </CardHeader>
      <CardBody className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id} className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Select
              label={`Method ${index + 1}`}
              options={[
                { label: "Razorpay", value: "GATEWAY" },
                { label: "Manual UPI", value: "MANUAL_UPI" },
                { label: "Cash at Gate", value: "CASH" },
              ]}
              value={row.method}
              onChange={(event) => updateRow(row.id, { method: event.target.value as SplitMethod })}
            />

            <Input
              label="Amount"
              type="number"
              min={50}
              value={String(row.amount)}
              onChange={(event) => {
                const value = Number(event.target.value);
                updateRow(row.id, { amount: Number.isFinite(value) ? value : 0 });
              }}
            />

            <Button variant="ghost" className="sm:mb-[2px]" onClick={() => removeRow(row.id)} disabled={rows.length <= 1}>
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        ))}

        <Button variant="outline" onClick={addRow} disabled={rows.length >= maxRows}>
          <Plus className="h-4 w-4" />
          Add Payment Method
        </Button>

        <div
          className={`rounded-[var(--radius-md)] border p-3 text-sm ${
            exactMatch
              ? "border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200"
              : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          }`}
        >
          {formatInr(allocated)} of {formatInr(totalAmount)} allocated - {formatInr(Math.max(0, remaining))} remaining
        </div>
      </CardBody>
    </Card>
  );
}
