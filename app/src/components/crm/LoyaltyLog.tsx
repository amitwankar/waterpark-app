import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface LoyaltyLogItem {
  id: string;
  type: "EARN" | "REDEEM" | "EXPIRE" | "ADJUST";
  points: number;
  description: string | null;
  createdAt: string;
}

export interface LoyaltyLogProps {
  items: LoyaltyLogItem[];
}

export function LoyaltyLog({ items }: LoyaltyLogProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Loyalty Log</h3>
      </CardHeader>
      <CardBody>
        <div className="space-y-2">
          {items.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">No loyalty transactions found.</p> : null}
          {items.map((item) => (
            <div key={item.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-[var(--color-text)]">{item.type}</p>
                <p className={item.points >= 0 ? "text-green-600" : "text-red-600"}>{item.points >= 0 ? `+${item.points}` : item.points} pts</p>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.description ?? "-"}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{new Date(item.createdAt).toLocaleString("en-IN")}</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
