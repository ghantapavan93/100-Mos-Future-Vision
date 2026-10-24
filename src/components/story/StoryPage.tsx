"use client";

// The Story: one long summer day as you scroll — dawn (the first step), day
// (where it started), golden hour (what it could become), night (the
// machinery), and dawn again. Every factual claim about 100 Miles of Summer or
// Kayla Jeter below is from a public source listed at the end; everything
// forward-looking is labelled as proposed.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Hot, cn } from "@/components/ui/kit";
import { Reveal, Words } from "@/components/ui/Reveal";
import { DataStrip } from "@/components/demo/DataStrip";
import { Story } from "@/components/demo/Story";
import { hotWord } from "@/components/demo/TryIt";
import { Marquee } from "@/components/ui/Marquee";
import { Inspectable } from "@/components/inspect/Inspect";
import { LENSES } from "@/lib/lenses";
import { store, useUI } from "@/lib/store";
import { ScenePoster } from "./ScenePoster";
import { probeGpu } from "@/components/three/Stage";

const FirstStepScene = dynamic(() => import("./FirstStepScene"), { ssr: false, loading: () => null });

const BEATS = [
  { title: "Every *first mile* looks like this.", sub: "One person. Not sure they belong. Moving anyway." },
  { title: "Small. Steady. *Yours.*", sub: "Here, a slow mile counts exactly as much as a fast one." },
  { title: "Then you *look up.*", sub: "Walkers, joggers, runners and rollers, heading for the same start line." },
  { title: "100 miles is *the invitation.*", sub: "Ten summers in. Here's where it goes next — and every screen works." },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

type Render = "pending" | "webgl" | "poster";
/** Why the still is showing, so nobody is told "WebGL unavailable" when it was a choice. */
type Reason = "forced" | "unsupported" | "lost" | "reduced" | null;

export function StoryPage() {
  const reducedOS = useReducedMotion();
  const { motionPaused } = useUI();
  const reduced = reducedOS || motionPaused;
  const [beat, setBeat] = useState(0);
  const [render, setRender] = useState<Render>("pending");
  const [reason, setReason] = useState<Reason>(null);
  const [portrait, setPortrait] = useState(false);
  const [active, setActive] = useState(true);
  const [dense, setDense] = useState(true);
  const [probe, setProbe] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  const hero = useRef<HTMLElement>(null);

  useEffect(() => {
    setPortrait(window.innerWidth / window.innerHeight < 0.9);
    const params = new URLSearchParams(window.location.search);
    setProbe(params.get("probe") === "1");
    const hash = window.location.hash.match(/^#story\/(\d)$/);
    if (hash) setBeat(Math.min(3, Number(hash[1]) - 1));
    if (params.get("render") === "poster") {
      setRender("poster");
      setReason("forced");
      return;
    }
    // The GPU probe waits until after the first paint, so the words and the poster never wait on it.
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        const gpu = probeGpu();
        // `?tier=high` lets scripts/render-stills.mjs capture a sharp poster in a software renderer.
        const forced = params.get("tier");
        const tier = forced === "high" || forced === "mid" || forced === "low" ? forced : gpu.tier;
        setDense(tier === "high" && window.innerWidth >= 900);
        if (!gpu.ok) {
          setRender("poster");
          setReason("unsupported");
        } else setRender("webgl");
      }, 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!hero.current) return;
    const io = new IntersectionObserver(([e]) => setActive(Boolean(e?.isIntersecting) && document.visibilityState === "visible"), { threshold: 0.05 });
    io.observe(hero.current);
    const vis = () => setActive(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const go = useCallback((b: number) => {
    const next = Math.max(0, Math.min(3, b));
    setBeat(next);
    history.replaceState(null, "", `#story/${next + 1}`);
  }, []);

  const onFail = useCallback(() => {
    setReason("lost");
    setRender("poster");
  }, []);

  // Arrow keys step the story while the opening is on screen, wherever focus is.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === "ArrowRight") go(beat + 1);
      if (e.key === "ArrowLeft") go(beat - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, beat, go]);

  // Reduced motion (the OS setting or the Pause motion control) shows the still and never loads three.js.
  const showWebGL = render === "webgl" && !reduced;
  // When the 3D won't run, by choice or by device, the drawn poster follows the story beat by beat.
  const drawn = render === "poster" || (render === "webgl" && reduced);
  const stillReason: Reason = reduced && render === "webgl" ? "reduced" : reason;

  const b = BEATS[beat]!;
  // The same sky as the 3D scene's dome (top, middle, horizon), then dark ground: what shows while
  // three.js loads and behind the reduced-motion still.
  const sky = [
    "linear-gradient(180deg,#120f1a 0%,#3b2433 24%,#7a4236 38%,#2a1d28 44%,#120f1a 100%)",
    "linear-gradient(180deg,#151120 0%,#56303a 22%,#b45c3c 37%,#3a2430 43%,#151120 100%)",
    "linear-gradient(180deg,#1b1628 0%,#7a4038 14%,#de8644 24%,#56302f 30%,#1b1628 100%)",
    "linear-gradient(180deg,#221a30 0%,#4a2d3c 40%,#6b3a2e 70%,#2a1d28 100%)",
  ][beat]!;

  return (
    <div>
      {/* ── DAWN: the first step ───────────────────────────────────────── */}
      <section
        ref={hero}
        aria-label="The first step"
        data-mode="dawn"
        data-render={showWebGL ? "webgl" : render === "pending" ? "pending" : "still"}
        data-still-reason={stillReason ?? undefined}
        data-scene-ready={sceneReady ? "true" : "false"}
        className="relative -mt-14 flex min-h-[100svh] flex-col overflow-hidden pt-14"
        style={{ background: sky, transition: "background 900ms cubic-bezier(0.2,0,0,1)" }}
      >
        <Inspectable id="first-step" className="absolute inset-0">
          <div className="absolute inset-0">
            {/* First paint: a picture of the scene's first frame, wide or upright by CSS, so nothing jumps
                when the page wakes up. The live scene fades in over it once its first frame is up. */}
            <picture className={cn("absolute inset-0 transition-opacity duration-700 ease-out", (showWebGL && sceneReady) || drawn ? "opacity-0" : "opacity-100")}>
              <source media="(max-aspect-ratio: 9/10)" srcSet="/posters/home-tall.webp" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/posters/home-wide.webp" alt="" decoding="async" fetchPriority="high" className="h-full w-full object-cover" />
            </picture>
            {drawn ? <ScenePoster beat={beat} portrait={portrait} className="absolute inset-0 h-full w-full" /> : null}
            {showWebGL ? (
              <div className={cn("absolute inset-0 transition-opacity duration-700 ease-out", sceneReady ? "opacity-100" : "opacity-0")}>
                <FirstStepScene beat={beat} dense={dense} active={active} probe={probe} onFail={onFail} onReady={onSceneReady} />
              </div>
            ) : null}
          </div>
        </Inspectable>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(0deg,rgba(18,15,26,0.92),rgba(18,15,26,0))]" />
        {/* Keeps every line from cutting through the words: text contrast never depends on the scene. */}
        {/* Only where the words are: over the sky it would grey the sun out. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,rgba(18,15,26,0.82)_0%,rgba(18,15,26,0.55)_38%,rgba(18,15,26,0)_66%)] [mask-image:linear-gradient(0deg,#000_42%,transparent_72%)] sm:w-[78%]" />

        <div className="relative z-10 mx-auto mt-auto w-full max-w-[1240px] px-4 pb-10 sm:px-6 lg:px-8 lg:pb-14">
          <div className="kicker">
            <span className="hidden sm:inline">100 Miles of Summer · </span>Year 10 and beyond
          </div>
          <div aria-live="polite" key={beat} className="rise-in mt-4 max-w-[860px]">
            {/* Two lines are always reserved, so the words never jump between beats. */}
            <h1 className="display min-h-[1.9em] text-[46px] text-ink sm:text-[72px] lg:text-[100px]">
              <Hot text={b.title} />
            </h1>
            <p className="mt-4 max-w-[560px] text-[18px] leading-relaxed text-ink opacity-90 sm:text-[20px]">{b.sub}</p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {beat < 3 ? (
              <button type="button" onClick={() => go(beat + 1)} className="tap rounded-xl bg-accent px-6 text-[15px] font-black uppercase tracking-[0.08em] text-on-accent shadow-[0_8px_30px_-8px_rgba(255,106,19,0.7)]">
                Continue
              </button>
            ) : (
              <>
                <a href="#next" className="tap inline-flex items-center rounded-xl bg-accent px-6 text-[15px] font-black uppercase tracking-[0.08em] text-on-accent shadow-[0_8px_30px_-8px_rgba(255,106,19,0.7)]">
                  See where it goes
                </a>
                <button type="button" onClick={() => store.setUI({ present: 0 })} className="tap rounded-xl border border-line-strong px-6 text-[15px] font-bold text-ink">
                  Take the tour · 13 stops
                </button>
              </>
            )}
            {beat > 0 ? (
              <button type="button" onClick={() => go(beat - 1)} className="tap rounded-full px-4 text-[14px] text-muted underline-offset-4 hover:underline">
                Back
              </button>
            ) : null}
            {beat < 3 ? (
              <button type="button" onClick={() => go(3)} className="tap rounded-full px-4 text-[14px] text-muted underline-offset-4 hover:underline">
                Skip intro
              </button>
            ) : null}
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <ol className="flex gap-2" aria-label="Story beats">
              {BEATS.map((x, i) => (
                <li key={i}>
                  <button
                    type="button"
                    aria-label={`Beat ${i + 1}: ${x.title.replaceAll("*", "")}`}
                    aria-current={i === beat ? "step" : undefined}
                    onClick={() => go(i)}
                    className={cn("h-11 w-11 rounded-full", "flex items-center justify-center")}
                  >
                    <span className={cn("block h-1.5 rounded-full transition-all duration-300", i === beat ? "w-8 bg-accent" : "w-3 bg-line-strong")} />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <Marquee />
      <Today />
      <Together />
      <WhyItWorks />
      <WhereNext />
      <TryEverything />
      <ThreeSummers />
      <Closing />
    </div>
  );
}

/** Real community photos, used with the team's permission. They show the movement, never a sample person. */
function Photo({ src, alt, className, position = "50% 50%" }: { src: string; alt: string; className?: string; position?: string }) {
  return (
    <figure className={cn("group relative overflow-hidden rounded-[22px] border border-line shadow-[var(--shadow)]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[var(--ease-enter)] group-hover:scale-[1.03]" style={{ objectPosition: position }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_60%,rgba(0,0,0,0.55))]" />
    </figure>
  );
}

// ── TODAY: what 100 Miles of Summer already is ──────────────────────────────

// The movement's own numbers, as it reports them each season.
const TODAY: { big: string; small: string; line: string }[] = [
  { big: "10,000+", small: "movers", line: "walked, ran and rolled in Year 9." },
  { big: "100,000+", small: "miles", line: "together in Year 8, past an 80,000 goal." },
  { big: "7", small: "cities", line: "with City Leads hosting meetups." },
  { big: "580+", small: "at kickoff", line: "in Chicago — many at their first group run." },
];

function Today() {
  return (
    <section id="today" aria-labelledby="today-title" data-mode="day" className="bg-bg py-20 text-ink sm:py-28">
      <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8">
        <div>
          <div className="index-line">
            <b>01</b> Nine summers in
          </div>
          <h2 id="today-title" className="display mt-6 text-[44px] sm:text-[72px]">
            <Words text="What you've *already built.*" render={hotWord} />
          </h2>
          <Reveal>
            <p className="mt-5 max-w-[560px] text-[18px] leading-relaxed text-muted">
              It started in Chicago in 2018 with a simple goal: 100 miles, May 1 to August 31, any pace. Nine summers later it is a ritual for thousands — and Year 10 starts on May 1, 2027.
            </p>
          </Reveal>
          <ul className="mt-10 grid grid-cols-2 gap-3">
            {TODAY.map((t, i) => (
              <Reveal as="li" key={`${t.big} ${t.small}`} delay={70 * i} className="card p-5">
                {/* Number, then its word, then the line: the same three rows in every tile. */}
                <div className="font-[family-name:var(--font-display)] text-[clamp(30px,3.4vw,40px)] font-black uppercase leading-none tracking-[-0.04em] text-accent">{t.big}</div>
                <div className="mt-2 font-[family-name:var(--font-display)] text-[14px] font-black uppercase tracking-[0.06em]">{t.small}</div>
                <p className="mt-1 text-[14.5px] leading-snug text-muted">{t.line}</p>
              </Reveal>
            ))}
          </ul>
        </div>
        <Photo src="/brand/hero_3.jpg" alt="Runners in 100 Miles of Summer shirts on a Chicago riverwalk, smiling mid-stride." className="aspect-[4/3] sm:aspect-[5/4] lg:aspect-[4/5]" position="50% 35%" />
      </div>
    </section>
  );
}

/** The loudest moment on the page: real people, and the promise the whole platform is built around. */
function Together() {
  return (
    <section data-mode="night" aria-labelledby="together-title" className="anthem relative isolate overflow-hidden bg-bg text-ink">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/hero_1.jpg" alt="About thirty members of the 100 Miles of Summer community, arms raised, in front of a wooden wall." loading="lazy" decoding="async" className="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_60%] opacity-70" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(7,7,7,0.92)_0%,rgba(7,7,7,0.55)_55%,rgba(7,7,7,0.2)_100%),linear-gradient(0deg,rgba(7,7,7,0.9),transparent_45%)]" />
      <div className="mx-auto flex min-h-[78svh] max-w-[1240px] flex-col justify-end px-4 py-20 sm:px-6 lg:px-8">
        <div className="kicker self-start">The heart of it</div>
        <h2 id="together-title" className="display mt-5 max-w-[900px] text-[48px] sm:text-[80px] lg:text-[104px]">
          <Words text="Nobody has to *go it alone.*" render={hotWord} />
        </h2>
        <Reveal>
          <p className="mt-6 max-w-[600px] text-[18px] leading-relaxed text-ink/85">
            That is what your City Leads already prove every summer. Everything that follows is built to make the first walk less scary and the hundredth mile feel earned — and never to get in the way of the people.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ── WHY IT WORKS: the case in three numbers ─────────────────────────────────

function WhyItWorks() {
  return (
    <section aria-labelledby="why-title" data-mode="night" className="bg-bg py-20 text-ink sm:py-28">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="index-line">
          <b>02</b> Why it works
        </div>
        <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
          <h2 id="why-title" className="display text-[44px] sm:text-[72px]">
            <Words text="People stay when they *have people.*" render={hotWord} />
          </h2>
          <Reveal className="flex flex-col items-start gap-4">
            <p className="t-lede">Most new habits fade by spring. The ones that last have a group, a small goal and someone who notices. That is the whole idea behind what comes next.</p>
            <Story
              title="Why *people* beat apps"
              stat={{ value: "6 in 10", line: "new gym members stop going before their third month." }}
              beats={[
                { text: "Most people who start moving stop within weeks. Not for lack of trying — because nobody would notice if they didn't show up." },
                { text: "Workouts with ten or more people last about *40% longer* than solo ones. Group runs where volunteers walk alongside newcomers grew walker turnout by more than half." },
                { text: "100 Miles of Summer already has the hard part: a goal anyone can reach, City Leads people trust, and a summer that ends on a date." },
                { text: "The software's only job is to make that easier to *find, join and keep doing* — in every city, not just the ones with a big kickoff." },
              ]}
              close="Next: three ideas that build on what you have."
            />
          </Reveal>
        </div>
      </div>
      <DataStrip
        className="mt-10"
        points={[
          { value: "6 in 10", line: "new gym members stop going before their third month." },
          { value: "40%", line: "longer workouts when ten or more people move together than when alone." },
          { value: "55%", line: "more walkers showed up once group runs added volunteers to walk alongside them." },
        ]}
      />
    </section>
  );
}

// ── NEXT: three ideas, each one tappable ────────────────────────────────────

const NEXT: { title: string; yours: string; adds: string; href: string; cta: string; image: string }[] = [
  {
    title: "Every first walk, *never alone.*",
    yours: "Your City Leads already host meetups for first-timers.",
    adds: "A walk every week in every city, someone at the back so nobody finishes last, and a heads-up in one tap.",
    href: "/circles",
    cta: "Try City Circles",
    image: "/renders/circles.webp",
  },
  {
    title: "Your miles, *your choice.*",
    yours: "Your app already brings in miles from Apple Health, Health Connect, Garmin, or typed by hand.",
    adds: "The same walk from two apps counts once, a plain answer to \"why is my total…?\", and each mover decides who sees their miles.",
    href: "/member",
    cta: "Try the member app",
    image: "/renders/member.webp",
  },
  {
    title: "A city's summer, *sponsored.*",
    yours: "lululemon already hosts your Chicago and LA events, and you never sell anyone's data.",
    adds: "A ready package any brand can fund for one city, a report they can forward, and members' names never shared.",
    href: "/partner",
    cta: "Try Sponsors",
    image: "/renders/partner.webp",
  },
];

function WhereNext() {
  return (
    <section id="next" aria-labelledby="next-title" data-mode="golden" className="bg-bg py-20 text-ink sm:py-28">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="index-line">
          <b>03</b> Where it goes next
        </div>
        <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
          <h2 id="next-title" className="display text-[44px] sm:text-[72px]">
            <Words text="Built on *what you have.*" render={hotWord} />
          </h2>
          <Reveal>
            <p className="t-lede">Three ideas. Each starts from something 100 Miles of Summer already does, and each is a working screen you can tap.</p>
          </Reveal>
        </div>
        <ul className="mt-12 grid gap-5 lg:grid-cols-3">
          {NEXT.map((n, i) => (
            <Reveal as="li" key={n.href} delay={90 * i}>
              <Link href={n.href} className="group card flex h-full flex-col overflow-hidden">
                <span className="relative block aspect-[16/8] overflow-hidden bg-surface-2 sm:aspect-[16/10]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={n.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-enter)] group-hover:scale-[1.05]" />
                  <span className="num absolute left-4 top-4 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-bold text-accent backdrop-blur">0{i + 1}</span>
                </span>
                <span className="flex flex-1 flex-col p-6">
                  <span className="font-[family-name:var(--font-display)] text-[28px] font-black uppercase leading-[0.95] tracking-[-0.03em] sm:text-[30px]">
                    <Hot text={n.title} />
                  </span>
                  <span className="mt-4 text-[14px] font-semibold uppercase tracking-[0.08em] text-muted">Already yours</span>
                  <span className="mt-1 text-[15.5px] leading-relaxed text-ink/85">{n.yours}</span>
                  <span className="mt-3 text-[14px] font-semibold uppercase tracking-[0.08em] text-accent-ink">What this adds</span>
                  <span className="mt-1 flex-1 text-[15.5px] leading-relaxed text-ink/85">{n.adds}</span>
                  <span className="mt-6 inline-flex items-center gap-2 text-[14px] font-bold text-accent-ink">
                    {n.cta} <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── TRY: every screen, one tap away ─────────────────────────────────────────

function TryEverything() {
  const primary = LENSES.filter((l) => l.primary && l.href !== "/");
  const more = LENSES.filter((l) => !l.primary);
  // The first two screens lead, two to a row; the rest share one row (three or four across), so no card is left alone.
  const rest = primary.length - 2;
  const restSpan = rest % 4 === 0 ? "lg:col-span-3" : "lg:col-span-4";
  return (
    <section id="try-everything" aria-labelledby="try-title" data-mode="night" className="bg-bg py-20 text-ink sm:py-28">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="index-line">
          <b>04</b> Try it yourself
        </div>
        <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
          <h2 id="try-title" className="display text-[44px] sm:text-[72px]">
            <Words text="Tap through *a whole summer.*" render={hotWord} />
          </h2>
          <Reveal className="flex flex-col items-start gap-5">
            <p className="t-lede">A mover logs a walk, a City Lead sees who&apos;s coming, a sponsor&apos;s money pays for the next walk. It&apos;s all connected — open any screen and try it.</p>
            <Button variant="primary" onClick={() => store.setUI({ present: 0 })}>
              Take the tour · 13 stops
            </Button>
          </Reveal>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {primary.map((l, i) => (
            <Reveal as="li" key={l.href} delay={60 * i} className={i < 2 ? "lg:col-span-6" : restSpan}>
              <Link href={l.href} className="group card flex h-full flex-col overflow-hidden">
                <span className="relative block aspect-[16/8] overflow-hidden bg-surface-2 sm:aspect-[16/10]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/renders${l.href}.webp`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-enter)] group-hover:scale-[1.05]" />
                </span>
                <span className="flex flex-1 flex-col p-5">
                  <span className="eyebrow">For {l.who}</span>
                  <span className="mt-2 font-[family-name:var(--font-display)] text-[24px] font-black uppercase leading-none tracking-[-0.02em]">{l.label}</span>
                  <span className="mt-2 flex-1 text-[15px] leading-snug text-muted">{l.promise}</span>
                  <span className="mt-4 inline-flex items-center gap-2 text-[14px] font-bold text-accent-ink">
                    Open <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
        <Reveal className="mt-10">
          <div className="eyebrow">Also worth a look</div>
          <ul className="mt-3 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {more.map((l) => (
              <li key={l.href} className="bg-surface">
                <Link href={l.href} className="group flex h-full flex-col p-5 hover:bg-surface-2">
                  <span className="text-[16px] font-bold">{l.label}</span>
                  <span className="mt-1 text-[14px] leading-snug text-muted">{l.promise}</span>
                  <span className="mt-2 text-[12.5px] text-muted">For {l.who}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

// ── HOW WE GET THERE: three summers ─────────────────────────────────────────

const SUMMERS: { year: string; name: string; line: string }[] = [
  { year: "2027", name: "Ten summers strong", line: "Year 10: every city kicks off together, City Leads get their toolkit, company teams start as you planned, and the first city package is paid for." },
  { year: "2028", name: "Repeat it", line: "The new cities and partners you've said are coming, with a city kit that works and sponsors who return because they saw the report." },
  { year: "2029", name: "Grow it", line: "City packages and company teams carry more of the season, and a bigger share goes to programs movers pick." },
];

function ThreeSummers() {
  return (
    <section aria-labelledby="summers-title" data-mode="golden" className="bg-bg py-20 text-ink sm:py-28">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="index-line">
          <b>05</b> How we get there
        </div>
        <h2 id="summers-title" className="display mt-6 text-[44px] sm:text-[72px]">
          <Words text="Three summers, *one step at a time.*" render={hotWord} />
        </h2>
        <ol className="relative mt-12 grid gap-5 lg:grid-cols-3">
          {SUMMERS.map((s, i) => (
            <Reveal as="li" key={s.year} delay={90 * i} className="card relative p-6">
              {/* The year, then its name under it: the same shape in every card at every width. */}
              <div className="flex flex-col items-start gap-2.5">
                <span className="font-[family-name:var(--font-display)] text-[48px] font-black leading-none tracking-[-0.04em] text-accent">{s.year}</span>
                <span className="font-[family-name:var(--font-display)] text-[14px] font-black uppercase tracking-[0.08em]">{s.name}</span>
              </div>
              <p className="mt-4 text-[16px] leading-relaxed text-muted">{s.line}</p>
            </Reveal>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/vision" className="tap inline-flex items-center rounded-xl border border-accent/60 bg-accent/10 px-5 text-[15px] font-bold hover:border-accent">
            See the big picture →
          </Link>
          <Link href="/future" className="tap inline-flex items-center rounded-xl border border-line-strong px-5 text-[15px] font-bold hover:border-accent">
            Plan the next 3 summers
          </Link>
          <Link href="/build" className="tap inline-flex items-center rounded-xl border border-line-strong px-5 text-[15px] font-bold hover:border-accent">
            See the roadmap
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── CLOSE ───────────────────────────────────────────────────────────────────

function Closing() {
  return (
    <section data-mode="dawn" className="relative overflow-hidden bg-bg py-24 text-ink sm:py-32">
      <ScenePoster beat={3} className="absolute inset-0 h-full w-full opacity-60" label="Every line meeting at one start line." />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(20,15,34,0.25),rgba(20,15,34,0.9))]" />
      <div className="relative mx-auto max-w-[1000px] px-4 text-center sm:px-6">
        <figure className="mx-auto mb-12 max-w-[1024px] overflow-hidden rounded-2xl border border-line shadow-[var(--glow)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/hero_5.jpg" alt="A large group of 100 Miles of Summer members together outdoors, with the 100 Miles of Summer mark." loading="lazy" decoding="async" className="block h-auto w-full" />
        </figure>
        <div className="kicker">Let&apos;s build it</div>
        <h2 className="display mt-5 text-[48px] sm:text-[80px]">
          <Hot text="The next *100 miles.*" />
        </h2>
        <p className="mx-auto mt-5 max-w-[620px] text-[19px] leading-relaxed text-ink/90">
          Find your people. Find your place. Find your next reason to move. Every screen here works — tap anything.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="primary" onClick={() => store.setUI({ present: 0 })}>
            Take the tour · 13 stops
          </Button>
          <Link href="/vision" className="tap inline-flex items-center rounded-xl border border-line-strong px-6 text-[15px] font-bold hover:border-accent">
            See the big picture
          </Link>
        </div>
      </div>
    </section>
  );
}
