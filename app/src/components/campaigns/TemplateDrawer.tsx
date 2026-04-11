"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface TemplateDrawerProps {
  open: boolean;
  onClose: () => void;
  initial?: {
    id?: string;
    name: string;
    channel: "SMS" | "WHATSAPP" | "EMAIL";
    subject?: string | null;
    body: string;
    variables?: string[];
    isActive?: boolean;
  } | null;
  onSaved?: () => void;
}

function detectVariables(body: string): string[] {
  const set = new Set<string>();
  const regex = /\{([a-zA-Z0-9_]+)\}/g;
  let match = regex.exec(body);
  while (match) {
    set.add(match[1]);
    match = regex.exec(body);
  }
  return Array.from(set);
}

export function TemplateDrawer({ open, onClose, initial, onSaved }: TemplateDrawerProps): JSX.Element {
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initial?.name ?? "");
  const [channel, setChannel] = useState<"SMS" | "WHATSAPP" | "EMAIL">(initial?.channel ?? "SMS");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");

  const variables = useMemo(() => detectVariables(body), [body]);
  const smsChars = body.length;
  const smsCredits = Math.max(1, Math.ceil(smsChars / 160));

  function reset(): void {
    setName(initial?.name ?? "");
    setChannel(initial?.channel ?? "SMS");
    setSubject(initial?.subject ?? "");
    setBody(initial?.body ?? "");
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial?.id ? "Edit Template" : "New Template"} widthClassName="w-full max-w-2xl">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();

          startTransition(() => {
            const method = initial?.id ? "PUT" : "POST";
            const url = initial?.id
              ? `/api/v1/communication/templates/${initial.id}`
              : "/api/v1/communication/templates";

            void fetch(url, {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name,
                channel,
                subject: subject || null,
                body,
                variables,
                isActive: true,
              }),
            }).then(() => {
              reset();
              onClose();
              onSaved?.();
            });
          });
        }}
      >
        <Input label="Template Name" value={name} onChange={(event) => setName(event.target.value)} required />

        <Select
          label="Channel"
          value={channel}
          onChange={(event) => setChannel(event.target.value as "SMS" | "WHATSAPP" | "EMAIL")}
          options={[
            { label: "SMS", value: "SMS" },
            { label: "WhatsApp", value: "WHATSAPP" },
            { label: "Email", value: "EMAIL" },
          ]}
        />

        {channel === "EMAIL" ? (
          <Input label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
        ) : null}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text)]">Body</label>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="h-48 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm outline-none"
            required
          />
          {channel === "SMS" ? (
            <p className="text-xs text-[var(--color-text-muted)]">{smsChars} chars • {smsCredits} credit(s)</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">Detected Variables</p>
          <div className="flex flex-wrap gap-2">
            {variables.length === 0 ? (
              <span className="text-xs text-[var(--color-text-muted)]">No variables</span>
            ) : (
              variables.map((variable) => (
                <span key={variable} className="rounded-full bg-cyan-100 px-2 py-1 text-xs text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200">
                  {`{${variable}}`}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">Preview</p>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm">
            {body || "Template preview"}
          </div>
        </div>

        <Button type="submit" loading={isPending} className="w-full">
          {initial?.id ? "Save Template" : "Create Template"}
        </Button>
      </form>
    </Drawer>
  );
}
