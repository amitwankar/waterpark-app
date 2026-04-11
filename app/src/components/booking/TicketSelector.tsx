"use client";

import { Minus, Plus, Ticket } from "lucide-react";

import { type TicketLine } from "@/lib/booking";
import { cn, formatCurrency } from "@/lib/utils";

export interface BookingTicketType {
  id: string;
  name: string;
  description: string | null;
  price: number;
  gstRate: number;
  minAge: number | null;
  maxAge: number | null;
  category?: string | null;
}

export interface TicketSelectorProps {
  tickets: BookingTicketType[];
  value: TicketLine[];
  onChange: (next: TicketLine[]) => void;
  error?: string;
}

function buildAgeLabel(ticket: BookingTicketType): string {
  if (ticket.minAge === null && ticket.maxAge === null) {
    return "All ages";
  }
  if (ticket.minAge !== null && ticket.maxAge !== null) {
    return `${ticket.minAge}–${ticket.maxAge} yrs`;
  }
  if (ticket.minAge !== null) {
    return `${ticket.minAge}+ yrs`;
  }
  return `Up to ${ticket.maxAge} yrs`;
}

export function TicketSelector({ tickets, value, onChange, error }: TicketSelectorProps): JSX.Element {
  function getQty(ticketTypeId: string): number {
    return value.find((l) => l.ticketTypeId === ticketTypeId)?.quantity ?? 0;
  }

  function setQty(ticketTypeId: string, qty: number): void {
    const next = value.filter((l) => l.ticketTypeId !== ticketTypeId);
    if (qty > 0) {
      next.push({ ticketTypeId, quantity: qty });
    }
    onChange(next);
  }

  const totalSelected = value.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-text)]">Select Tickets</p>
        {totalSelected > 0 ? (
          <span className="rounded-full bg-[var(--color-primary)] px-2.5 py-0.5 text-xs font-semibold text-white">
            {totalSelected} ticket{totalSelected !== 1 ? "s" : ""} selected
          </span>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {tickets.map((ticket) => {
          const qty = getQty(ticket.id);
          const selected = qty > 0;
          return (
            <div
              key={ticket.id}
              className={cn(
                "rounded-[var(--radius-lg)] border p-4 transition duration-150",
                selected
                  ? "border-emerald-500/60 bg-emerald-100 dark:border-emerald-400/40 dark:bg-emerald-900/35"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Ticket className={cn("h-3.5 w-3.5 shrink-0", selected ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]")} />
                    <p
                      className={cn(
                        "truncate text-sm font-semibold",
                        selected ? "text-zinc-900 dark:text-emerald-50" : "text-[var(--color-text)]",
                      )}
                    >
                      {ticket.name}
                    </p>
                  </div>
                  {ticket.description ? (
                    <p
                      className={cn(
                        "mt-0.5 text-xs line-clamp-1",
                        selected ? "text-zinc-700 dark:text-emerald-100/85" : "text-[var(--color-text-muted)]",
                      )}
                    >
                      {ticket.description}
                    </p>
                  ) : null}
                  <p className={cn("mt-0.5 text-xs", selected ? "text-zinc-700 dark:text-emerald-100/85" : "text-[var(--color-text-muted)]")}>
                    {buildAgeLabel(ticket)}
                  </p>
                  <p className={cn("mt-1.5 text-base font-bold", selected ? "text-zinc-900 dark:text-emerald-50" : "text-[var(--color-text)]")}>
                    {formatCurrency(ticket.price)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={qty === 0}
                    onClick={() => setQty(ticket.id, qty - 1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] transition duration-150 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Remove one ${ticket.name}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className={cn("min-w-[1.5rem] text-center text-sm font-semibold", selected ? "text-zinc-900 dark:text-emerald-50" : "text-[var(--color-text)]")}>
                    {qty}
                  </span>
                  <button
                    type="button"
                    disabled={qty >= 50}
                    onClick={() => setQty(ticket.id, qty + 1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] transition duration-150 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Add one ${ticket.name}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {selected ? (
                <p className="mt-2 text-right text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  Subtotal: {formatCurrency(ticket.price * qty)}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
