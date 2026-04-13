import Link from "next/link";
import { requireSubRole } from "@/lib/session";
import { redirect } from "next/navigation";

/**
 * /staff/pos — POS Hub. Lets staff choose which terminal to open.
 */
export default async function PosHubPage() {
  const { user, error } = await requireSubRole(
    "TICKET_COUNTER",
    "FB_STAFF",
    "LOCKER_ATTENDANT",
    "COSTUME_ATTENDANT",
    "PARKING_ATTENDANT",
    "SALES_EXECUTIVE"
  );
  if (error) redirect("/login");

  const subRole = (user as { subRole?: string }).subRole;

  const terminals = [
    {
      href: "/staff/pos/ticket",
      label: "Gate / Ticket Counter",
      description: "Walk-in ticket sales, balance collection, and guest check-in.",
      icon: "🎟",
      color: "teal",
      allowed: ["TICKET_COUNTER", "SALES_EXECUTIVE"],
    },
    {
      href: "/staff/pos/food",
      label: "Food & Beverage",
      description: "Process food orders, issue tokens, and manage outlet billing.",
      icon: "🍔",
      color: "orange",
      allowed: ["FB_STAFF"],
    },
    {
      href: "/staff/pos/locker",
      label: "Locker Counter",
      description: "Assign and release lockers with payment collection.",
      icon: "🔐",
      color: "indigo",
      allowed: ["LOCKER_ATTENDANT"],
    },
    {
      href: "/staff/pos/costume",
      label: "Costume Rental",
      description: "Issue and return costumes; collect rental fee and deposit.",
      icon: "👘",
      color: "purple",
      allowed: ["COSTUME_ATTENDANT"],
    },
    {
      href: "/staff/pos/parking",
      label: "Parking Counter",
      description: "Entry/exit parking management with bill printing.",
      icon: "🅿️",
      color: "slate",
      allowed: ["PARKING_ATTENDANT", "SECURITY_STAFF"],
    },
  ];

  const available = terminals.filter(
    (t) => !subRole || t.allowed.includes(subRole)
  );

  const colorMap: Record<string, string> = {
    teal: "border-teal-400/50 bg-teal-500/10 hover:bg-teal-500/20",
    orange: "border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20",
    indigo: "border-indigo-400/50 bg-indigo-500/10 hover:bg-indigo-500/20",
    purple: "border-violet-400/50 bg-violet-500/10 hover:bg-violet-500/20",
    slate: "border-slate-400/50 bg-slate-500/10 hover:bg-slate-500/20",
  };

  const iconBg: Record<string, string> = {
    teal: "bg-teal-500/20 text-teal-300",
    orange: "bg-amber-500/20 text-amber-300",
    indigo: "bg-indigo-500/20 text-indigo-300",
    purple: "bg-violet-500/20 text-violet-300",
    slate: "bg-slate-500/20 text-slate-300",
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-5">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Point Of Sale</p>
            <h1 className="mt-1 text-2xl font-bold text-[var(--color-text)]">POS Terminal Hub</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Open a terminal based on your role. Session controls, billing, and operational actions are available inside each terminal.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2 text-right">
            <p className="text-xs text-[var(--color-text-muted)]">Logged in role</p>
            <p className="text-sm font-semibold text-[var(--color-text)]">{subRole ?? "STAFF"}</p>
          </div>
        </div>
      </section>

      <section className="grid flex-1 auto-rows-min gap-4 overflow-auto pb-2 sm:grid-cols-2 xl:grid-cols-4">
        {available.map((terminal) => (
          <Link
            key={terminal.href}
            href={terminal.href}
            className={`group relative flex min-h-44 flex-col rounded-2xl border p-4 transition-all duration-150 ${colorMap[terminal.color]}`}
          >
            <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${iconBg[terminal.color]}`}>
              {terminal.icon}
            </div>
            <p className="text-base font-semibold text-[var(--color-text)]">{terminal.label}</p>
            <p className="mt-1 text-sm leading-5 text-[var(--color-text-muted)]">{terminal.description}</p>

            <div className="mt-auto flex items-center justify-between pt-3">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Open Terminal</span>
              <svg
                className="h-5 w-5 text-[var(--color-text-muted)] transition-transform duration-150 group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}

        {available.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-[var(--shadow-card)]">
            <p className="text-base font-semibold text-[var(--color-text)]">No POS terminals assigned</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Contact admin to map your staff sub-role to a POS terminal.</p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 pb-1 md:grid-cols-3">
        {[
          { title: "Fast Billing", value: "Ticket + add-ons in one flow" },
          { title: "Session Safe", value: "Open/close drawer with audit trail" },
          { title: "Scan Ready", value: "Integrated QR and ride validation" },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{item.title}</p>
            <p className="mt-1 text-sm font-medium text-[var(--color-text)]">{item.value}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
