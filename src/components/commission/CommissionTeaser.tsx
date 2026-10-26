// The one way in from Sponsors: a quiet card that opens the commission walkthrough.

import Link from "next/link";

export function CommissionTeaser() {
  return (
    <section aria-label="One commission, three cities" className="mx-auto w-full max-w-[1320px] px-4 pb-16 sm:px-6 lg:px-8">
      <Link href="/commission" data-testid="commission-entry" className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <span className="min-w-0 max-w-[720px]">
          <span className="eyebrow block">One buyer, start to finish</span>
          <span className="t-card mt-1 block">One commission, three cities</span>
          <span className="mt-1 block text-[14.5px] leading-snug text-muted">A buyer pays for six weeks of walks in three of your cities. Can the cities deliver it, does it pay, and what proof brings the buyer back?</span>
        </span>
        <span className="tap inline-flex items-center rounded-full border border-line-strong px-4 text-[13.5px] font-bold">Open it →</span>
      </Link>
    </section>
  );
}
