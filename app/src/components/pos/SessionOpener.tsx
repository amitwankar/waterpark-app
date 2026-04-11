"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SessionOpenerProps {
  terminalId: string;
  onSessionOpened: (sessionId: string) => void;
  exitHref?: string;
}

export function SessionOpener({
  terminalId,
  onSessionOpened,
  exitHref = "/staff/pos",
}: SessionOpenerProps) {
  const router = useRouter();
  const [openingCash, setOpeningCash] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    const amount = parseFloat(openingCash);
    if (isNaN(amount) || amount < 0) {
      setError("Enter a valid opening cash amount (0 or more).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/pos/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terminalId, openingCash: amount, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open session");
      onSessionOpened(data.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-[var(--color-surface-muted)]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-card)]">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-teal-100 mb-3">
            <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">Open POS Session</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Terminal: <span className="font-medium text-[var(--color-text)]">{terminalId}</span></p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Opening Cash (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Notes <span className="text-[var(--color-text-muted)]">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any notes for this session..."
              className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleOpen}
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Opening…" : "Open Session"}
          </button>

          <button
            type="button"
            onClick={() => router.push(exitHref)}
            disabled={loading}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 font-semibold text-[var(--color-text)] transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
          >
            Exit to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
