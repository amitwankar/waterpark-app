import { Badge } from "@/components/ui/Badge";

export interface WarrantyBadgeProps {
  warrantyExpiry?: string | Date | null;
}

export function WarrantyBadge({ warrantyExpiry }: WarrantyBadgeProps): JSX.Element {
  if (!warrantyExpiry) return <Badge variant="default">NO_WARRANTY</Badge>;

  const expiry = new Date(warrantyExpiry);
  if (Number.isNaN(expiry.getTime())) return <Badge variant="default">NO_WARRANTY</Badge>;

  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const diff = Math.ceil((expiry.getTime() - now.getTime()) / day);

  if (diff < 0) return <Badge variant="danger">EXPIRED</Badge>;
  if (diff <= 30) return <Badge variant="warning">EXPIRING</Badge>;
  return <Badge variant="success">VALID</Badge>;
}
