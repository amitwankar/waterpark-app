"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface SensitiveFieldProps {
  label: string;
  maskedValue: string;
  placeholder?: string;
  onSave: (value: string) => Promise<void>;
}

export function SensitiveField({ label, maskedValue, placeholder, onSave }: SensitiveFieldProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      {!editing ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-sm text-[var(--color-text)]">{maskedValue || "Not configured"}</p>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Update
          </Button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <Input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} />
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={isPending}
              onClick={() => {
                startTransition(() => {
                  void onSave(value).then(() => {
                    setEditing(false);
                    setValue("");
                  });
                });
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setValue(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
