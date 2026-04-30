"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { TagChips } from "@/components/crm/TagChips";
import { TierBadge } from "@/components/crm/TierBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export interface GuestProfileCardProps {
  guest: {
    id: string;
    name: string;
    mobile: string;
    email: string | null;
    tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
    totalVisits: number;
    totalSpend: number;
    loyaltyPoints: number;
    lastVisitDate: string | null;
    tags: string[];
    notes: string;
  };
}

export function GuestProfileCard({ guest }: GuestProfileCardProps): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState(guest.name);
  const [email, setEmail] = useState(guest.email ?? "");
  const [notes, setNotes] = useState(guest.notes ?? "");
  const [tags, setTags] = useState<string[]>(guest.tags);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveProfile(next: { name?: string; email?: string; notes?: string; tags?: string[] }): Promise<void> {
    const response = await fetch(`/api/v1/crm/guests/${guest.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: next.name ?? name,
        email: next.email ?? email,
        notes: next.notes ?? notes,
        tags: next.tags ?? tags,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? "Failed to update guest profile");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      startTransition(() => {
        void saveProfile({ notes })
          .then(() => {
            setSaved(true);
            setError(null);
            window.setTimeout(() => setSaved(false), 1200);
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Failed to save notes");
          });
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [notes]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Guest Profile</h2>
          <TierBadge tier={guest.tier} />
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <p>Visits: <span className="font-semibold text-[var(--color-text)]">{guest.totalVisits}</span></p>
          <p>Spend: <span className="font-semibold text-[var(--color-text)]">Rs {guest.totalSpend.toFixed(0)}</span></p>
          <p>Points: <span className="font-semibold text-[var(--color-text)]">{guest.loyaltyPoints}</span></p>
          <p>Last Visit: <span className="font-semibold text-[var(--color-text)]">{guest.lastVisitDate ? new Date(guest.lastVisitDate).toLocaleDateString("en-IN") : "-"}</span></p>
        </div>

        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <Input label="Mobile" value={guest.mobile} disabled />
        <Input label="Email" value={email} onChange={(event) => setEmail(event.target.value)} />

        <Button
          variant="secondary"
          onClick={() => {
            startTransition(() => {
              void saveProfile({ name, email, tags }).then(() => {
                setSaved(true);
                setError(null);
                window.setTimeout(() => setSaved(false), 1200);
              }).catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Failed to save profile");
              });
            });
          }}
          loading={isPending}
        >
          Save profile
        </Button>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--color-text)]">Tags</p>
          <TagChips
            tags={tags}
            editable
            onAdd={(tag) => {
              startTransition(() => {
                void fetch(`/api/v1/crm/guests/${guest.id}/tag`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "add", tag }),
                })
                  .then((res) => res.json())
                  .then((payload: { tags?: string[] }) => {
                    if (payload.tags) setTags(payload.tags);
                  });
              });
            }}
            onRemove={(tag) => {
              startTransition(() => {
                void fetch(`/api/v1/crm/guests/${guest.id}/tag`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "remove", tag }),
                })
                  .then((res) => res.json())
                  .then((payload: { tags?: string[] }) => {
                    if (payload.tags) setTags(payload.tags);
                  });
              });
            }}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--color-text)]">Notes</p>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="h-32 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm outline-none focus:border-[var(--color-primary)]"
            placeholder="Internal notes"
          />
          <p className="text-xs text-[var(--color-text-muted)]">{saved ? "Saved" : "Auto-saves after typing"}</p>
        </div>
        <div className="space-y-2">
          <Button
            variant="danger"
            onClick={() => {
              if (!window.confirm("Delete this guest profile permanently?")) return;
              startTransition(() => {
                void fetch(`/api/v1/crm/guests/${guest.id}`, { method: "DELETE" })
                  .then(async (response) => {
                    if (!response.ok) {
                      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
                      throw new Error(payload?.message ?? "Failed to delete guest");
                    }
                    router.push("/admin/crm/guests");
                  })
                  .catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : "Failed to delete guest");
                  });
              });
            }}
            loading={isPending}
          >
            Delete Guest Profile
          </Button>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      </CardBody>
    </Card>
  );
}
