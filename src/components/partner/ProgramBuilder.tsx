"use client";

// Programs for any organization. Company teams are Kayla's Year 10 goal; this
// shows the same setup run for an employer or a university, under its name.
// Five settings on the left; the member's page and the organizer's view on the
// right are built from those same settings, so changing one changes both.

import { useMemo, useState } from "react";
import { usd } from "@/domain/finance";
import { hotWord } from "@/components/demo/TryIt";
import { cn } from "@/components/ui/kit";
import { Reveal, Words } from "@/components/ui/Reveal";
import { useWorld } from "@/lib/store";
import { ORG_WORDS, joiners, programPrice, teamsFor, type OrgKind, type ProgramSettings } from "./programs";

const DEFAULT_CITY: Record<OrgKind, string> = { employer: "chicago", university: "detroit" };
const SIZES = [300, 1200, 5000];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn("min-h-10 whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-bold transition-colors", on ? "bg-ink text-bg" : "border border-line-strong hover:border-accent")}>
      {children}
    </button>
  );
}

export function ProgramBuilder({ index = "03" }: { index?: string }) {
  const world = useWorld();
  const [s, setS] = useState<ProgramSettings>({ kind: "employer", name: ORG_WORDS.employer.sample, city: DEFAULT_CITY.employer, weeks: 6, invited: ORG_WORDS.employer.invited });
  const set = (patch: Partial<ProgramSettings>) => setS((x) => ({ ...x, ...patch }));
  const pickKind = (kind: OrgKind) => set({ kind, name: ORG_WORDS[kind].sample, city: DEFAULT_CITY[kind], invited: ORG_WORDS[kind].invited });
  const price = useMemo(() => programPrice(s), [s]);
  const join = useMemo(() => joiners(s.invited), [s.invited]);
  const city = world.chapters[s.city]?.city ?? s.city;
  const name = s.name.trim() || ORG_WORDS[s.kind].sample;
  const team = s.kind === "employer" ? "team" : "campus team";

  return (
    <section id="programs" aria-labelledby="programs-title" className="mx-auto w-full max-w-[1320px] px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
      <div className="index-line">
        <b>{index}</b> Programs for any organization
      </div>
      <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
        <h2 id="programs-title" className="t-section">
          <Words text="One setup. *Any company, any campus.*" render={hotWord} />
        </h2>
        <Reveal>
          <p className="t-lede">
            Company teams are your Year 10 goal. The same setup can run a six-week program for an employer or a university, under its name. Set it once — the member page and the organizer view build themselves.
          </p>
          <span className="mt-3 inline-flex rounded-full border border-line-strong px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Builds on what you have</span>
        </Reveal>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {/* The settings: the only thing anyone fills in. */}
        <Reveal className="card p-5 sm:p-6" as="div">
          <div className="eyebrow">The settings</div>
          <div className="mt-4 space-y-5" data-testid="program-settings">
            <fieldset>
              <legend className="text-[13px] font-bold">Who runs it</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(ORG_WORDS) as OrgKind[]).map((k) => (
                  <Chip key={k} on={s.kind === k} onClick={() => pickKind(k)}>
                    {ORG_WORDS[k].label}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-[13px] font-bold">Its name</span>
              <input value={s.name} maxLength={40} onChange={(e) => set({ name: e.currentTarget.value })} className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-bg px-3 text-[15px]" />
            </label>
            <fieldset>
              <legend className="text-[13px] font-bold">City</legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.values(world.chapters).map((c) => (
                  <Chip key={c.id} on={s.city === c.id} onClick={() => set({ city: c.id })}>
                    {c.city}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-[13px] font-bold">How long</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {([4, 6, 8] as const).map((w) => (
                  <Chip key={w} on={s.weeks === w} onClick={() => set({ weeks: w })}>
                    {w} weeks
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-[13px] font-bold">People invited</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {SIZES.map((n) => (
                  <Chip key={n} on={s.invited === n} onClick={() => set({ invited: n })}>
                    {n.toLocaleString("en-US")}
                  </Chip>
                ))}
              </div>
            </fieldset>
          </div>
        </Reveal>

        {/* What members see: the page their invite opens. */}
        <Reveal className="card overflow-hidden p-0" delay={60}>
          <div className="border-b border-line px-5 py-3 text-[12px] font-bold uppercase tracking-[0.1em] text-muted">What members see</div>
          <div className="p-5" data-testid="program-member-page">
            <div className="flex items-center gap-2">
              <span aria-hidden className="flex size-9 items-center justify-center rounded-xl bg-accent font-[family-name:var(--font-display)] text-[17px] font-black text-on-accent">
                {name.charAt(0).toUpperCase()}
              </span>
              <span className="text-[13px] font-bold leading-tight">
                {name}
                <span className="block font-normal text-muted">× 100 Miles of Summer</span>
              </span>
            </div>
            <h3 className="mt-4 font-[family-name:var(--font-display)] text-[26px] font-black uppercase leading-[0.95] tracking-[-0.02em]">
              {s.weeks} weeks of walking, <span className="hot">together.</span>
            </h3>
            <p className="mt-3 text-[14.5px] leading-snug">A walk every Saturday in {city}, with someone at the back so nobody finishes last. Every pace counts.</p>
            <p className="mt-2 text-[14.5px] leading-snug">Your miles count toward your own 100 too.</p>
            <div className="mt-4 min-h-11 w-full rounded-full bg-accent px-4 py-3 text-center text-[13.5px] font-black uppercase tracking-[0.06em] text-on-accent">Join the {name} {team}</div>
            <p className="mt-3 text-[12.5px] leading-snug text-muted">
              {name} sees {team} totals only — never your miles, your name or your route.
            </p>
          </div>
        </Reveal>

        {/* What the organizer sees: the same settings, as a plan and a price. */}
        <Reveal className="card overflow-hidden p-0" delay={120}>
          <div className="border-b border-line px-5 py-3 text-[12px] font-bold uppercase tracking-[0.1em] text-muted">What the organizer sees</div>
          <div className="p-5" data-testid="program-organizer-view">
            <div className="text-[13px] text-muted">{name} · {s.weeks}-week program</div>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  ["Invited", s.invited.toLocaleString("en-US"), ORG_WORDS[s.kind].people],
                  ["Likely to join", `${join.low.toLocaleString("en-US")}–${join.high.toLocaleString("en-US")}`, "20–40% usually do"],
                  ["Team walks", String(s.weeks), `Saturdays in ${city}`],
                  ["Their report", "Totals", "every two weeks"],
                ] as const
              ).map(([label, value, note]) => (
                <div key={label} className="rounded-2xl border border-line bg-surface p-3">
                  <dt className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted">{label}</dt>
                  <dd className="num mt-1 font-[family-name:var(--font-display)] text-[20px] font-black leading-none">{value}</dd>
                  <dd className="mt-1 text-[11.5px] leading-snug text-muted">{note}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
              <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-accent-ink">Price, about</div>
              <div className="num mt-1 font-[family-name:var(--font-display)] text-[26px] font-black leading-none" data-testid="program-price">
                {price.low === price.high ? usd(price.low) : `${usd(price.low)}–${usd(price.high)}`}
              </div>
              <div className="mt-1 text-[12.5px] leading-snug text-muted">
                {s.kind === "employer"
                  ? `${teamsFor(s.invited)} company team${teamsFor(s.invited) === 1 ? "" : "s"} · about $4,000 a team for the season`
                  : "$7–$11 for each person who joins · a planning range"}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
