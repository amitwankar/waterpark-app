import { Badge } from "@/components/ui/Badge";

export interface TierBadgeProps {
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
}

function variantForTier(tier: TierBadgeProps["tier"]): "default" | "success" | "warning" | "danger" | "info" {
  if (tier === "PLATINUM") return "info";
  if (tier === "GOLD") return "warning";
  if (tier === "SILVER") return "success";
  return "default";
}

export function TierBadge({ tier }: TierBadgeProps): JSX.Element {
  return <Badge variant={variantForTier(tier)}>{tier}</Badge>;
}
