import { RideCard, type RideCardProps } from "@/components/rides/RideCard";

export interface RideGridProps {
  rides: RideCardProps["ride"][];
  adminMode?: boolean;
  onEdit?: (ride: RideCardProps["ride"]) => void;
  onChanged?: () => void;
}

export function RideGrid({ rides, adminMode = false, onEdit, onChanged }: RideGridProps): JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rides.map((ride) => (
        <RideCard key={ride.id} ride={ride} adminMode={adminMode} onEdit={onEdit} onChanged={onChanged} />
      ))}
    </div>
  );
}
