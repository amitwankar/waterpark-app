import { Badge } from "@/components/ui/Badge";

export interface ZoneTabsProps {
  zones: Array<{ id: string; name: string }>;
  activeZoneId?: string;
  basePath: string;
  showAll?: boolean;
  onChange?: (zoneId: string) => void;
}

export function ZoneTabs({ zones, activeZoneId, basePath, showAll = true, onChange }: ZoneTabsProps): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {showAll ? (
        onChange ? (
          <button type="button" onClick={() => onChange("")}>
            <Badge variant={!activeZoneId ? "info" : "default"}>All</Badge>
          </button>
        ) : (
          <a href={basePath}>
            <Badge variant={!activeZoneId ? "info" : "default"}>All</Badge>
          </a>
        )
      ) : null}
      {zones.map((zone) => (
        onChange ? (
          <button key={zone.id} type="button" onClick={() => onChange(zone.id)}>
            <Badge variant={activeZoneId === zone.id ? "info" : "default"}>{zone.name}</Badge>
          </button>
        ) : (
          <a key={zone.id} href={`${basePath}?zoneId=${zone.id}`}>
            <Badge variant={activeZoneId === zone.id ? "info" : "default"}>{zone.name}</Badge>
          </a>
        )
      ))}
    </div>
  );
}
