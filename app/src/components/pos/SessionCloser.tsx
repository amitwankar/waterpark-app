"use client";

import { useState, useEffect } from "react";

interface SessionReport {
  sessionId: string;
  terminalId: string;
  openedAt: string;
  staffName: string;
  openingCash: number;
  expectedCash: number;
  summary: {
    totalSales: number;
    totalTransactions: number;
    byMethod: Record<string, number>;
  };
}

interface SessionReportApiPayload {
  session?: {
    id?: string;
    terminalId?: string;
    openedAt?: string;
    staffName?: string;
    openingCash?: number | null;
    expectedCash?: number | null;
  };
  summary?: {
    totalSales?: number;
    totalCollected?: number;
    totalTransactions?: number;
    transactionCount?: number;
    byMethod?: Record<string, number> | Array<{ method: string; amount: number }>;
  };
}

function normalizeReport(payload: SessionReportApiPayload, fallbackSessionId: string): SessionReport {
  const byMethodRaw = payload.summary?.byMethod;
  const byMethod: Record<string, number> = Array.isArray(byMethodRaw)
    ? byMethodRaw.reduce<Record<string, number>>((acc, line) => {
        acc[line.method] = Number(line.amount ?? 0);
        return acc;
      }, {})
    : Object.fromEntries(
        Object.entries(byMethodRaw ?? {}).map(([method, amount]) => [method, Number(amount ?? 0)]),
      );

  return {
    sessionId: String(payload.session?.id ?? fallbackSessionId),
    terminalId: String(payload.session?.terminalId ?? "POS"),
    openedAt: String(payload.session?.openedAt ?? new Date().toISOString()),
    staffName: String(payload.session?.staffName ?? "Staff"),
    openingCash: Number(payload.session?.openingCash ?? 0),
    expectedCash: Number(payload.session?.expectedCash ?? 0),
    summary: {
      totalSales: Number(payload.summary?.totalSales ?? payload.summary?.totalCollected ?? 0),
      totalTransactions: Number(payload.summary?.totalTransactions ?? payload.summary?.transactionCount ?? 0),
      byMethod,
    },
  };
}

interface SessionCloserProps {
  sessionId: string;
  onClosed: () => void;
  onCancel: () => void;
}

export function SessionCloser({ sessionId, onClosed, onCancel }: SessionCloserProps) {
  const [report, setReport] = useState<SessionReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [closingCash, setClosingCash] = useState("");
  const [notes, setNotes] = useState("");
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/pos/sessions/${sessionId}/report`);
        if (res.ok) {
          const payload = (await res.json()) as SessionReportApiPayload;
          setReport(normalizeReport(payload, sessionId));
        }
      } catch {
        // non-fatal
      } finally {
        setLoadingReport(false);
      }
    }
    load();
  }, [sessionId]);

  async function handleClose() {
    const cash = parseFloat(closingCash);
    if (isNaN(cash) || cash < 0) {
      setError("Enter a valid closing cash amount.");
      return;
    }
    setClosing(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/pos/sessions/${sessionId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingCash: cash, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to close session");
      onClosed();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setClosing(false);
    }
  }

  const variance =
    report && closingCash !== ""
      ? parseFloat(closingCash) - report.expectedCash
      : null;

  const METHOD_LABELS: Record<string, string> = {
    CASH: "Cash",
    MANUAL_UPI: "UPI",
    CARD: "Card",
    COMPLIMENTARY: "Complimentary",
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Close Session</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {loadingReport ? (
            <p className="text-sm text-gray-500 text-center py-4">Loading session report…</p>
          ) : report ? (
            <>
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Terminal</span>
                  <span className="font-medium">{report.terminalId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Opened at</span>
                  <span className="font-medium">{new Date(report.openedAt).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cashier</span>
                  <span className="font-medium">{report.staffName}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                  <span className="text-gray-500">Total Sales</span>
                  <span className="font-bold text-teal-700">₹{report.summary.totalSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Transactions</span>
                  <span className="font-medium">{report.summary.totalTransactions}</span>
                </div>
              </div>

              {/* Payment breakdown */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">By Payment Method</p>
                <div className="space-y-1">
                  {Object.entries(report.summary.byMethod).map(([method, amount]) => (
                    <div key={method} className="flex justify-between text-sm">
                      <span className="text-gray-600">{METHOD_LABELS[method] ?? method}</span>
                      <span className="font-medium">₹{Number(amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Opening Cash</span>
                  <span className="font-medium text-blue-800">₹{report.openingCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-blue-700">Expected Cash</span>
                  <span className="font-medium text-blue-800">₹{report.expectedCash.toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Could not load session report.</p>
          )}

          {/* Closing cash entry */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Closing Cash Count (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              placeholder="Enter physical cash counted"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {variance !== null && !isNaN(variance) && (
            <div
              className={`rounded-lg px-4 py-3 text-sm font-medium ${
                Math.abs(variance) < 0.01
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : variance > 0
                  ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {Math.abs(variance) < 0.01
                ? "✓ Cash balanced perfectly"
                : variance > 0
                ? `▲ Surplus: ₹${variance.toFixed(2)}`
                : `▼ Shortage: ₹${Math.abs(variance).toFixed(2)}`}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              EOD Notes <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any discrepancies or remarks…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClose}
              disabled={closing || closingCash === ""}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {closing ? "Closing…" : "Close Session"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
