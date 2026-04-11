import { Badge } from "@/components/ui/Badge";

export interface PriorityBadgeProps {
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  pulseCritical?: boolean;
}

export function PriorityBadge({ priority, pulseCritical = true }: PriorityBadgeProps): JSX.Element {
  if (priority === "CRITICAL") {
    return <Badge variant="danger" className={pulseCritical ? "animate-pulse" : ""}>CRITICAL</Badge>;
  }
  if (priority === "HIGH") {
    return <Badge variant="warning">HIGH</Badge>;
  }
  if (priority === "MEDIUM") {
    return <Badge variant="info">MEDIUM</Badge>;
  }
  return <Badge variant="default">LOW</Badge>;
}
