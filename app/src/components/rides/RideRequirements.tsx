import { Badge } from "@/components/ui/Badge";

export interface RideRequirementsProps {
  minHeight: number | null;
  maxWeight: number | null;
  compact?: boolean;
}

export function RideRequirements({ minHeight, maxWeight, compact = false }: RideRequirementsProps): JSX.Element {
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      {minHeight ? <Badge variant="info">Min Height: {minHeight} cm</Badge> : <Badge variant="default">No height limit</Badge>}
      {maxWeight ? <Badge variant="warning">Max Weight: {maxWeight} kg</Badge> : <Badge variant="default">No weight limit</Badge>}
    </div>
  );
}
