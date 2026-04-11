import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface CrmQuickStatsProps {
  leads: {
    total: number;
    convertedPercent: number;
    followUpsDueToday: number;
  };
  guests: {
    total: number;
    newThisMonth: number;
    tiers: Array<{ tier: string; count: number }>;
  };
}

export function CrmQuickStats({ leads, guests }: CrmQuickStatsProps): JSX.Element {
  const tierTotal = guests.tiers.reduce((acc, item) => acc + item.count, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-[var(--color-text)]">CRM Leads</h3>
        </CardHeader>
        <CardBody className="grid gap-2 text-sm sm:grid-cols-3">
          <p>Total: <span className="font-semibold text-[var(--color-text)]">{leads.total}</span></p>
          <p>Converted: <span className="font-semibold text-[var(--color-text)]">{leads.convertedPercent.toFixed(1)}%</span></p>
          <p className={leads.followUpsDueToday > 0 ? "text-red-600" : "text-[var(--color-text-muted)]"}>
            Follow-ups Today: <span className="font-semibold">{leads.followUpsDueToday}</span>
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-[var(--color-text)]">Guests</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>Total: <span className="font-semibold text-[var(--color-text)]">{guests.total}</span></p>
            <p>New This Month: <span className="font-semibold text-[var(--color-text)]">{guests.newThisMonth}</span></p>
          </div>

          <div className="space-y-2">
            {guests.tiers.map((tier) => {
              const percent = tierTotal > 0 ? (tier.count / tierTotal) * 100 : 0;
              return (
                <div key={tier.tier} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                    <span>{tier.tier}</span>
                    <span>{tier.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <progress
                      className="h-2 w-full appearance-none [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[var(--color-primary)] [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-[var(--color-primary)]"
                      value={percent}
                      max={100}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
