import { Badge } from "@/components/ui/Badge";

export interface WaitTimeBadgeProps {
  waitTimeMin: number;
}

export function WaitTimeBadge({ waitTimeMin }: WaitTimeBadgeProps): JSX.Element {
  if (waitTimeMin <= 0) return <Badge variant="success">No wait</Badge>;
  if (waitTimeMin <= 15) return <Badge variant="info">{waitTimeMin} min</Badge>;
  if (waitTimeMin <= 35) return <Badge variant="warning">{waitTimeMin} min</Badge>;
  return <Badge variant="danger">{waitTimeMin} min</Badge>;
}
