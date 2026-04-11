import { InquiryForm } from "@/components/website/InquiryForm";

export default function InquiryPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)]">Group Inquiry</h1>
      <p className="text-[var(--color-text-muted)]">
        Planning a corporate event, school trip or celebration? Share details and we will call you back.
      </p>
      <InquiryForm />
    </div>
  );
}
