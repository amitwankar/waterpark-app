import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

export interface FollowUpDueCardProps {
  count: number;
  overdueMoreThanOneDay: number;
}

export function FollowUpDueCard({ count, overdueMoreThanOneDay }: FollowUpDueCardProps): JSX.Element {
  if (count <= 0) {
    return (
      <Card>
        <CardBody className="flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-text-muted)]">No follow-ups due right now.</p>
          <Badge variant="success">All clear</Badge>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border-red-300">
      <CardBody className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">Follow-ups due: {count}</p>
          <p className="text-xs text-[var(--color-text-muted)]">Overdue &gt;1 day: {overdueMoreThanOneDay}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={overdueMoreThanOneDay > 0 ? "danger" : "warning"}>{overdueMoreThanOneDay > 0 ? "Overdue" : "Due today"}</Badge>
          <Link href="/admin/crm/leads?followUpDue=1">
            <Button size="sm" variant="outline">View leads</Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
