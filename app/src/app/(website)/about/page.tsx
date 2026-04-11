import { db } from "@/lib/db";

async function getAboutData() {
  "use cache";

  const [zones, team] = await Promise.all([
    db.zone.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.user.findMany({
      where: { role: "EMPLOYEE", isActive: true, isDeleted: false },
      select: { id: true, name: true, subRole: true },
      take: 6,
    }),
  ]);

  return { zones, team };
}

export default async function AboutPage(): Promise<JSX.Element> {
  const { zones, team } = await getAboutData();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)]">Our Story</h1>
          <p className="text-[var(--color-text-muted)]">
            AquaWorld was created as a destination where families, schools and teams can enjoy clean, safe and memorable water experiences.
          </p>
          <p className="text-[var(--color-text-muted)]">
            We continuously improve ride safety, queue management and service quality across every zone in the park.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {zones.map((zone) => (
              <span key={zone.id} className="rounded-[var(--radius-full)] bg-[var(--color-primary-light)] px-3 py-1 text-xs font-medium text-[var(--color-primary)]">
                {zone.name}
              </span>
            ))}
          </div>
        </div>
        <img
          src="https://images.unsplash.com/photo-1527555197883-98e27ca0c1ea?auto=format&fit=crop&w=1400&q=80"
          alt="AquaWorld team and guests"
          className="h-full min-h-72 w-full rounded-[var(--radius-xl)] object-cover"
        />
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-semibold text-[var(--color-text)]">Core Team</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {team.map((member) => (
            <article key={member.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h3 className="font-semibold text-[var(--color-text)]">{member.name}</h3>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{member.subRole?.replaceAll("_", " ") ?? "Operations"}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
