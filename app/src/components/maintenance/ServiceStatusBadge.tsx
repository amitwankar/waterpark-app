import { Badge } from "@/components/ui/Badge";

export interface ServiceStatusBadgeProps {
  nextServiceDate?: string | Date | null;
}

function statusFromDate(nextServiceDate?: string | Date | null): "ON_TRACK" | "DUE_SOON" | "OVERDUE" {
  if (!nextServiceDate) return "ON_TRACK";
  const date = new Date(nextServiceDate);
  if (Number.isNaN(date.getTime())) return "ON_TRACK";
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const diff = Math.ceil((date.getTime() - now.getTime()) / day);
  if (diff < 0) return "OVERDUE";
  if (diff <= 7) return "DUE_SOON";
  return "ON_TRACK";
}

export function ServiceStatusBadge({ nextServiceDate }: ServiceStatusBadgeProps): JSX.Element {
  const status = statusFromDate(nextServiceDate);

  if (status === "OVERDUE") {
    return <Badge variant="danger">OVERDUE</Badge>;
  }
  if (status === "DUE_SOON") {
    return <Badge variant="warning">DUE_SOON</Badge>;
  }
  return <Badge variant="success">ON_TRACK</Badge>;
}
