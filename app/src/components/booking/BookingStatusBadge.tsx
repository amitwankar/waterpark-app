import { Badge } from "@/components/ui/Badge";

export interface BookingStatusBadgeProps {
  status: "PENDING" | "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED" | string;
}

export function BookingStatusBadge({ status }: BookingStatusBadgeProps): JSX.Element {
  if (status === "CONFIRMED") {
    return <Badge variant="success">CONFIRMED</Badge>;
  }
  if (status === "CHECKED_IN") {
    return <Badge variant="info">CHECKED_IN</Badge>;
  }
  if (status === "COMPLETED") {
    return <Badge variant="default">COMPLETED</Badge>;
  }
  if (status === "CANCELLED") {
    return <Badge variant="danger">CANCELLED</Badge>;
  }
  return <Badge variant="warning">{status}</Badge>;
}

