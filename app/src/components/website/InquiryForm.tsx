"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type FormState = {
  name: string;
  mobile: string;
  email: string;
  groupSize: string;
  expectedVisit: string;
  budget: string;
  message: string;
};

const initialState: FormState = {
  name: "",
  mobile: "",
  email: "",
  groupSize: "",
  expectedVisit: "",
  budget: "",
  message: "",
};

interface InquiryFormProps {
  compact?: boolean;
}

export function InquiryForm({ compact = false }: InquiryFormProps): JSX.Element {
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const response = await fetch("/api/v1/public/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        mobile: form.mobile,
        email: form.email || undefined,
        groupSize: form.groupSize ? Number(form.groupSize) : undefined,
        expectedVisit: form.expectedVisit || undefined,
        budget: form.budget ? Number(form.budget) : undefined,
        message: form.message || undefined,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    setLoading(false);

    if (!response.ok) {
      setError(payload?.message ?? "Could not submit inquiry. Please try again.");
      return;
    }

    setSuccess("Inquiry submitted. Our team will contact you shortly.");
    setForm(initialState);
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <h3 className="text-xl font-semibold text-[var(--color-text)]">Plan Your Visit</h3>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Share your details and our team will reach out.</p>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={compact ? "grid gap-4 sm:grid-cols-2" : "grid gap-4 md:grid-cols-2"}>
            <Input
              label="Name"
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Input
              label="Mobile"
              required
              value={form.mobile}
              onChange={(event) => setForm((prev) => ({ ...prev, mobile: event.target.value }))}
              placeholder="10-digit mobile"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
            <Input
              label="Group Size"
              type="number"
              min={1}
              value={form.groupSize}
              onChange={(event) => setForm((prev) => ({ ...prev, groupSize: event.target.value }))}
            />
            <Input
              label="Expected Visit Date"
              type="date"
              value={form.expectedVisit}
              onChange={(event) => setForm((prev) => ({ ...prev, expectedVisit: event.target.value }))}
            />
            <Input
              label="Budget (INR)"
              type="number"
              min={0}
              value={form.budget}
              onChange={(event) => setForm((prev) => ({ ...prev, budget: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="inquiry-message">
              Notes
            </label>
            <textarea
              id="inquiry-message"
              rows={4}
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              placeholder="Tell us if this is family, school, corporate or event booking."
            />
          </div>
          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
          {success ? <p className="text-sm text-[var(--color-success)]">{success}</p> : null}
          <Button type="submit" loading={loading}>
            Submit Inquiry
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
