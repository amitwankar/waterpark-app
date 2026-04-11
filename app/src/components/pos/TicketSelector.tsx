"use client";

import { useState, useEffect } from "react";
import type { CartItem } from "./useCart";

interface TicketType {
  id: string;
  name: string;
  description: string | null;
  price: number;
  gstRate: number;
  category: string;
  isActive: boolean;
}

interface TicketSelectorProps {
  onAdd: (item: Omit<CartItem, "quantity">) => void;
}

export function TicketSelector({ onAdd }: TicketSelectorProps) {
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/ticket-types?activeOnly=true");
        if (!res.ok) throw new Error("Failed to load ticket types");
        const data = await res.json();
        setTickets(data.ticketTypes ?? data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const categories = ["ALL", ...Array.from(new Set(tickets.map((t) => t.category)))];
  const filtered =
    selectedCategory === "ALL" ? tickets : tickets.filter((t) => t.category === selectedCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600 text-center py-4">{error}</p>;
  }

  return (
    <div className="space-y-3">
      {/* Category filter */}
      {categories.length > 2 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-teal-600 text-white"
                  : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Ticket grid */}
      <div className="grid grid-cols-1 gap-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No tickets available</p>
        ) : (
          filtered.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() =>
                onAdd({
                  id: ticket.id,
                  name: ticket.name,
                  unitPrice: ticket.price,
                  gstRate: ticket.gstRate,
                })
              }
              className="flex items-center justify-between w-full rounded-xl border border-[var(--color-border)] px-4 py-3 text-left transition-colors group hover:border-teal-500/60 hover:bg-teal-500/10"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)] group-hover:text-teal-600 dark:group-hover:text-teal-300">
                  {ticket.name}
                </p>
                {ticket.description && (
                  <p className="text-xs text-[var(--color-text-muted)] truncate">{ticket.description}</p>
                )}
                {ticket.gstRate > 0 && (
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">+{ticket.gstRate}% GST</p>
                )}
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className="text-sm font-bold text-[var(--color-text)]">₹{ticket.price.toFixed(2)}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-500/15 text-lg font-medium leading-none text-teal-600 transition-colors group-hover:bg-teal-600 group-hover:text-white dark:text-teal-300">
                  +
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
