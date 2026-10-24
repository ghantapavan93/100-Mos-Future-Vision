"use client";

// You: your milestones (badges their app already gives), where your miles go
// (your switches, nobody else's), your connected apps, and "Start your
// summer". Strava's own copy is shown as what it is — private to you — and
// sponsors only ever appear as "totals, never you".

import { useEffect, useState } from "react";
import { decide, type Purpose } from "@/domain/policy";
import { SOURCE_LABEL, type MemberView } from "@/domain/selectors";
import { PROVIDERS, type ActivitySource, type Consents, type CountableSource, type Provider, type World } from "@/domain/types";
import { cn } from "@/components/ui/kit";
import { InlineReceipt, SwitchRow, YourAppToday, personaLabel, useMemberAction } from "./shared";

const PROVIDER_LABEL: Record<Provider, string> = {
  strava: "Strava",
  healthkit: "Apple Health",
  health_connect: "Health Connect",
  garmin: "Garmin",
};

/** Milestones: a badge at each of these (their app gives mile badges today), plus one for the first group walk. Never for speed. */
export const MOMENTS: { id: string; miles: number | null; top: string; bottom: string }[] = [
  { id: "1", miles: 1, top: "1", bottom: "first mile" },
  { id: "10", miles: 10, top: "10", bottom: "big deal" },
  { id: "25", miles: 25, top: "25", bottom: "a quarter" },
  { id: "50", miles: 50, top: "50", bottom: "halfway" },
  { id: "75", miles: 75, top: "75", bottom: "almost" },
  { id: "100", miles: 100, top: "100", bottom: "you did it" },
  { id: "meetup", miles: null, top: "1st", bottom: "meetup" },
];

/** Whether a sharing switch exists for this source and purpose, and where it stands. */
function switchFor(source: CountableSource, purpose: Purpose, bucket: "chapter" | "coach", consents: Consents) {
  const now = decide(`activity:${source}`, purpose, consents).allow;
  const widened: Consents = { ...consents, [bucket]: { ...consents[bucket], [source]: true } };
  const possible = decide(`activity:${source}`, purpose, widened);
  return possible.allow && possible.consent ? { on: now } : null;
}

