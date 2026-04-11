import Link from "next/link";

interface WebsiteFooterProps {
  parkName: string;
}

export function WebsiteFooter({ parkName }: WebsiteFooterProps): JSX.Element {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">{parkName}</h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Waterpark, family fun, corporate outings and events in Nagpur.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]">Quick Links</h4>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/packages" className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
              Packages
            </Link>
            <Link href="/offers" className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
              Offers
            </Link>
            <Link href="/inquiry" className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
              Group Inquiry
            </Link>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]">Need Help?</h4>
          <div className="mt-3 flex flex-col gap-2 text-sm text-[var(--color-text-muted)]">
            <p>Call: +91 90000 00000</p>
            <p>Email: hello@aquaworld.com</p>
            <p>Hingna Road, Nagpur, Maharashtra</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
