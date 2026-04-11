import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/Button";

interface Props {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

export function ReportCard({ href, icon: Icon, title, description }: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-primary)]/10">
          <Icon className="h-5 w-5 text-[var(--color-primary)]" />
        </div>
        <div>
          <h3 className="font-semibold text-[var(--color-text)]">{title}</h3>
          <p className="text-sm text-[var(--color-muted)]">{description}</p>
        </div>
      </div>
      <Link href={href} className="mt-auto">
        <Button variant="outline" size="sm" className="w-full">
          View Report
        </Button>
      </Link>
    </div>
  );
}
