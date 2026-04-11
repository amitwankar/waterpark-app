import { Badge } from "@/components/ui/Badge";

type CostumeStatus = "AVAILABLE" | "RENTED" | "RETURNED" | "MAINTENANCE";

const CONFIG: Record<CostumeStatus, { label: string; variant: "success" | "warning" | "info" | "danger" }> = {
  AVAILABLE:   { label: "Available",   variant: "success" },
  RENTED:      { label: "Rented",      variant: "warning" },
  RETURNED:    { label: "Returned",    variant: "info" },
  MAINTENANCE: { label: "Maintenance", variant: "danger" },
};

export function CostumeStatusBadge({ status }: { status: CostumeStatus }) {
  const cfg = CONFIG[status] ?? { label: status, variant: "info" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
