/**
 * Receipt data builder — server-only.
 * Returns a serializable receipt object used by the frontend ReceiptModal
 * for printing and by the API for PDF/WhatsApp delivery.
 */
import "server-only";

import { db } from "@/lib/db";

export interface ReceiptLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  lineTotal: number;
}

export interface Receipt {
  receiptNumber: string;
  type: "TICKET" | "FOOD" | "LOCKER";
  bookingId?: string | null;
  parkName: string;
  terminalId: string | null;
  cashierName: string | null;
  guestName: string;
  guestMobile: string | null;
  items: ReceiptLineItem[];
  subtotal: number;
  gstAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentLines: Array<{ method: string; amount: number }>;
  createdAt: string;
  qrCode?: string | null; // for booking receipts
}

/** Build receipt data from a booking's transactions. */
export async function buildBookingReceipt(bookingId: string): Promise<Receipt | null> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      bookingTickets: {
        include: { ticketType: { select: { name: true } } },
      },
      transactions: {
        where: { status: "PAID" },
        include: { posSession: { include: { staff: { select: { name: true } } } } },
      },
    },
  });

  if (!booking) return null;

  const [parkConfig, foodOrders, lockerAssignments, costumeRentals] = await Promise.all([
    db.parkConfig.findFirst({
      select: { parkName: true, lockerGstRate: true },
    }),
    db.foodOrder.findMany({
      where: { bookingId },
      include: { orderItems: true },
    }),
    db.lockerAssignment.findMany({
      where: { bookingId },
      include: { locker: { include: { zone: { select: { name: true } } } } },
    }),
    db.costumeRental.findMany({
      where: { bookingId },
      include: { costumeItem: { select: { name: true, gstRate: true } } },
    }),
  ]);

  const items: ReceiptLineItem[] = booking.bookingTickets.map((bt) => ({
    name: bt.ticketType.name,
    quantity: bt.quantity,
    unitPrice: Number(bt.unitPrice),
    gstRate: Number(bt.gstRate),
    lineTotal: Number(bt.unitPrice) * bt.quantity,
  }));
  for (const order of foodOrders) {
    for (const item of order.orderItems) {
      const baseTotal = Number(item.unitPrice) * item.quantity;
      const gstRate = Number(item.gstRate ?? 0);
      const lineTotal = baseTotal * (1 + gstRate / 100);
      items.push({
        name: item.variantName ? `${item.name} · ${item.variantName}` : item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        gstRate,
        lineTotal,
      });
    }
  }

  for (const assignment of lockerAssignments) {
    const amount = Number(assignment.amount);
    const lockerGstRate = Number(
      (assignment.locker as { gstRate?: number | string }).gstRate ?? parkConfig?.lockerGstRate ?? 0,
    );
    const baseAmount = lockerGstRate > 0 ? amount / (1 + lockerGstRate / 100) : amount;
    const zoneName = assignment.locker.zone?.name ?? "Zone";
    items.push({
      name: `Locker ${assignment.locker.number} (${zoneName})`,
      quantity: 1,
      unitPrice: baseAmount,
      gstRate: lockerGstRate,
      lineTotal: amount,
    });
  }

  for (const rental of costumeRentals) {
    const gstRate = Number(rental.costumeItem?.gstRate ?? 0);
    const baseAmount = Number(rental.rentalAmount);
    items.push({
      name: rental.costumeItem?.name ?? "Costume Rental",
      quantity: 1,
      unitPrice: baseAmount,
      gstRate,
      lineTotal: baseAmount * (1 + gstRate / 100),
    });
  }

  const firstSession = booking.transactions[0]?.posSession;

  return {
    receiptNumber: booking.bookingNumber,
    type: "TICKET",
    bookingId: booking.id,
    parkName: parkConfig?.parkName ?? "Waterpark",
    terminalId: firstSession?.terminalId ?? null,
    cashierName: firstSession?.staff.name ?? null,
    guestName: booking.guestName,
    guestMobile: booking.guestMobile,
    items,
    subtotal: Number(booking.subtotal),
    gstAmount: Number(booking.gstAmount),
    discountAmount: Number(booking.discountAmount),
    totalAmount: Number(booking.totalAmount),
    paymentLines: booking.transactions.map((t) => ({
      method: t.method,
      amount: Number(t.amount),
    })),
    createdAt: booking.createdAt.toISOString(),
    qrCode: booking.qrCode,
  };
}

/** Build receipt for a food order. */
export async function buildFoodReceipt(orderId: string): Promise<Receipt | null> {
  const order = await db.foodOrder.findUnique({
    where: { id: orderId },
    include: {
      orderItems: true,
      outlet: { select: { name: true } },
      staff: { select: { name: true } },
    },
  });
  if (!order) return null;

  const parkConfig = await db.parkConfig.findFirst({ select: { parkName: true } });

  return {
    receiptNumber: `F-${order.token ?? order.id.slice(-6).toUpperCase()}`,
    type: "FOOD",
    parkName: parkConfig?.parkName ?? "Waterpark",
    terminalId: order.outlet.name,
    cashierName: order.staff?.name ?? null,
    guestName: order.guestName,
    guestMobile: order.guestMobile ?? null,
    items: order.orderItems.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      gstRate: Number(i.gstRate),
      lineTotal: Number(i.totalPrice),
    })),
    subtotal: Number(order.subtotal),
    gstAmount: Number(order.gstAmount),
    discountAmount: 0,
    totalAmount: Number(order.totalAmount),
    paymentLines: [{ method: order.paymentMethod, amount: Number(order.totalAmount) }],
    createdAt: order.createdAt.toISOString(),
  };
}

/** Build receipt for a locker assignment. */
export async function buildLockerReceipt(assignmentId: string): Promise<Receipt | null> {
  const assignment = await db.lockerAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      locker: { include: { zone: { select: { name: true } } } },
      assignedBy: { select: { name: true } },
    },
  });
  if (!assignment) return null;

  const parkConfig = await db.parkConfig.findFirst({ select: { parkName: true } });

  return {
    receiptNumber: `L-${assignment.id.slice(-6).toUpperCase()}`,
    type: "LOCKER",
    parkName: parkConfig?.parkName ?? "Waterpark",
    terminalId: "LOCKER",
    cashierName: assignment.assignedBy.name,
    guestName: assignment.guestName,
    guestMobile: assignment.guestMobile,
    items: [
      {
        name: `Locker ${assignment.locker.number} (${assignment.locker.zone.name}) — ${assignment.durationType}`,
        quantity: 1,
        unitPrice: Number(assignment.amount) /
          (1 + Number((assignment.locker as { gstRate?: number | string }).gstRate ?? 0) / 100),
        gstRate: Number((assignment.locker as { gstRate?: number | string }).gstRate ?? 0),
        lineTotal: Number(assignment.amount),
      },
    ],
    subtotal:
      Number(assignment.amount) /
      (1 + Number((assignment.locker as { gstRate?: number | string }).gstRate ?? 0) / 100),
    gstAmount:
      Number(assignment.amount) -
      Number(assignment.amount) /
        (1 + Number((assignment.locker as { gstRate?: number | string }).gstRate ?? 0) / 100),
    discountAmount: 0,
    totalAmount: Number(assignment.amount),
    paymentLines: [{ method: assignment.paymentMethod, amount: Number(assignment.amount) }],
    createdAt: assignment.createdAt.toISOString(),
  };
}
