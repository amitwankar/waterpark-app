import { NextResponse } from "next/server";

import { getSettings } from "@/lib/settings";
import { requireSubRole } from "@/lib/session";

export async function GET() {
  const { error } = await requireSubRole("TICKET_COUNTER", "SALES_EXECUTIVE");
  if (error) return error;

  const config = await getSettings();

  const methods = [
    { value: "CASH", label: "Cash", icon: "💵", enabled: true },
    { value: "CARD", label: "Card", icon: "💳", enabled: true },
    { value: "COMPLIMENTARY", label: "Complimentary", icon: "🎁", enabled: true },
    {
      value: "MANUAL_UPI",
      label: "UPI",
      icon: "📱",
      enabled: Boolean(config.manualUpiEnabled),
    },
  ] as const;

  return NextResponse.json({
    methods: methods.filter((method) => method.enabled),
    split: {
      enabled: Boolean(config.splitEnabled),
      maxMethods: config.maxSplitMethods,
      minAmount: 10,
    },
    deposit: {
      enabled: Boolean(config.depositEnabled),
      percent: Number(config.depositPercent),
      label: config.depositLabel,
    },
    idProof: {
      enabled: Boolean(config.idProofEnabled),
      requiredAbove: config.idProofRequiredAbove,
    },
  });
}
