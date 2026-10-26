"use client";

// City Circles: every circle on one map, then one phone with three hats. A
// guest scans a poster at the library — no app — picks what helps, and saves a
// spot with a first name. Nina, the City Lead, asks "What am I missing?" before
// Saturday, then checks the guest in. After the walk the guest joins in one
// tap, and the walk counts. Maya, the member, is one tap away too.
//
// What 100 Miles of Summer already has is said as theirs: kickoffs already take
// sign-ups without the app (Eventbrite, Movemint), the app says "No RSVP needed —
// just show up!", and City Leads already post walks, keep a list and call walks
// off in unsafe weather. Guests live on the screen, not in the engine: their
// miles count once they join, through the same check-in as everyone else.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AccessNeed, ChapterId, World } from "@/domain/types";
import { DataStrip } from "@/components/demo/DataStrip";
import { HowWeBuild } from "@/components/demo/HowWeBuild";
import { Ideas, type Idea } from "@/components/demo/Ideas";
import { Phone } from "@/components/demo/Phone";
import { plain } from "@/components/demo/plain";
import { Story } from "@/components/demo/Story";
import { TryIt, type Step } from "@/components/demo/TryIt";
import { Hero } from "@/components/three/Hero";
import { Stage } from "@/components/three/Stage";
import { actors, store, useLedger, useUI, useWorld } from "@/lib/store";
import { AtlasMap, ChapterList } from "./Atlas";
import { CirclesApp, type CirclesDemo, type CirclesMode, type Guest, type LeadTab } from "./CirclesApp";
import type { CircleColumn } from "./CirclesScene";
import { copilot } from "./walkRules";
import { LEAD_CITY, MAYA, NINA, SATURDAY, start } from "./phoneUi";
import { chapterPoint } from "./usShape";

const CirclesScene = dynamic(() => import("./CirclesScene"), { ssr: false, loading: () => null });

/** What Nina has already walked and checked on her live walks; the rest is listed, not checked yet. */
const SEED_CONFIRMED: Record<string, AccessNeed[]> = {
  "det-first-mile": ["step-free", "restrooms", "short-option"],
  "det-dequindre-long": ["shade"],
};

/** The city list beside the map is for wide screens; on a phone the app's own city chips do the job a screen later. */
function useWide(): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide;
}

