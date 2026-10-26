"use client";

// The City Circles app on a phone. One phone, three hats:
//  - No app: a guest who scanned a poster at the library picks what helps,
//    sees the walks sorted by fit and saves a spot with a first name
//    (Doorway.tsx). After the walk, one tap joins and the walk counts.
//  - Maya the member finds a circle, gives an optional heads-up that she's
//    coming, and offers to walk at the back.
//  - Nina the City Lead sees who's coming (first-timers and guests marked),
//    asks "What am I missing?" before Saturday, checks people in on the day —
//    walk-ups and guests too — posts new walks and calls one off for heat.
// Every member and lead tap is a real command, so what Maya does is on Nina's
// list the moment she does it. Controls that finish a "Try it" step carry
// data-step-target.

import { useMemo, useState } from "react";
import { dayLabel, timeLabel } from "@/domain/calendar";
import type { Receipt } from "@/domain/engine";
import { chapterView, roster } from "@/domain/selectors";
import type { ChapterId, MovementEvent, World } from "@/domain/types";
import { AppBody, AppHeader } from "@/components/demo/Phone";
import { cn } from "@/components/ui/kit";
import { actors, store } from "@/lib/store";
import { CoPilot, GuestRow, GuestScreen } from "./Doorway";
import { Chip, DateChip, LEAD_CITY, MAYA, NINA, Note, PhoneHeading, Primary, Secondary, YourAppToday, refused, send, start, type CirclesDemo, type CirclesMode } from "./phoneUi";

export type { CirclesDemo, CirclesMode, Guest, LeadTab } from "./phoneUi";

/** The walk the giving program pays for; it belongs to the Giving screen, not to Nina's own posts. */
export const IMPACT_WALK_TITLES = new Set(["Neighborhood Walk, the members' pick", "Community walk, the members' pick"]);

const CITY_ORDER: ChapterId[] = ["chicago", "detroit", "charleston", "nyc", "la", "durham", "montreal"];
const REASONS = ["Heat advisory", "Storm warning", "Venue issue"];

/** No group walk yet, here or before this demo's week: their first group walk. */
function firstTimer(world: World, memberId: string): boolean {
  if (world.members[memberId]?.stamps.some((s) => s.kind === "first-event")) return false;
  return !Object.values(world.events).some((ev) => ev.checkIns.some((c) => c.memberId === memberId));
}

/** Which hat a Try it step is worn in, so the hat switch can carry that step's guiding ring. */
const HAT_FOR_STEP: Record<string, CirclesMode> = { needs: "guest", spot: "guest", join: "guest", copilot: "lead", checkin: "lead" };

function ModeSwitch({ mode, setMode, next }: { mode: CirclesMode; setMode: (m: CirclesMode) => void; next: string | null }) {
  return (
    <div role="group" aria-label="Whose phone" className="mx-4 mb-1 grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
      {(
        [
          ["guest", "No app", "via a poster"],
          ["member", "Member", "as Maya"],
          ["lead", "City Lead", "as Nina"],
        ] as const
      ).map(([id, role, who]) => (
        <button
          key={id}
          type="button"
          aria-pressed={mode === id}
          data-step-target={next && HAT_FOR_STEP[next] === id && mode !== id ? next : undefined}
          onClick={() => setMode(id)}
          className={cn("flex min-h-12 flex-col items-center justify-center rounded-xl px-1 text-[13px] font-bold leading-tight transition-colors", mode === id ? "bg-bg text-ink shadow" : "text-muted hover:text-ink")}
        >
          <span>{role}</span>
          <span className="text-[11.5px] font-semibold opacity-70">{who}</span>
        </button>
      ))}
    </div>
  );
}

export function CirclesApp({ world, demo }: { world: World; demo: CirclesDemo }) {
  return (
    <div className="flex h-full flex-col" data-testid="circles-app">
      <ModeSwitch mode={demo.mode} setMode={demo.setMode} next={demo.next} />
      {demo.mode === "guest" ? <GuestScreen world={world} demo={demo} /> : demo.mode === "member" ? <MemberScreen world={world} demo={demo} /> : <LeadScreen world={world} demo={demo} />}
    </div>
  );
}

