import Link from "next/link";

import { TierBadge } from "@/components/crm/TierBadge";
import { TagChips } from "@/components/crm/TagChips";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface GuestTableRow {
  id: string;
  name: string;
  mobile: string;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  totalVisits: number;
  totalSpend: number;
  loyaltyPoints: number;
  lastVisitDate: string | null;
  tags: string[];
}

export interface GuestTableProps {
  rows: GuestTableRow[];
}

export function GuestTable({ rows }: GuestTableProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Guest Profiles</h3>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
              <th className="py-2 pr-2">Name</th>
              <th className="py-2 pr-2">Mobile</th>
              <th className="py-2 pr-2">Tier</th>
              <th className="py-2 pr-2">Visits</th>
              <th className="py-2 pr-2">Spend</th>
              <th className="py-2 pr-2">Points</th>
              <th className="py-2 pr-2">Last Visit</th>
              <th className="py-2 pr-2">Tags</th>
              <th className="py-2 pr-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--color-border)] last:border-b-0">
                <td className="py-2 pr-2 text-[var(--color-text)]">{row.name}</td>
                <td className="py-2 pr-2">{row.mobile}</td>
                <td className="py-2 pr-2"><TierBadge tier={row.tier} /></td>
                <td className="py-2 pr-2">{row.totalVisits}</td>
                <td className="py-2 pr-2">Rs {row.totalSpend.toFixed(0)}</td>
                <td className="py-2 pr-2">{row.loyaltyPoints}</td>
                <td className="py-2 pr-2">{row.lastVisitDate ? new Date(row.lastVisitDate).toLocaleDateString("en-IN") : "-"}</td>
                <td className="py-2 pr-2 max-w-64">
                  <TagChips tags={row.tags} />
                </td>
                <td className="py-2 pr-2">
                  <Link href={`/admin/crm/guests/${row.id}`} className="text-[var(--color-primary)] underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
