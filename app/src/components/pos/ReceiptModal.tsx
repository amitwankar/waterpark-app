"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "react-qr-code";

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
}

interface PaymentLine {
  method: string;
  amount: number;
}

interface Receipt {
  receiptNumber: string;
  type: "booking" | "food" | "locker";
  bookingId?: string | null;
  parkName: string;
  terminalId: string;
  cashierName: string;
  guestName?: string;
  guestMobile?: string;
  items: ReceiptItem[];
  subtotal: number;
  gstAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentLines: PaymentLine[];
  createdAt: string;
  qrCode?: string;
}

interface ReceiptModalProps {
  /** booking/food/locker order ref (id or number) */
  receiptId: string;
  type?: "booking" | "food" | "locker";
  onClose: () => void;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  MANUAL_UPI: "UPI",
  CARD: "Card",
  COMPLIMENTARY: "Complimentary",
};

export function ReceiptModal({ receiptId: receiptRef, type = "booking", onClose }: ReceiptModalProps) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/pos/receipts/${receiptRef}?type=${type}`);
        if (!res.ok) throw new Error("Receipt not found");
        setReceipt(await res.json());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load receipt");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [receiptRef, type]);

  function handlePrint() {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank", "width=400,height=700");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt ${receipt?.receiptNumber ?? ""}</title>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 0; padding: 16px; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .total { font-size: 14px; font-weight: bold; }
          </style>
        </head>
        <body>${printRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }

  async function handleWhatsApp() {
    if (!receipt) return;
    const text = buildWhatsAppText(receipt);
    const encoded = encodeURIComponent(text);
    const mobile = receipt.guestMobile?.replace(/\D/g, "");
    const url = mobile
      ? `https://wa.me/${mobile.startsWith("91") ? mobile : "91" + mobile}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  }

  function buildWhatsAppText(r: Receipt): string {
    const lines = [
      `*${r.parkName}*`,
      `Receipt: ${r.receiptNumber}`,
      r.bookingId ? `Booking ID: ${r.bookingId}` : null,
      `Date: ${new Date(r.createdAt).toLocaleString()}`,
      ``,
      `*Items:*`,
      ...r.items.map((i) => `${i.name} × ${i.quantity}  ₹${(i.unitPrice * i.quantity).toFixed(2)}`),
      ``,
      `Subtotal: ₹${r.subtotal.toFixed(2)}`,
      r.gstAmount > 0 ? `GST: ₹${r.gstAmount.toFixed(2)}` : null,
      r.discountAmount > 0 ? `Discount: -₹${r.discountAmount.toFixed(2)}` : null,
      `*Total: ₹${r.totalAmount.toFixed(2)}*`,
      ``,
      `*Payment:*`,
      ...r.paymentLines.map((pl) => `${METHOD_LABELS[pl.method] ?? pl.method}: ₹${pl.amount.toFixed(2)}`),
      ``,
      `Thank you for visiting ${r.parkName}!`,
    ]
      .filter((l) => l !== null)
      .join("\n");
    return lines;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Receipt</h2>
          <button type="button" title="Close" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {loading && <p className="text-sm text-center text-gray-500 py-6">Loading receipt…</p>}
          {error && <p className="text-sm text-center text-red-500 py-6">{error}</p>}
          {receipt && (
            <div ref={printRef} className="font-mono text-xs space-y-1">
              <div className="text-center space-y-0.5 mb-3">
                <p className="text-sm font-bold">{receipt.parkName}</p>
                <p className="text-gray-500">Terminal: {receipt.terminalId}</p>
                <p className="text-gray-500">{new Date(receipt.createdAt).toLocaleString()}</p>
                <p className="font-medium">#{receipt.receiptNumber}</p>
                {receipt.bookingId && <p className="text-gray-500">Booking ID: {receipt.bookingId}</p>}
              </div>

              {(receipt.guestName || receipt.guestMobile) && (
                <div className="border-t border-dashed border-gray-300 pt-2 mb-2">
                  {receipt.guestName && <p>Guest: {receipt.guestName}</p>}
                  {receipt.guestMobile && <p>Mobile: {receipt.guestMobile}</p>}
                </div>
              )}

              <div className="border-t border-dashed border-gray-300 pt-2 space-y-0.5">
                {receipt.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="flex-1 truncate">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="ml-2">₹{(item.unitPrice * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-gray-300 pt-2 space-y-0.5">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{receipt.subtotal.toFixed(2)}</span>
                </div>
                {receipt.gstAmount > 0 && (
                  <div className="flex justify-between">
                    <span>GST</span>
                    <span>₹{receipt.gstAmount.toFixed(2)}</span>
                  </div>
                )}
                {receipt.discountAmount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Discount</span>
                    <span>-₹{receipt.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm border-t border-dashed border-gray-300 pt-1 mt-1">
                  <span>TOTAL</span>
                  <span>₹{receipt.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-gray-300 pt-2 space-y-0.5">
                <p className="font-semibold text-gray-700 mb-1">Payment Split</p>
                {receipt.paymentLines.map((pl, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{METHOD_LABELS[pl.method] ?? pl.method}</span>
                    <span>₹{pl.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold border-t border-dashed border-gray-300 pt-1 mt-1">
                  <span>Total Paid</span>
                  <span>₹{receipt.paymentLines.reduce((sum, line) => sum + line.amount, 0).toFixed(2)}</span>
                </div>
              </div>

              {receipt.qrCode && (
                <div className="border-t border-dashed border-gray-300 pt-3 text-center space-y-1">
                  <p className="text-gray-500 text-xs mb-2">Entry QR — show at gate</p>
                  <div className="inline-block bg-white p-2 border border-gray-200 rounded">
                    <QRCode value={receipt.qrCode} size={120} />
                  </div>
                  <p className="text-gray-400 text-xs">{receipt.receiptNumber}</p>
                </div>
              )}

              <div className="text-center pt-3 text-gray-500">
                <p>Cashier: {receipt.cashierName}</p>
                <p className="mt-1">Thank you for visiting!</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {receipt && (
          <div className="px-5 pb-5 flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            {receipt.guestMobile && (
              <button
                type="button"
                onClick={handleWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.116.555 4.103 1.524 5.827L.057 23.857a.5.5 0 00.607.61l6.162-1.607A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.91 0-3.693-.54-5.206-1.47l-.374-.22-3.87 1.009 1.034-3.776-.241-.39A9.956 9.956 0 012 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z"/>
                </svg>
                WhatsApp
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              Done
            </button>
          </div>
        )}

        {!receipt && !loading && (
          <div className="px-5 pb-5">
            <button type="button" onClick={onClose} className="w-full border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
