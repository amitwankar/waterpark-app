import { Phone, MessageCircleMore } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

export interface LeadCardData {
  id: string;
  name: string;
  mobile: string;
  source: string;
  groupSize: number | null;
  budgetEstimate: number | null;
  followUpAt: string | null;
}

export interface LeadCardProps {
  lead: LeadCardData;
  overdue: boolean;
}

export function LeadCard({ lead, overdue }: LeadCardProps): JSX.Element {
  return (
    <Card className={overdue ? "border-red-300" : undefined}>
      <CardBody className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--color-text)]">{lead.name}</p>
          <Badge variant="info">{lead.source}</Badge>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">{lead.mobile}</p>
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <span>Group: {lead.groupSize ?? "-"}</span>
          <span>Budget: {lead.budgetEstimate ? `Rs ${lead.budgetEstimate.toFixed(0)}` : "-"}</span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Follow-up: {lead.followUpAt ? new Date(lead.followUpAt).toLocaleDateString("en-IN") : "-"}
        </p>

        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
            <Phone className="h-3.5 w-3.5" />
            Call
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
            <MessageCircleMore className="h-3.5 w-3.5" />
            WhatsApp
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
