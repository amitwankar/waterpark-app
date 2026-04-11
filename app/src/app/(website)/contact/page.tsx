import { InquiryForm } from "@/components/website/InquiryForm";
import { getCachedSettings } from "@/lib/settings";

export default async function ContactPage(): Promise<JSX.Element> {
  const settings = await getCachedSettings();

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)]">Contact Us</h1>
        <p className="text-[var(--color-text-muted)]">Reach us for bookings, school trips, corporate events and support.</p>
        <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm">
          <p>
            <span className="font-medium text-[var(--color-text)]">Park:</span> {settings.parkName}
          </p>
          <p>
            <span className="font-medium text-[var(--color-text)]">Address:</span>{" "}
            {settings.address ?? "Hingna Road, Nagpur, Maharashtra"}
          </p>
          <p>
            <span className="font-medium text-[var(--color-text)]">Phone:</span> {settings.phone ?? "+91 90000 00000"}
          </p>
          <p>
            <span className="font-medium text-[var(--color-text)]">Email:</span> {settings.email ?? "hello@aquaworld.com"}
          </p>
        </div>
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <iframe
            title="AquaWorld location"
            className="h-72 w-full"
            loading="lazy"
            src="https://www.google.com/maps?q=Hingna+Road+Nagpur+Maharashtra&output=embed"
          />
        </div>
      </section>
      <section>
        <InquiryForm />
      </section>
    </div>
  );
}
