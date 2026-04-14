"use client";

import { useState, useRef } from "react";
import { parseBookingQrContent } from "@/lib/qr";

interface BookingResult {
  id: string;
  bookingNumber: string;
  sourceType?: "BOOKING" | "QUEUE";
  guestName: string;
  guestMobile: string;
  visitDate: string;
  status: string;
  discountAmount?: number;
  totalAmount: number;
  paid: number;
  balance: number;
  tickets: { ticketTypeId: string; name: string; quantity: number; unitPrice: number; gstRate: number }[];
  posPreload?: {
    packageLines?: Array<{ packageId: string; quantity: number }>;
    foodLines?: Array<{ foodItemId: string; foodVariantId?: string; quantity: number }>;
    lockerLines?: Array<{ lockerId: string; quantity: number }>;
    costumeLines?: Array<{ costumeItemId: string; quantity: number }>;
    rideLines?: Array<{ rideId: string; quantity: number }>;
    customDiscountType?: "NONE" | "PERCENTAGE" | "AMOUNT";
    customDiscountValue?: number;
    customDiscountAmount?: number;
  } | null;
}

interface BookingLookupProps {
  onSelect: (booking: BookingResult) => void;
}

export function BookingLookup({ onSelect }: BookingLookupProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function normalizeLookupQuery(raw: string): string {
    const trimmed = raw.trim();
    const qr = parseBookingQrContent(trimmed);
    if (qr?.bookingNumber) return qr.bookingNumber;
    return trimmed;
  }

  async function search(q: string) {
    const normalized = normalizeLookupQuery(q);
    if (normalized.length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [bookingRes, queueRes] = await Promise.all([
        fetch(`/api/v1/pos/booking-lookup?q=${encodeURIComponent(normalized)}`),
        fetch(`/api/v1/pos/queue-lookup?q=${encodeURIComponent(normalized)}`),
      ]);

      const bookingData = (await bookingRes.json().catch(() => [])) as BookingResult[];
      const queueData = (await queueRes.json().catch(() => [])) as BookingResult[];

      const bookings: BookingResult[] = bookingRes.ok
        ? bookingData.map((row) => ({ ...row, sourceType: "BOOKING" as const }))
        : [];
      const queues: BookingResult[] = queueRes.ok
        ? queueData.map((row) => ({ ...row, sourceType: "QUEUE" as const }))
        : [];

      if (!bookingRes.ok && !queueRes.ok) {
        const msg = (bookingData as any)?.error ?? (queueData as any)?.error ?? "Search failed";
        throw new Error(String(msg));
      }

      setResults([...queues, ...bookings]);
      setSearched(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 350);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      search(query);
    }
  }

  const STATUS_BADGE: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    CONFIRMED: "bg-green-100 text-green-700",
  };

  const SOURCE_BADGE: Record<string, string> = {
    QUEUE: "bg-indigo-100 text-indigo-700",
    BOOKING: "bg-teal-100 text-teal-700",
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by booking/mobile/name or paste booking QR JSON…"
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {loading ? (
            <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {searched && results.length === 0 && !loading && (
        <p className="text-sm text-gray-500 text-center py-3">No bookings found for &quot;{query}&quot;</p>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {results.map((b) => (
          <div
            key={b.id}
            className="border border-gray-200 rounded-xl p-3 hover:border-teal-400 hover:bg-teal-50 transition-colors cursor-pointer"
            onClick={() => onSelect(b)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-900">{b.bookingNumber}</span>
                  {b.sourceType ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_BADGE[b.sourceType] ?? "bg-gray-100 text-gray-600"}`}>
                      {b.sourceType}
                    </span>
                  ) : null}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {b.status}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-0.5">{b.guestName}</p>
                <p className="text-xs text-gray-500">{b.guestMobile} · Visit: {b.visitDate}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {b.tickets.map((t) => `${t.name} ×${t.quantity}`).join(", ")}
                </p>
              </div>
              <div className="text-right shrink-0">
                {typeof b.discountAmount === "number" && b.discountAmount > 0 ? (
                  <p className="text-[11px] text-gray-500">Discount: ₹{b.discountAmount.toFixed(2)}</p>
                ) : null}
                <p className="text-xs text-gray-500">Total: ₹{b.totalAmount.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Paid: ₹{b.paid.toFixed(2)}</p>
                {b.balance > 0 ? (
                  <p className="text-sm font-bold text-red-600">Due: ₹{b.balance.toFixed(2)}</p>
                ) : (
                  <p className="text-xs font-medium text-green-600">Fully paid</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
