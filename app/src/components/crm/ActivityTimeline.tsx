import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface ActivityTimelineItem {
  id: string;
  activityType: string;
  notes: string | null;
  createdAt: string;
  performerName: string;
}

export interface ActivityTimelineProps {
  items: ActivityTimelineItem[];
}

export function ActivityTimeline({ items }: ActivityTimelineProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Activity Timeline</h3>
      </CardHeader>
      <CardBody>
        <ol className="space-y-3">
          {items.length === 0 ? <li className="text-sm text-[var(--color-text-muted)]">No activity yet.</li> : null}
          {items.map((item) => (
            <li key={item.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>{item.activityType}</span>
                <span>{new Date(item.createdAt).toLocaleString("en-IN")}</span>
              </div>
              <p className="mt-1 text-sm text-[var(--color-text)]">{item.notes ?? "-"}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">By {item.performerName}</p>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