export function CirclesLens() {
  const world = useWorld();
  const ledger = useLedger();
  const wide = useWide();
  const chapters = useMemo(() => Object.values(world.chapters), [world.chapters]);
  const [selected, setSelected] = useState<ChapterId>(LEAD_CITY);
  const [zoomed, setZoomed] = useState(false);
  const [mode, setModeState] = useState<CirclesMode>("guest");
  const [leadTab, setLeadTab] = useState<LeadTab>("walks");
  const [openEvent, setOpenEvent] = useState<string | null>(null);
  const [route, setRouteMap] = useState<Record<string, number>>({});
  const [offers, setOffers] = useState<ReadonlySet<string>>(() => new Set());
  const [needs, setNeeds] = useState<AccessNeed[]>([]);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, AccessNeed[]>>(SEED_CONFIRMED);
  const [dropout, setDropout] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const [untold, setUntoldMap] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<Record<string, string>>({});
  const scripted = useRef(false);
  const { present } = useUI();
  // In the tour, Maya has just said she is coming: show her member view, where "No RSVP needed" is the app's own words.
  const mayaComing = Boolean(world.events[SATURDAY]?.rsvps.includes(MAYA));
  useEffect(() => {
    if (present !== null && mayaComing) setModeState((m) => (m === "guest" ? "member" : m));
  }, [present, mayaComing]);

  // "Start over" resets the world; the screen's own state (the guest, what was checked) goes with it.
  const seen = useRef(ledger.length);
  useEffect(() => {
    if (ledger.length < seen.current) {
      setModeState("guest");
      setOpenEvent(null);
      setRouteMap({});
      setOffers(new Set());
      setNeeds([]);
      setGuest(null);
      setSaving(null);
      setConfirmed(SEED_CONFIRMED);
      setDropout({});
      setOpened(new Set());
      setUntoldMap({});
      setSent({});
      scripted.current = false;
    }
    seen.current = ledger.length;
  }, [ledger.length]);

  const pick = useCallback(
    (id: ChapterId) => {
      setSelected(id);
      setZoomed(true);
      setOpenEvent(null);
      // The poster is in Detroit; another city is a member's view.
      if (mode === "guest" && id !== LEAD_CITY) setModeState("member");
    },
    [mode],
  );

  const joinGuest = () => {
    if (!guest) return;
    const e = world.events[guest.eventId];
    const before = new Set(Object.keys(store.get().machine.world.members));
    const joined = store.dispatch(
      { type: "JOIN_MOVEMENT", payload: { name: guest.name, moves: ["walk"], goalLabel: "100 miles this summer", goalKind: "season-100", target: 100, chapterId: LEAD_CITY, needs: [] } },
      actors.member("guest"),
      { via: "doorway" },
    );
    if (joined.outcome !== "applied") return setGuest({ ...guest, note: plain(joined.summary) });
    const id = Object.keys(store.get().machine.world.members).find((k) => !before.has(k));
    if (!id) return;
    // The check-in Nina did at the walk carries over to the new account: one walk, counted once.
    const counted = store.dispatch({ type: "CHECK_IN", payload: { eventId: guest.eventId, memberId: id, distanceMi: e?.distanceOptions[0] ?? 1 } }, NINA, { via: "doorway" });
    setGuest({ ...guest, memberId: id, note: counted.outcome === "applied" || counted.outcome === "noop" ? null : "That walk was too long ago to count. Your next one will." });
  };

  const openCopilot = (eventId: string) => {
    setOpened((o) => new Set(o).add(eventId));
    // The week's curveball, once: the volunteer at the back of Saturday's walk can't make it.
    const e = world.events[eventId];
    const lead = e ? world.chapters[e.chapterId]?.organizers[0] : undefined;
    if (e && eventId === SATURDAY && e.sweep && e.sweep !== lead && world.clock < start(e) && !scripted.current) {
      scripted.current = true;
      setDropout((d) => ({ ...d, [eventId]: e.sweep! }));
    }
  };

  const guestEvent = guest ? world.events[guest.eventId] : undefined;
  const copilotClear = Boolean(
    guestEvent &&
      opened.has(guestEvent.id) &&
      copilot({
        world,
        event: guestEvent,
        confirmed: confirmed[guestEvent.id] ?? [],
        dropout: dropout[guestEvent.id] ?? null,
        guests: guest && !guest.memberId ? 1 : 0,
        offered: new Set(offers.size ? [MAYA] : []),
        untold: Boolean(untold[guestEvent.id]),
      }).clear,
  );
  const joinedAndCounted = (w: World) => Boolean(guest?.memberId && w.events[guest.eventId]?.checkIns.some((c) => c.memberId === guest.memberId));

  const steps: Step[] = [
    {
      id: "needs",
      label: "Scan the poster: pick two things that help",
      hint: "No app → Shade, then Step-free. Watch the list re-sort.",
      why: "The walks sort themselves, and each says what the City Lead actually checked — never just “accessible”.",
      done: () => needs.length >= 2 || guest !== null,
    },
    {
      id: "spot",
      label: "Save a spot with just a first name",
      hint: "“Save my spot” on the best fit.",
      why: "No app, no password. One reminder the day before — about 1 in 4 free sign-ups don't show up without one.",
      done: () => guest !== null,
    },
    {
      id: "copilot",
      label: "As Nina, ask “What am I missing?”",
      hint: "City Lead → open the walk → Check this walk.",
      why: "It catches what slips: a back walker who cancels, a detail nobody checked. It drafts the fix; Nina decides.",
      done: () => copilotClear || Boolean(guest?.checkedIn),
    },
    {
      id: "checkin",
      label: "Saturday 8:00: check the guest in",
      hint: "Tap “It's Sat 8:00 AM”, then Check in.",
      why: "Guests get checked in like everyone else — on Nina's phone, not a clipboard.",
      done: () => Boolean(guest?.checkedIn),
    },
    {
      id: "join",
      label: "After the walk: join in one tap",
      hint: "No app → “Join in one tap”.",
      why: "The walk she already did counts toward her 100 — counted once. The app came after the walk, not before it.",
      done: (w) => joinedAndCounted(w),
    },
  ];
  const next = steps.find((s) => !s.done(world, new Set()))?.id ?? null;

  const demo: CirclesDemo = {
    chapterId: selected,
    pick,
    mode,
    setMode: (m) => {
      setModeState(m);
      setOpenEvent(null);
      if (m !== "member") setSelected(LEAD_CITY);
    },
    leadTab,
    setLeadTab: (t) => {
      setLeadTab(t);
      setOpenEvent(null);
    },
    openEvent,
    setOpenEvent,
    next,
    route,
    setRoute: (eventId, miles) => setRouteMap((r) => ({ ...r, [eventId]: miles })),
    offers,
    offer: (eventId) => setOffers((o) => new Set(o).add(eventId)),
    needs,
    toggleNeed: (n) => setNeeds((ns) => (ns.includes(n) ? ns.filter((x) => x !== n) : [...ns, n])),
    guest,
    saving,
    setSaving,
    saveGuest: (name, eventId) => {
      setSaving(null);
      setGuest({ name, eventId, checkedIn: false, memberId: null, note: null });
    },
    dropGuest: () => setGuest(null),
    checkInGuest: () => setGuest((g) => (g ? { ...g, checkedIn: true } : g)),
    joinGuest,
    confirmed,
    confirm: (eventId, ns) => setConfirmed((c) => ({ ...c, [eventId]: [...new Set([...(c[eventId] ?? []), ...ns])] })),
    dropout,
    opened,
    openCopilot,
    untold,
    setUntold: (eventId, name) =>
      setUntoldMap((u) => {
        const copy = { ...u };
        if (name) copy[eventId] = name;
        else delete copy[eventId];
        return copy;
      }),
    sent,
    sendNote: (eventId, note) => setSent((s) => ({ ...s, [eventId]: note })),
  };

  const members = useMemo(() => Object.fromEntries(chapters.map((c) => [c.id, c.backgroundMembers + c.members.length])), [chapters]);
  // What the 3D map draws: the same member counts as the list, and each circle's walks still to come.
  const columns = useMemo<CircleColumn[]>(
    () =>
      chapters.map((c) => ({
        id: c.id,
        city: c.city,
        members: members[c.id] ?? 0,
        upcoming: Object.values(world.events).filter((e) => e.chapterId === c.id && e.status === "published" && e.day * 1440 + e.startMinute >= world.clock).length,
        at: chapterPoint(c),
      })),
    [chapters, members, world.events, world.clock],
  );

  /** The co-pilot works before a walk starts: the guest's walk if it's still ahead, else Detroit's next one. */
  const nextLeadWalk = (): string | null => {
    const ahead = Object.values(world.events)
      .filter((e) => e.chapterId === LEAD_CITY && e.status === "published" && start(e) > world.clock)
      .sort((a, b) => start(a) - start(b));
    return (guest && ahead.find((e) => e.id === guest.eventId)?.id) ?? ahead.find((e) => e.id === SATURDAY)?.id ?? ahead[0]?.id ?? null;
  };

  const showHat = (m: CirclesMode, eventId: string | null = null) => {
    demo.setMode(m);
    if (m === "lead") {
      setLeadTab("walks");
      setOpenEvent(eventId);
    }
  };

  // Three ideas that work on the phone, each a different job; two that come next.
  const ideas: Idea[] = [
    {
      title: "First-Mile Doorway",
      line: "Your kickoffs already take sign-ups without the app. This makes every weekly walk work that way: a poster, a first name, one reminder — and the app only after the walk, if they want it.",
      state: "live",
      origin: "yours",
      image: "/brand/hero_1.jpg",
      show: () => showHat("guest"),
    },
    {
      title: "Walks That Fit You",
      line: "Pick what helps — shade, benches, step-free — and the walks sort themselves, each saying what the City Lead checked and what's only listed.",
      state: "live",
      origin: "new",
      show: () => showHat("guest"),
    },
    {
      title: "The Lead's Co-Pilot",
      line: "“What am I missing?” checks the back walker, what's listed, the heat and the room — then drafts the fix. Nothing sends until the Lead says so.",
      state: "live",
      origin: "new",
      show: () => showHat("lead", nextLeadWalk()),
    },
    {
      title: "City Lead Fellowship",
      line: "Kayla hand-picks City Leads today. This adds a way to raise your hand, three short lessons, a small stipend and a mentor — because about 3 in 10 volunteers don't come back the next year.",
      state: "next",
      origin: "yours",
    },
    {
      title: "Ready-to-Walk Check",
      line: "Before a walk goes live: a back walker, the route's access notes, a heat-and-air check, and the message ready if it's called off. Anything missing waits for the Lead's OK.",
      state: "next",
      origin: "new",
    },
    {
      title: "Stories of Your City",
      line: "A walk that tells the city's story — the riverfront in Detroit, the lakefront in Chicago — with stops a City Lead reviews.",
      state: "next",
      origin: "new",
    },
  ];

  return (
    <div>
      <Hero
        mode="golden"
        eyebrow="City Circles"
        title="Strangers on Saturday. *Friends by August.*"
        lede="Seven cities, a City Lead in each, and a walk this week that fits you. No app needed to show up."
        actions={
          <Story
            title="Nobody walks *alone.*"
            beats={[
              { text: "Walking up to a group of strangers is the hardest mile." },
              { text: "So the first step shouldn't need an app: a poster, a first name, a reminder — and *a friendly face* at the start." },
              { text: "The slowest first-timers are the ones who don't come back. That's why someone always *walks at the back.*" },
              { text: "And the City Lead isn't alone either: one tap checks what's missing before Saturday." },
            ]}
            close="Try it below: be the guest, then be Nina."
          />
        }
        stage={
          <Stage
            name="circles"
            scene={CirclesScene}
            props={{ circles: columns, selected, began: "chicago", onSelect: pick }}
            fallback={
              <div className="absolute inset-y-0 right-0 flex w-full items-center px-4 pt-16 lg:w-[62%] lg:pr-10">
                <AtlasMap chapters={chapters} selected={selected} zoomed={zoomed} onSelect={pick} onZoomOut={() => setZoomed(false)} framed={false} />
              </div>
            }
          />
        }
        side={wide ? <ChapterList chapters={chapters} selected={selected} onSelect={pick} members={members} viewerChapter={world.members[MAYA]?.chapterId ?? null} /> : undefined}
      />

      <DataStrip
        className="mt-6"
        points={[
          { value: "2 in 3", line: "first-timers at a free weekly 5K came back for more." },
          { value: "1 in 8", line: "adults have trouble walking or climbing stairs. A walk has to fit them." },
          { value: "51%", line: "of Black women feel safe walking alone at night near home, against 77% of white women. Walking together changes that." },
        ]}
      />

      <TryIt
        index="01"
        title="Show up *without the app.*"
        intro="Scan a poster in Detroit, pick a walk that fits, and save a spot with a first name. Then switch to Nina, the City Lead, and get Saturday right."
        steps={steps}
        phone={
          <Phone label="City Circles app">
            <CirclesApp world={world} demo={demo} />
          </Phone>
        }
        finale="That's the doorway: a poster, a first name, a walk that fits — and a City Lead who knows what's missing before anyone arrives."
        example="Tasha started their summer in Detroit."
      />

      <Ideas index="02" title="Ideas for *every circle.*" intro="The first three work on the phone above. The first builds on sign-ups you already take without the app." ideas={ideas} />

      <HowWeBuild
        index="03"
        lines={[
          { what: "Events tab", how: "Already in your FlutterFlow app. Today it lists past meetups; the change is to put each city's upcoming walks first.", effort: "Have" },
          { what: "No-app sign-up", how: "A FlutterFlow web page per walk, reached by a QR code. A guest_signups table keeps a first name and an optional contact for one reminder, deleted after the season unless they join.", effort: "M" },
          { what: "Joining keeps the walk", how: "Joining links the guest's check-in to the new account, so that walk counts once — the same event_checkin row as everyone else's.", effort: "S" },
          { what: "Walks that fit", how: "Each walk's access tags gain checked_by and checked_at. The list sorts by what a person picked; their picks stay on their phone.", effort: "S" },
          { what: "The Lead's co-pilot", how: "A rules check over one walk's own row — back walker, unchecked tags, start time against the forecast, coming against room. It drafts the note; the Lead sends it.", effort: "M" },
          { what: "No walk without a back walker", how: "A CHECK constraint: a walk can't be “published” until someone is named to walk at the back. The app shows why.", effort: "S" },
        ]}
        note="City Leads need sign-in tied to Supabase first (Firebase sign-in, row rules), so the Lead's side lands right after that. The guest page needs none of it."
      />
    </div>
  );
}