// ── Maya ──────────────────────────────────────────────────────────────────────

function MemberScreen({ world, demo }: { world: World; demo: CirclesDemo }) {
  const cv = chapterView(world, demo.chapterId);
  const maya = world.members[MAYA]!;
  const inCircle = maya.chapterId === demo.chapterId;
  const [joinResult, setJoinResult] = useState<Receipt | null>(null);
  const walks = cv.events.filter((e) => e.status === "published" || e.status === "cancelled" || e.status === "completed");

  return (
    <>
      <AppHeader kicker="Find your circle" title={cv.city} right={<Chip tone="accent">{cv.members} members</Chip>} />
      <AppBody>
        <div role="group" aria-label="Choose a city" className="flex flex-wrap gap-1.5 pb-3">
          {CITY_ORDER.filter((id) => world.chapters[id]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={demo.chapterId === id}
              onClick={() => demo.pick(id)}
              className={cn(
                "min-h-10 rounded-full border px-3.5 text-[13.5px] font-bold transition-colors",
                demo.chapterId === id ? "border-accent bg-accent text-on-accent" : "border-line-strong hover:border-accent",
              )}
            >
              {world.chapters[id]!.city}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="text-[16px] font-bold">{cv.name}</div>
          <div className="mt-0.5 text-[13px] text-muted">City Lead {cv.leadName} · All paces welcome</div>
          <div className="mt-3">
            {inCircle ? (
              <Chip tone="ok">You&apos;re in this circle ✓</Chip>
            ) : (
              <Secondary className="min-h-10 text-[13px]" onClick={() => setJoinResult(send({ type: "JOIN_CHAPTER", payload: { memberId: MAYA, chapterId: demo.chapterId } }, actors.member(MAYA)))}>
                Join {cv.city}
              </Secondary>
            )}
            <Note receipt={joinResult} />
          </div>
        </div>

        <PhoneHeading className="mt-5">Next walks</PhoneHeading>
        <div className="mt-2 rounded-xl bg-surface-2 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="text-[13.5px] font-bold">No RSVP needed — just show up!</span>
            <YourAppToday />
          </div>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">“I&apos;m coming” is only a heads-up for {cv.leadName}.</p>
        </div>
        {walks.length === 0 ? <p className="mt-2 text-[14px] text-muted">No walks posted yet.</p> : null}
        <ul className="mt-2 space-y-3">
          {walks.map((e) => (
            <li key={e.id}>
              <MemberWalk event={e} world={world} demo={demo} />
            </li>
          ))}
        </ul>
      </AppBody>
    </>
  );
}

function MemberWalk({ event: e, world, demo }: { event: MovementEvent; world: World; demo: CirclesDemo }) {
  const [choosing, setChoosing] = useState(false);
  const [result, setResult] = useState<Receipt | null>(null);
  const going = e.rsvps.includes(MAYA) || e.waitlist.includes(MAYA);
  const checked = e.checkIns.find((c) => c.memberId === MAYA);
  const started = world.clock >= start(e);
  const sweep = e.sweep && demo.dropout[e.id] !== e.sweep ? world.members[e.sweep]?.name ?? "A volunteer" : null;
  const count = e.rsvps.length + e.backgroundRsvps + (demo.guest?.eventId === e.id && !demo.guest.memberId ? 1 : 0);
  const offered = demo.offers.has(e.id);

  const rsvp = (miles: number) => {
    demo.setRoute(e.id, miles);
    setChoosing(false);
    setResult(send({ type: "RSVP", payload: { memberId: MAYA, eventId: e.id } }, actors.member(MAYA)));
  };

  return (
    <article aria-label={e.title} className={cn("rounded-2xl border bg-surface p-4", e.status === "cancelled" ? "border-bad/50" : going ? "border-accent/60 shadow-[var(--glow)]" : "border-line")}>
      <div className="flex gap-3">
        <DateChip day={e.day} />
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold leading-snug">{e.title}</div>
          <div className="mt-0.5 text-[13px] leading-snug text-muted">
            {timeLabel(e.startMinute)} · {e.meetingArea}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip tone="accent">All paces welcome</Chip>
            {e.distanceOptions.map((d) => (
              <Chip key={d}>{d} mi</Chip>
            ))}
          </div>
        </div>
      </div>

      {e.status === "cancelled" ? (
        <p className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-[13.5px] font-semibold text-bad">Called off · {e.cancelReason}</p>
      ) : (
        <p className="mt-3 text-[13.5px] leading-snug">
          {sweep ? (
            <>
              <span className="font-bold">{sweep}</span> walks at the back, so nobody finishes last. <span className="text-muted">{count} going.</span>
            </>
          ) : (
            <span className="text-warn">Still needs someone to walk at the back.</span>
          )}
        </p>
      )}

      {checked ? (
        <p className="mt-3 rounded-xl bg-ok-soft px-3 py-2 text-[13.5px] font-bold text-ok">You were there ✓ · {checked.distanceMi} mi added to your 100</p>
      ) : e.status === "completed" ? (
        <p className="mt-3 text-[13.5px] text-muted">Done · {e.checkIns.length + (e.backgroundAttended ?? 0)} came</p>
      ) : e.status === "published" && !started ? (
        <div className="mt-3">
          {going ? (
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="ok">You&apos;re going ✓{demo.route[e.id] ? ` · ${demo.route[e.id]} mi` : ""}</Chip>
              <button
                type="button"
                className="min-h-10 px-2 text-[13px] font-semibold text-muted underline-offset-4 hover:underline"
                onClick={() => setResult(send({ type: "CANCEL_RSVP", payload: { memberId: MAYA, eventId: e.id } }, actors.member(MAYA)))}
              >
                Can&apos;t make it
              </button>
            </div>
          ) : choosing ? (
            <div role="group" aria-label={`Which route for ${e.title}`} className="rise-in rounded-xl bg-surface-2 p-3">
              <div className="text-[13px] font-bold">Which route?</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {e.distanceOptions.map((d, i) => (
                  <Primary key={d} className="min-h-10 px-3 text-[13px]" onClick={() => rsvp(d)}>
                    {d} mi {i === 0 ? "walk" : "walk or run"}
                  </Primary>
                ))}
                <button type="button" className="min-h-10 px-2 text-[13px] text-muted" onClick={() => setChoosing(false)}>
                  Not now
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Primary aria-label={`I'm coming to ${e.title}`} onClick={() => (e.distanceOptions.length === 1 ? rsvp(e.distanceOptions[0]!) : setChoosing(true))}>
                I&apos;m coming
              </Primary>
              {offered ? <Chip tone="ok">Offered to walk at the back ✓</Chip> : <Secondary onClick={() => demo.offer(e.id)}>Walk at the back</Secondary>}
            </div>
          )}
          {going && offered ? <p className="mt-2 text-[12.5px] text-muted">Nina will see your offer to walk at the back.</p> : null}
        </div>
      ) : e.status === "published" ? (
        <p className="mt-3 text-[13.5px] font-semibold text-accent">Happening now</p>
      ) : null}
      <Note receipt={result} />
    </article>
  );
}

// ── Nina ──────────────────────────────────────────────────────────────────────

/** The walk a Lead step is about: the guest's, once there is one. */
const leadStep = (demo: CirclesDemo) => (demo.next === "copilot" || demo.next === "checkin" ? demo.next : undefined);

function LeadScreen({ world, demo }: { world: World; demo: CirclesDemo }) {
  const leads = demo.chapterId === LEAD_CITY;

  if (!leads) {
    return (
      <>
        <AppHeader kicker="City Lead" title="Lead toolkit" />
        <AppBody>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-[15px] leading-snug">
              Nina leads <span className="font-bold">Detroit</span>. Each City Lead only runs their own circle.
            </p>
            <Primary className="mt-3" data-step-target={leadStep(demo)} onClick={() => demo.pick(LEAD_CITY)}>
              Open Detroit
            </Primary>
          </div>
        </AppBody>
      </>
    );
  }

  if (demo.openEvent && world.events[demo.openEvent]) {
    return <LeadWalk event={world.events[demo.openEvent]!} world={world} demo={demo} />;
  }

  return (
    <>
      <AppHeader kicker="City Lead · Detroit" title="Lead toolkit" right={<Chip tone="accent">Nina</Chip>} />
      <div role="group" aria-label="Lead toolkit sections" className="mx-4 mb-2 grid grid-cols-2 gap-2">
        {(
          [
            ["walks", "Walks"],
            ["new", "+ New walk"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={demo.leadTab === id}
            data-step-target={id === "walks" && demo.leadTab !== "walks" ? leadStep(demo) : undefined}
            onClick={() => demo.setLeadTab(id)}
            className={cn("min-h-11 rounded-xl border text-[14px] font-bold", demo.leadTab === id ? "border-accent bg-accent/15 text-accent" : "border-line hover:border-accent")}
          >
            {label}
          </button>
        ))}
      </div>
      {demo.leadTab === "walks" ? <LeadWalks world={world} demo={demo} /> : <NewWalk world={world} demo={demo} />}
    </>
  );
}

function LeadWalks({ world, demo }: { world: World; demo: CirclesDemo }) {
  const cv = chapterView(world, LEAD_CITY);
  const drafts = cv.queue;
  const live = cv.events.filter((e) => e.status === "published");
  const past = cv.events.filter((e) => e.status === "completed" || e.status === "cancelled");
  const guest = demo.guest && !demo.guest.memberId ? demo.guest : null;
  // Who's coming comes first: that's what a lead opens the app for. Drafts wait underneath.
  return (
    <AppBody>
      <PhoneHeading>Live walks</PhoneHeading>
      <ul className="mt-2 space-y-3">
        {live.map((e) => {
          const r = roster(world, e.id);
          const names = r.named.map((p) => p.label);
          const hasGuest = guest?.eventId === e.id;
          const firsts = r.named.filter((p) => !p.sweep && firstTimer(world, p.id)).length + (hasGuest ? 1 : 0);
          const coming = r.named.length + r.background + (hasGuest ? 1 : 0);
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => demo.setOpenEvent(e.id)}
                aria-label={`Open ${e.title}`}
                data-step-target={hasGuest ? leadStep(demo) : undefined}
                className="flex w-full gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-accent"
              >
                <DateChip day={e.day} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold leading-snug">{e.title}</span>
                  <span className="mt-0.5 block text-[13px] text-muted">
                    {timeLabel(e.startMinute)} · {coming} coming{firsts ? ` · ${firsts} first ${firsts === 1 ? "walk" : "walks"}` : ""}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {names.map((n) => (
                      <Chip key={n} tone={n === "Maya" ? "accent" : "neutral"}>
                        {n}
                      </Chip>
                    ))}
                    {hasGuest ? <Chip tone="accent">{guest!.name} · guest</Chip> : null}
                    {r.background ? <Chip>+{r.background}</Chip> : null}
                  </span>
                </span>
                <span aria-hidden className="self-center text-[18px] text-muted">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {drafts.length ? (
        <section aria-label="Waiting to go live" className="mt-5">
          <PhoneHeading>Waiting to go live</PhoneHeading>
          <ul className="mt-2 space-y-3">
            {drafts.map((e) => (
              <li key={e.id}>
                <DraftCard event={e} world={world} demo={demo} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {past.length ? (
        <>
          <PhoneHeading className="mt-5">Done and called off</PhoneHeading>
          <ul className="mt-2 space-y-2">
            {past.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[13.5px]">
                <span className="font-semibold">{e.title}</span>
                {e.status === "completed" ? <Chip tone="ok">{e.checkIns.length + (e.backgroundAttended ?? 0)} came</Chip> : <Chip tone="bad">Called off</Chip>}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </AppBody>
  );
}

/** Who can walk at the back of a Detroit walk: people in the circle, Maya first if she offered. */
function backWalkerOptions(world: World, offers: ReadonlySet<string>, eventId?: string) {
  const ids = [...(world.chapters[LEAD_CITY]?.members ?? [])];
  const offered = (id: string) => id === MAYA && (eventId ? offers.has(eventId) || offers.size > 0 : offers.size > 0);
  ids.sort((a, b) => Number(offered(b)) - Number(offered(a)));
  return ids.map((id) => ({ id, name: world.members[id]?.name ?? id, offered: offered(id) }));
}

function DraftCard({ event: e, world, demo }: { event: MovementEvent; world: World; demo: CirclesDemo }) {
  const options = backWalkerOptions(world, demo.offers, e.id);
  const [back, setBack] = useState(e.sweep ?? "");
  const [result, setResult] = useState<Receipt | null>(null);
  const author = world.members[e.createdBy]?.name ?? e.createdBy;
  const goLive = () => {
    if (back && back !== e.sweep) {
      const r = send({ type: "ASSIGN_SWEEP", payload: { eventId: e.id, memberId: back } }, NINA);
      if (refused(r)) return setResult(r);
    }
    setResult(send({ type: "PUBLISH_EVENT", payload: { eventId: e.id } }, NINA));
  };
  return (
    <article aria-label={`Draft: ${e.title}`} className="rounded-2xl border border-warn/50 bg-surface p-4">
      <div className="flex gap-3">
        <DateChip day={e.day} />
        <div className="min-w-0">
          <div className="text-[16px] font-bold leading-snug">{e.title}</div>
          <div className="mt-0.5 text-[13px] text-muted">
            {timeLabel(e.startMinute)} · posted by {author}
          </div>
        </div>
      </div>
      <BackWalkerPicker value={back} onChange={setBack} options={options} label={`Who walks at the back of ${e.title}`} />
      <Primary className="mt-3 w-full" onClick={goLive} aria-label={`Go live: ${e.title}`}>
        Go live
      </Primary>
      {result && refused(result) && result.ruleIds.includes("WELCOME-SWEEP") ? (
        <p role="status" className="rise-in mt-2 rounded-xl bg-warn-soft px-3 py-2 text-[13.5px] leading-snug">
          Add someone to walk at the back first. No walk goes live without one — nobody finishes last.
        </p>
      ) : (
        <Note receipt={result} />
      )}
    </article>
  );
}

function BackWalkerPicker({ value, onChange, options, label }: { value: string; onChange: (id: string) => void; options: ReturnType<typeof backWalkerOptions>; label: string }) {
  return (
    <div role="group" aria-label={label} className="mt-3">
      <div className="text-[13px] font-bold">Who walks at the back?</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(value === o.id ? "" : o.id)}
            className={cn("min-h-10 rounded-full border px-3.5 text-[13px] font-bold transition-colors", value === o.id ? "border-accent bg-accent text-on-accent" : "border-line-strong hover:border-accent")}
          >
            {o.name}
            {o.offered ? " · offered" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

function LeadWalk({ event: e, world, demo }: { event: MovementEvent; world: World; demo: CirclesDemo }) {
  const r = roster(world, e.id);
  const open = world.clock >= start(e);
  const tooLate = world.clock > start(e) + 6 * 60;
  const [result, setResult] = useState<Receipt | null>(null);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const guestHere = Boolean(demo.guest && demo.guest.eventId === e.id && !demo.guest.memberId);
  const told = e.rsvps.length + e.waitlist.length + e.backgroundRsvps + (guestHere ? 1 : 0);
  const checkedIn = new Map(e.checkIns.map((c) => [c.memberId, c.distanceMi]));
  const canCheckIn = e.status === "published" && open && !tooLate;
  // "No RSVP needed — just show up!": anyone from the circle (and Maya, the visitor) can be checked in at the start line.
  const walkUpIds = [...new Set([MAYA, ...(world.chapters[e.chapterId]?.members ?? [])])].filter((id) => id !== "nina" && !e.rsvps.includes(id) && !checkedIn.has(id) && world.members[id]);
  const walkedUp = e.checkIns.filter((c) => !e.rsvps.includes(c.memberId));

  return (
    <>
      <div className="px-4 pb-1 pt-1">
        <button type="button" onClick={() => demo.setOpenEvent(null)} className="min-h-10 rounded-lg px-1 text-[14px] font-bold text-accent">
          ‹ Walks
        </button>
      </div>
      <AppHeader kicker={`${dayLabel(e.day)} · ${timeLabel(e.startMinute)}`} title={e.title} />
      <AppBody>
        <p className="text-[13.5px] text-muted">{e.meetingArea}</p>
        {e.status === "cancelled" ? <p className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-[13.5px] font-semibold text-bad">Called off · {e.cancelReason}. Everyone going was told.</p> : null}
        {e.status === "completed" ? <p className="mt-3 rounded-xl bg-ok-soft px-3 py-2 text-[13.5px] font-semibold text-ok">Done · {e.checkIns.length + (e.backgroundAttended ?? 0)} came</p> : null}

        {e.status === "published" && !open ? <CoPilot world={world} demo={demo} event={e} /> : null}

        {e.status === "published" && !open ? (
          <div className="mt-3 rounded-2xl border border-accent/50 bg-accent/10 p-3">
            <p className="text-[13.5px] leading-snug">Check-in opens when the walk starts.</p>
            <Primary
              className="mt-2 w-full"
              data-step-target={guestHere && demo.next === "checkin" ? "checkin" : undefined}
              onClick={() => setResult(send({ type: "ADVANCE_CLOCK", payload: { to: start(e) } }, actors.system))}
            >
              It&apos;s {dayLabel(e.day).split(",")[0]} {timeLabel(e.startMinute)} →
            </Primary>
          </div>
        ) : null}

        <section aria-label={`Who's coming to ${e.title}`} className="mt-4">
          <PhoneHeading>Who&apos;s coming</PhoneHeading>
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
            {r.named.map((p) => {
              const done = checkedIn.get(p.id);
              const miles = demo.route[e.id] && p.id === MAYA ? demo.route[e.id]! : e.distanceOptions[0]!;
              const out = demo.dropout[e.id] === p.id;
              return (
                <li key={p.id} className="flex min-h-14 items-center gap-3 px-3.5 py-2">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[14px] font-black">
                    {p.label[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[15px] font-bold">{p.label}</span>
                      {done === undefined && !p.sweep && !out && firstTimer(world, p.id) ? <Chip tone="accent">First walk</Chip> : null}
                    </span>
                    <span className="block text-[12px] text-muted">{out ? "Can't make it" : p.sweep ? "Walks at the back" : `${miles} mi route`}</span>
                  </span>
                  {done !== undefined ? (
                    <Chip tone="ok">Was there ✓</Chip>
                  ) : canCheckIn ? (
                    <Primary className="min-h-10 px-3 text-[12.5px]" aria-label={`Check in ${p.label}`} onClick={() => setResult(send({ type: "CHECK_IN", payload: { eventId: e.id, memberId: p.id, distanceMi: miles } }, NINA))}>
                      Check in
                    </Primary>
                  ) : null}
                </li>
              );
            })}
            {guestHere ? <GuestRow demo={demo} canCheckIn={canCheckIn} /> : null}
            {walkedUp.map((c) => (
              <li key={`walked-up-${c.memberId}`} className="flex min-h-14 items-center gap-3 px-3.5 py-2">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[14px] font-black">
                  {(world.members[c.memberId]?.name ?? "?")[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">{world.members[c.memberId]?.name ?? "A walker"}</span>
                  <span className="block text-[12px] text-muted">{demo.guest?.memberId === c.memberId ? "Joined after the walk" : "Just showed up"}</span>
                </span>
                <Chip tone="ok">Was there ✓</Chip>
              </li>
            ))}
            {r.background ? <li className="px-3.5 py-3 text-[13px] text-muted">+ {r.background} more from the circle</li> : null}
            {r.named.length === 0 && !r.background && walkedUp.length === 0 && !guestHere ? <li className="px-3.5 py-3 text-[13px] text-muted">Nobody yet.</li> : null}
          </ul>
          <p className="mt-2 text-[12px] text-muted">First names only. No miles, routes or health data.</p>
        </section>

        {canCheckIn && walkUpIds.length ? (
          <section aria-label="Just showed up" className="mt-4">
            <PhoneHeading>Just showed up?</PhoneHeading>
            <p className="mt-1 text-[12.5px] text-muted">No RSVP needed. Check them in too.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {walkUpIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-label={`Check in ${world.members[id]!.name}`}
                  onClick={() => setResult(send({ type: "CHECK_IN", payload: { eventId: e.id, memberId: id, distanceMi: e.distanceOptions[0]! } }, NINA))}
                  className="min-h-10 rounded-full border border-line-strong px-3.5 text-[13px] font-bold transition-colors hover:border-accent"
                >
                  + {world.members[id]!.name}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <Note receipt={result} />

        {e.status === "published" && open ? (
          <Secondary className="mt-4 w-full" onClick={() => setResult(send({ type: "COMPLETE_EVENT", payload: { eventId: e.id } }, NINA))}>
            Wrap up the walk
          </Secondary>
        ) : null}

        {e.status === "published" && !open ? (
          <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
            <div className="text-[14px] font-bold">Unsafe weather? Call it off</div>
            <p className="mt-0.5 text-[12.5px] text-muted">One message reaches everyone who said they&apos;re coming.</p>
            {confirming && cancelReason ? (
              <div className="rise-in mt-3">
                <p className="text-[13.5px]">
                  Call off <span className="font-bold">{e.title}</span> for “{cancelReason}” and tell {told} {told === 1 ? "person" : "people"}?
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="min-h-10 flex-1 rounded-xl bg-bad px-3 text-[13px] font-black uppercase tracking-[0.05em] text-bg"
                    onClick={() => {
                      setConfirming(false);
                      setResult(send({ type: "CANCEL_EVENT", payload: { eventId: e.id, reason: cancelReason } }, NINA));
                    }}
                  >
                    Yes, tell {told}
                  </button>
                  <Secondary className="min-h-10 flex-1 text-[13px]" onClick={() => setConfirming(false)}>
                    Keep it
                  </Secondary>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {REASONS.map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => {
                      setCancelReason(x);
                      setConfirming(true);
                    }}
                    className="min-h-10 rounded-full border border-line-strong px-3 text-[13px] font-semibold hover:border-bad"
                  >
                    {x}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </AppBody>
    </>
  );
}

function NewWalk({ world, demo }: { world: World; demo: CirclesDemo }) {
  const today = Math.floor(world.clock / 1440);
  const days = useMemo(() => {
    let sat = today + 1;
    while (sat % 7 !== 0) sat++; // day 0 is Saturday, May 1
    return [
      { day: today + 1, label: "Tomorrow" },
      { day: sat, label: "Saturday" },
      { day: sat + 7, label: "Next Saturday" },
    ].filter((d) => d.day <= 122);
  }, [today]);
  const [title, setTitle] = useState("Saturday Morning Miles");
  const [day, setDay] = useState(days[1]?.day ?? days[0]!.day);
  const [minute, setMinute] = useState(8 * 60);
  const [place, setPlace] = useState("Detroit Riverwalk, Rivard Plaza");
  const [routes, setRoutes] = useState<number[]>([1, 2.5]);
  const [back, setBack] = useState("");
  const [result, setResult] = useState<Receipt | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const options = backWalkerOptions(world, demo.offers);

  const post = () => {
    setMessage(null);
    const before = new Set(Object.keys(store.get().machine.world.events));
    const drafted = send(
      {
        type: "DRAFT_EVENT",
        payload: { chapterId: LEAD_CITY, title, day, startMinute: minute, meetingArea: place, distanceOptions: routes.length ? [...routes].sort((a, b) => a - b) : [1], mode: "walk", access: ["short-option"], capacity: 40 },
      },
      NINA,
    );
    if (refused(drafted)) return setResult(drafted);
    const id = Object.keys(store.get().machine.world.events).find((k) => !before.has(k));
    if (!id) return;
    if (back) {
      const r = send({ type: "ASSIGN_SWEEP", payload: { eventId: id, memberId: back } }, NINA);
      if (refused(r)) return setResult(r);
    }
    const published = send({ type: "PUBLISH_EVENT", payload: { eventId: id } }, NINA);
    setResult(null);
    if (published.outcome === "applied") {
      setMessage({ tone: "ok", text: `Live! Everyone in Detroit can see “${title}” now.` });
    } else {
      setMessage({ tone: "warn", text: "Saved, but not live: add someone to walk at the back first. It's waiting under Walks." });
    }
  };

  return (
    <AppBody>
      <form
        aria-label="New walk"
        onSubmit={(ev) => {
          ev.preventDefault();
          post();
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="text-[13px] font-bold">Name</span>
          <input value={title} maxLength={55} onChange={(ev) => setTitle(ev.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-[15px]" />
        </label>
        <div role="group" aria-label="Day">
          <span className="text-[13px] font-bold">When</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {days.map((d) => (
              <button key={d.day} type="button" aria-pressed={day === d.day} onClick={() => setDay(d.day)} className={cn("min-h-10 rounded-full border px-3 text-[13px] font-bold", day === d.day ? "border-accent bg-accent text-on-accent" : "border-line-strong")}>
                {d.label} · {dayLabel(d.day).split(", ")[1]}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[7 * 60, 8 * 60, 18 * 60 + 30].map((m) => (
              <button key={m} type="button" aria-pressed={minute === m} onClick={() => setMinute(m)} className={cn("min-h-10 rounded-full border px-3 text-[13px] font-bold", minute === m ? "border-accent bg-accent text-on-accent" : "border-line-strong")}>
                {timeLabel(m)}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-[13px] font-bold">Where to meet</span>
          <input value={place} maxLength={80} onChange={(ev) => setPlace(ev.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-[15px]" />
        </label>
        <div role="group" aria-label="Routes">
          <span className="text-[13px] font-bold">Routes</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[1, 2.5, 4].map((d) => {
              const on = routes.includes(d);
              return (
                <button key={d} type="button" aria-pressed={on} onClick={() => setRoutes((rs) => (on ? rs.filter((x) => x !== d) : [...rs, d]))} className={cn("min-h-10 rounded-full border px-3 text-[13px] font-bold", on ? "border-accent bg-accent/15 text-accent" : "border-line-strong")}>
                  {d} mi
                </button>
              );
            })}
          </div>
        </div>
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
          Every walk says <span className="font-bold text-accent">“All paces welcome”</span> — already filled in.
        </p>
        <BackWalkerPicker value={back} onChange={setBack} options={options} label="Who walks at the back of the new walk" />
        <Primary type="submit" className="w-full">
          Go live
        </Primary>
        {message ? (
          <p role="status" className={cn("rise-in rounded-xl px-3 py-2 text-[13.5px] leading-snug", message.tone === "ok" ? "bg-ok-soft text-ok" : "bg-warn-soft text-ink")}>
            {message.text}
          </p>
        ) : null}
        <Note receipt={result} />
      </form>
    </AppBody>
  );
}

