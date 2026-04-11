"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Upload } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/feedback/Toast";

interface BookingResult {
  id: string;
  bookingNumber: string;
  guestName: string;
  guestMobile: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

export default function ManualUpiPage() {
  const { pushToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<BookingResult[]>([]);
  const [selected, setSelected] = useState<BookingResult | null>(null);

  const [upiRef, setUpiRef] = useState("");
  const [screenshot, setScreenshot] = useState<string>("");
  const [screenshotName, setScreenshotName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSearch() {
    if (query.trim().length < 3) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/v1/pos/booking-lookup?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) setResults(await res.json());
    } finally {
      setSearching(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotName(file.name);
    const dataUrl = await fileToDataUrl(file);
    setScreenshot(dataUrl);
  }

  async function handleSubmit() {
    if (!selected) return;
    if (!upiRef.trim()) {
      pushToast({ variant: "error", title: "Enter UTR / UPI reference number" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/payments/manual-upi/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: selected.id,
          upiRef: upiRef.trim(),
          screenshot: screenshot || undefined,
          amount: selected.balanceDue,
          paymentType: "FULL",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setSubmitted(true);
      pushToast({ variant: "success", title: "Manual UPI submitted for verification" });
    } catch (e: unknown) {
      pushToast({ variant: "error", title: e instanceof Error ? e.message : "Failed" });
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setSelected(null);
    setQuery("");
    setResults([]);
    setUpiRef("");
    setScreenshot("");
    setScreenshotName("");
    setSubmitted(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Manual UPI Entry"
        subtitle="Record a UPI payment for a booking and submit for admin verification"
      />

      {submitted ? (
        <Card>
          <CardBody className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-bold text-gray-900">UPI Submitted</p>
            <p className="text-sm text-gray-500 mt-1">
              The payment for {selected?.bookingNumber} has been submitted for admin verification.
            </p>
            <Button className="mt-5" onClick={reset}>Submit Another</Button>
          </CardBody>
        </Card>
      ) : (
        <>
          {/* Step 1: Find booking */}
          <Card>
            <CardHeader><h3 className="font-semibold text-gray-900">Step 1 — Find Booking</h3></CardHeader>
            <CardBody>
              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Booking number, mobile, or guest name…"
                  className="flex-1"
                />
                <Button onClick={handleSearch} loading={searching}>
                  <Search className="h-4 w-4" />
                  Search
                </Button>
              </div>

              {results.length > 0 && (
                <div className="mt-3 space-y-2">
                  {results.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelected(b)}
                      className={`w-full text-left border rounded-xl p-3 transition-colors ${
                        selected?.id === b.id
                          ? "border-teal-500 bg-teal-50"
                          : "border-gray-200 hover:border-teal-300"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold text-sm text-gray-900">{b.bookingNumber}</span>
                          <span className="text-sm text-gray-600 ml-2">{b.guestName}</span>
                          <span className="text-xs text-gray-400 ml-2">{b.guestMobile}</span>
                        </div>
                        <div className="text-right">
                          <Badge variant={b.balanceDue > 0 ? "warning" : "success"}>
                            {b.balanceDue > 0 ? `₹${b.balanceDue.toFixed(2)} due` : "Fully paid"}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selected && (
                <div className="mt-3 bg-teal-50 border border-teal-200 rounded-xl p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-teal-700 font-medium">Selected: {selected.bookingNumber}</span>
                    <button type="button" onClick={() => setSelected(null)} className="text-xs text-teal-500 hover:text-red-500">Change</button>
                  </div>
                  <p className="text-gray-600 mt-0.5">{selected.guestName} · Balance: <strong>₹{selected.balanceDue.toFixed(2)}</strong></p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Step 2: UPI details */}
          {selected && selected.balanceDue > 0 && (
            <Card>
              <CardHeader><h3 className="font-semibold text-gray-900">Step 2 — UPI Payment Details</h3></CardHeader>
              <CardBody className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount to collect</span>
                    <span className="text-xl font-bold text-gray-900">₹{selected.balanceDue.toFixed(2)}</span>
                  </div>
                </div>

                <Input
                  label="UTR / UPI Reference Number *"
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  placeholder="12-digit UTR or UPI ref"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Screenshot <span className="text-gray-400">(recommended)</span>
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    aria-label="Upload UPI payment screenshot"
                    title="Upload UPI payment screenshot"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 hover:border-teal-400 hover:bg-teal-50 text-sm text-gray-600 transition-colors w-full"
                  >
                    <Upload className="w-4 h-4" />
                    {screenshotName ? screenshotName : "Upload screenshot"}
                  </button>
                  {screenshot && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={screenshot} alt="Screenshot preview" className="mt-2 max-h-32 rounded-lg border" />
                  )}
                </div>

                <Button
                  onClick={handleSubmit}
                  loading={submitting}
                  disabled={!upiRef.trim()}
                  className="w-full"
                >
                  Submit for Verification
                </Button>
              </CardBody>
            </Card>
          )}

          {selected && selected.balanceDue <= 0 && (
            <Card>
              <CardBody className="py-6 text-center">
                <p className="text-green-700 font-semibold">This booking is already fully paid.</p>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
