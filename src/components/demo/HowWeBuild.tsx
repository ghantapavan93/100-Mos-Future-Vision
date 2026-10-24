// "How we'd build it": the engineering under each screen, closed by default so
// the page stays simple. Three or four plain lines, each naming the real piece in the
// app they run today (FlutterFlow, Firebase sign-in, Supabase), whether it
// already exists, and roughly how big the work is.

export interface BuildLine {
  /** The piece, in plain words: "Every walk, saved once". */
  what: string;
  /** How, in one sentence an engineer nods at and anyone can follow. */
  how: string;
  /** Roughly how big: S (days), M (a week or two), L (a few weeks). "Have" when it already exists. */
  effort?: "S" | "M" | "L" | "Have";
}

const EFFORT_WORDS: Record<NonNullable<BuildLine["effort"]>, string> = {
  Have: "Already in your app",
  S: "Small · days",
  M: "Medium · a week or two",
  L: "Large · a few weeks",
};

export function HowWeBuild({ index = "03", lines, note }: { index?: string; lines: BuildLine[]; note?: string }) {
  return (
    <section className="mx-auto w-full max-w-[1320px] px-4 pb-12 sm:px-6 lg:px-8">
      <div className="index-line mb-6">
        <b>{index}</b> Under the hood
      </div>
      <details className="group card overflow-hidden">
        <summary className="tap flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block font-[family-name:var(--font-display)] text-[20px] font-black uppercase tracking-[-0.02em]">How we&apos;d build it</span>
            <span className="mt-0.5 block text-[14px] text-muted">Technical notes: the real pieces in the app you run today — FlutterFlow, Firebase sign-in, Supabase.</span>
          </span>
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-[20px] transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <ul className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
          {lines.map((l) => (
            <li key={l.what} className="bg-surface p-6 sm:last:odd:col-span-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-[16px] font-bold">{l.what}</div>
                {l.effort ? (
                  <span className={l.effort === "Have" ? "rounded-full bg-ok-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ok" : "rounded-full border border-line-strong px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted"}>
                    {EFFORT_WORDS[l.effort]}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{l.how}</p>
            </li>
          ))}
        </ul>
        {note ? <p className="border-t border-line px-6 py-4 text-[14px] text-muted">{note}</p> : null}
      </details>
    </section>
  );
}
