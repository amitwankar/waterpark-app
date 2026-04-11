export interface BookingQrPayload {
  bookingId: string;
  bookingNumber: string;
  visitDate: string;
}

export function generateBookingQrContent(payload: BookingQrPayload): string {
  return JSON.stringify({
    bookingId: payload.bookingId,
    bookingNumber: payload.bookingNumber,
    visitDate: payload.visitDate,
  });
}

export function parseBookingQrContent(value: string): BookingQrPayload | null {
  try {
    const parsed = JSON.parse(value) as Partial<BookingQrPayload>;
    if (!parsed.bookingId || !parsed.bookingNumber || !parsed.visitDate) {
      return null;
    }
    return {
      bookingId: parsed.bookingId,
      bookingNumber: parsed.bookingNumber,
      visitDate: parsed.visitDate,
    };
  } catch {
    return null;
  }
}