export function YouTab({ view, world, onStart }: { view: MemberView; world: World; onStart: () => void }) {
  const m = view.member;
  const act = useMemberAction(m.id);
  const [armed, setArmed] = useState<Provider | null>(null);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const rows = new Set<ActivitySource>(["manual", "event_checkin"]);
  for (const s of view.sources) rows.add(s.source);
  for (const p of PROVIDERS) if (m.connections[p].status === "connected") rows.add(p);
  const milesFrom = (s: ActivitySource) => view.sources.find((x) => x.source === s)?.miles ?? 0;
  const northline = world.partners.northline;
  const sharesWithNorthline = m.consents.partnerContact.includes("northline");

  return (
    <div className="space-y-4 px-4 pb-6 pt-2">
      <Milestones view={view} drafted={m.storyCardDrafted} onShare={() => act.run({ type: "TOGGLE_STORY_CARD", payload: { memberId: m.id } })} city={world.chapters[m.chapterId ?? m.homeChapterId]?.city ?? ""} />

      <section aria-label="Your miles, your choice" className="rounded-[26px] bg-surface p-5 shadow-[var(--shadow)]" data-testid="consent-matrix">
        <h2 className="font-[family-name:var(--font-display)] text-[22px] font-black uppercase leading-none tracking-[-0.02em]">Your miles, your choice</h2>
        <p className="mt-2 text-[13.5px] leading-snug text-muted">Every app you use, and where its miles may go. Only you can flip these.</p>
        <div className="mt-4 space-y-3">
          {[...rows].map((source) => {
            const name = source === "garmin" && m.connections.garmin.deviceModel ? m.connections.garmin.deviceModel : SOURCE_LABEL[source];
            if (source === "strava") {
              return (
                <div key={source} className="rounded-2xl border border-line-strong p-3" data-source="strava">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-[15px] font-bold">Strava</h3>
                    <span className="num text-[13px] text-muted">{(view.strava?.miles ?? 0).toFixed(1)} mi</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted">
                    <svg width="12" height="14" viewBox="0 0 14 16" aria-hidden>
                      <rect x="1.5" y="7" width="11" height="8" rx="2" fill="currentColor" />
                      <path d="M4 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                    Strava&apos;s own copy stays private — only you see it.
                  </p>
                  <p className="mt-1 text-[12.5px] leading-snug text-ok">Your miles still count when they come in from your watch or phone.</p>
                </div>
              );
            }
            const s = source as CountableSource;
            const circle = switchFor(s, "chapter-total", "chapter", m.consents);
            const coach = switchFor(s, "ai-coaching", "coach", m.consents);
            const alwaysInCircle = !circle && decide(`activity:${s}`, "chapter-total", m.consents).allow;
            return (
              <div key={source} className="rounded-2xl border border-line-strong p-3" data-source={source}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[15px] font-bold">{name}</h3>
                  <span className="num text-[13px] text-muted">{milesFrom(source).toFixed(1)} mi</span>
                </div>
                <p className="mt-0.5 text-[12.5px] text-ok">Counts toward your 100</p>
                <ul className="mt-1 divide-y divide-[var(--line)]">
                  {circle ? (
                    <li>
                      <Switch
                        on={circle.on}
                        label="Share with my circle"
                        detail={`from ${name}`}
                        stepTarget={s === "healthkit" ? "share" : undefined}
                        onChange={() => act.run({ type: "SET_CONSENT", payload: { memberId: m.id, purpose: "chapter", source: s, granted: !circle.on } })}
                      />
                    </li>
                  ) : alwaysInCircle ? (
                    <li className="flex min-h-12 items-center justify-between gap-3 text-[14px]">
                      Shared with my circle <span className="text-[13px] font-semibold text-ok">Always</span>
                    </li>
                  ) : null}
                  {coach ? (
                    <li>
                      <Switch on={coach.on} label="Let the coach read it" detail={`from ${name}`} onChange={() => act.run({ type: "SET_CONSENT", payload: { memberId: m.id, purpose: "coach", source: s, granted: !coach.on } })} />
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-3 rounded-2xl bg-surface-2 px-3 py-2.5 text-[13px] leading-snug">
          <span className="font-bold">Sponsors?</span> They only ever see totals, like &ldquo;2,400 miles in Detroit&rdquo; — never you.
        </p>
        <InlineReceipt receipt={act.last} className="mt-3" />
      </section>

      <section aria-label="Sharing" className="space-y-2 rounded-[22px] border border-line bg-surface p-4">
        <div className="eyebrow">Sharing</div>
        <SwitchRow checked={m.consents.storyWall} label="Show me on my circle's wall" hint="First name and miles, for people in your circle only." onChange={(on) => act.run({ type: "SET_STORY_WALL", payload: { memberId: m.id, on } })} />
        <SwitchRow
          checked={m.consents.needsToOrganizers}
          label="Tell City Leads my access needs"
          hint={m.needs.length ? "Only for walks you say you're coming to, so they can plan. Off means they see your first name only." : "You haven't listed any access needs yet."}
          onChange={(on) => act.run({ type: "SET_NEEDS_SHARING", payload: { memberId: m.id, on } })}
        />
        {northline ? (
          <SwitchRow
            checked={sharesWithNorthline}
            label={`Share my email with ${northline.name}`}
            hint="A sponsor. Only your email, only if you say so — never your miles."
            onChange={(v) => act.run({ type: "SET_PARTNER_CONTACT", payload: { memberId: m.id, partnerId: "northline", granted: v } })}
          />
        ) : null}
      </section>

      <section aria-label="Connected apps" className="rounded-[22px] border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">Connected apps</span>
          <YourAppToday />
        </div>
        <ul className="mt-2 divide-y divide-[var(--line)]">
          {PROVIDERS.map((p) => {
            const c = m.connections[p];
            const miles = p === "strava" ? view.strava?.miles ?? 0 : milesFrom(p);
            return (
              <li key={p} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-[14.5px] font-semibold">{p === "garmin" && c.deviceModel ? c.deviceModel : PROVIDER_LABEL[p]}</div>
                  <div className="text-[12.5px] text-muted">
                    {c.status === "connected" ? (
                      <>
                        Connected · <span className="num">{miles.toFixed(1)}</span> mi{p === "strava" ? " · private to you" : ""}
                      </>
                    ) : c.status === "revoked" ? (
                      "Disconnected · its miles were removed"
                    ) : (
                      "Not connected"
                    )}
                  </div>
                  {armed === p ? (
                    <div role="alert" className="mt-1 text-[12.5px] font-semibold text-bad">
                      {p === "strava" ? `This deletes Strava's private copy (${miles.toFixed(1)} mi) from this app. Miles from your watch or phone stay. Tap again to disconnect.` : `This removes ${miles.toFixed(1)} mi from every total. Tap again to disconnect.`}
                    </div>
                  ) : null}
                </div>
                {c.status === "connected" ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (armed !== p) return setArmed(p);
                      setArmed(null);
                      act.run({ type: "REVOKE_PROVIDER", payload: { memberId: m.id, provider: p } });
                    }}
                    aria-label={armed === p ? `Confirm disconnecting ${PROVIDER_LABEL[p]}` : `Disconnect ${PROVIDER_LABEL[p]}`}
                    className={cn("min-h-11 shrink-0 rounded-full border px-4 text-[13px] font-semibold", armed === p ? "border-bad text-bad" : "border-line-strong")}
                  >
                    {armed === p ? "Confirm" : "Disconnect"}
                  </button>
                ) : (
                  <button type="button" aria-label={`Connect ${PROVIDER_LABEL[p]}`} onClick={() => act.run({ type: "CONNECT_PROVIDER", payload: { memberId: m.id, provider: p } })} className="min-h-11 shrink-0 rounded-full border border-line-strong px-4 text-[13px] font-semibold">
                    Connect
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="You" className="rounded-[22px] border border-line bg-surface p-4">
        <div className="text-[14.5px] font-semibold">{m.name}</div>
        <div className="text-[12.5px] text-muted">
          {personaLabel(m.persona)} · moves by {m.moves.join(", ")}
        </div>
        <button type="button" onClick={onStart} className="mt-3 min-h-11 w-full rounded-full border border-ink text-[14px] font-semibold">
          Start your own summer
        </button>
      </section>
    </div>
  );
}

function Switch({ on, label, detail, stepTarget, onChange }: { on: boolean; label: string; detail: string; stepTarget?: string; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onChange} className="flex min-h-12 w-full items-center justify-between gap-3 text-left" data-step-target={stepTarget}>
      <span className="text-[14px] leading-snug">
        {label}
        <span className="sr-only"> {detail}</span>
      </span>
      <span aria-hidden className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors duration-200", on ? "border-ok bg-ok" : "border-muted bg-surface-2")}>
        <span className={cn("absolute h-5 w-5 rounded-full shadow transition-transform duration-200", on ? "translate-x-[22px] bg-surface" : "translate-x-[2px] bg-muted")} />
      </span>
    </button>
  );
}

/** Milestones: badges at 1, 10, 25, 50, 75 and 100 miles and the first meetup; tap one to make a share card. */
function Milestones({ view, drafted, onShare, city }: { view: MemberView; drafted: boolean; onShare: () => void; city: string }) {
  const m = view.member;
  const firstMeetup = m.stamps.some((s) => s.kind === "first-event");
  const earned = (b: (typeof MOMENTS)[number]) => (b.miles === null ? firstMeetup : view.miles >= b.miles);
  const latest = [...MOMENTS].reverse().find((b) => b.miles !== null && earned(b)) ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const badge = MOMENTS.find((b) => b.id === (picked ?? latest?.id)) ?? null;
  const count = MOMENTS.filter(earned).length;
  return (
    <section aria-label="My milestones" className="rounded-[26px] bg-surface p-5 shadow-[var(--shadow)]" data-testid="mile-moments">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-[22px] font-black uppercase leading-none tracking-[-0.02em]">My milestones</h2>
        <YourAppToday />
      </div>
      <p className="mt-2 text-[13px] text-muted">
        <span className="num font-semibold text-ink">
          {count} of {MOMENTS.length}
        </span>{" "}
        earned, for showing up at any pace. Tap one to make a card you can share.
      </p>
      <ul className="mt-4 grid grid-cols-4 gap-2.5">
        {MOMENTS.map((b) => {
          const has = earned(b);
          const on = badge?.id === b.id;
          return (
            <li key={b.id}>
              <button
                type="button"
                disabled={!has}
                aria-pressed={on}
                aria-label={`${b.top} ${b.bottom}${has ? ", earned" : ", not yet"}`}
                onClick={() => setPicked(b.id)}
                className={cn(
                  "flex aspect-square w-full flex-col items-center justify-center rounded-full text-center leading-none transition-transform",
                  has ? "bg-accent text-on-accent shadow-[0_0_18px_-4px_rgba(255,106,19,0.8)]" : "border-[1.5px] border-dashed border-muted text-muted",
                  on && "ring-2 ring-ink ring-offset-2 ring-offset-[var(--surface)]",
                )}
              >
                <span className="font-[family-name:var(--font-display)] text-[17px] font-black">{b.top}</span>
                <span className="mt-0.5 max-w-[64px] text-[10.5px] font-semibold leading-[1.1]">{b.bottom}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {badge && earned(badge) ? (
        <>
          <button type="button" onClick={onShare} aria-pressed={drafted} className={cn("mt-4 min-h-11 w-full rounded-full text-[14px] font-bold", drafted ? "border border-line-strong" : "bg-accent text-on-accent")} data-testid="share-card">
            {drafted ? "Hide my share card" : "Make my share card"}
          </button>
          {drafted ? (
            <figure className="rise-in mt-4 overflow-hidden rounded-[22px] bg-[linear-gradient(150deg,#ff6a13,#7a2a0c_70%)] p-5 text-[#fff6ec]" aria-label="Share card">
              <div className="flex items-center justify-between font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]">
                <span>100 Miles of Summer</span>
                <span>Year 10</span>
              </div>
              <div className="mt-6 font-[family-name:var(--font-display)] text-[64px] font-black uppercase italic leading-none tracking-[-0.04em]">{badge.top}</div>
              <div className="mt-1 font-[family-name:var(--font-display)] text-[20px] font-black uppercase tracking-[-0.01em]">{badge.miles === null ? "first meetup" : badge.miles === 1 ? "first mile" : "miles"}</div>
              <figcaption className="mt-4 text-[14px] leading-snug">
                {m.name}
                {city ? ` · ${city}` : ""} · &ldquo;{m.goal.label}&rdquo;
              </figcaption>
              <p className="mt-4 border-t border-white/25 pt-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em]">No map · no time · no pace</p>
            </figure>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
