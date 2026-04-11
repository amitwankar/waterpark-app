export type CanonicalPaymentMethod =
  | "GATEWAY"
  | "MANUAL_UPI"
  | "CASH"
  | "CARD"
  | "WRISTBAND"
  | "COMPLIMENTARY";

const NORMALIZATION_MAP: Record<string, CanonicalPaymentMethod> = {
  GATEWAY: "GATEWAY",
  RAZORPAY: "GATEWAY",
  ONLINE: "GATEWAY",
  MANUAL_UPI: "MANUAL_UPI",
  UPI: "MANUAL_UPI",
  CASH: "CASH",
  CARD: "CARD",
  WRISTBAND: "WRISTBAND",
  COMPLIMENTARY: "COMPLIMENTARY",
};

const LABEL_MAP: Record<CanonicalPaymentMethod, string> = {
  GATEWAY: "Gateway",
  MANUAL_UPI: "Manual UPI",
  CASH: "Cash",
  CARD: "Card",
  WRISTBAND: "Wristband",
  COMPLIMENTARY: "Complimentary",
};

export function normalizePaymentMethod(method: string | null | undefined): CanonicalPaymentMethod | null {
  if (!method) return null;
  const key = method.trim().toUpperCase();
  return NORMALIZATION_MAP[key] ?? null;
}

export function paymentMethodLabel(method: string | null | undefined): string {
  const normalized = normalizePaymentMethod(method);
  if (!normalized) return method ?? "Unknown";
  return LABEL_MAP[normalized];
}
