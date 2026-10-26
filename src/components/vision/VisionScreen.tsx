"use client";

// The Big picture: the Living Movement Network. One line on top — find your
// people, find your place, find your next reason to move — over a living 3D
// city, and a seven-scene story you step through: a first-timer finds a walk
// without the app, a route that fits her, a City Lead who made sure nobody
// walks alone, a partner who funds the next walks, a street made better, and
// all seven cities passing one baton on Year 10's opening day. Then the five
// summers it could take, every idea on one map, and how it lands on the app
// they run today.
//
// Sample people and numbers, the same world every screen reads.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataStrip } from "@/components/demo/DataStrip";
import { HowWeBuild } from "@/components/demo/HowWeBuild";
import { Story } from "@/components/demo/Story";
import { hotWord } from "@/components/demo/TryIt";
import { LIGHT } from "@/components/three/palette";
import { Stage } from "@/components/three/Stage";
import { Words } from "@/components/ui/Reveal";
import { cn } from "@/components/ui/kit";
import { useWorld } from "@/lib/store";
import { buildDistrict } from "./city";
import { FiveSummers } from "./FiveSummers";
import { IdeasMap } from "./IdeasMap";
import { Keynote } from "./Keynote";
import { SCENE_COUNT, sceneWords, type StoryCast } from "./scenes";
import type { Needs } from "./LivingCityScene";

const LivingCityScene = dynamic(() => import("./LivingCityScene"), { ssr: false, loading: () => null });

const BG = LIGHT.dawn.bg;
/** `#rrggbb` plus a two-digit alpha. */
const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
const NEW_TREES = buildDistrict().newTrees.length;
/** Where the hero's words start on wide screens: the 1240px column, centred, inside its 32px padding. */
const TEXT_LEFT = "max(32px, 50% - 588px)";

const LEDE = "Nine summers built a movement. The next five can build a network: the right walk for every person, better streets for every walk, and seven cities moving as one.";

function WhyStory({ className }: { className?: string }) {
  return (
    <Story
      className={cn("min-h-10 px-3.5 text-[13.5px]", className)}
      title="Why a *network*, not another app"
      stat={{ value: "1 in 2", line: "American adults say they've felt lonely. A weekly walk is a way to find your people." }}
      beats={[
        { text: "A fitness app counts miles. A movement brings people together — and *that's the part nobody can copy.*" },
        { text: "The next five summers make the first walk easy to find, easy to fit and easy to come back to, in every city." },
        { text: "Partners fund what works: more walks, better streets, new City Leads." },
        { text: "The app stays quiet. The people, the places and the trust do the work." },
      ]}
      close="Step through the seven scenes, then the five summers below."
    />
  );
}

export function VisionScreen() {
  const world = useWorld();
  const [scene, setScene] = useState(0);
  const [needs, setNeeds] = useState<Needs>({ stepFree: true, shade: true, rest: true });
  const hero = useRef<HTMLElement>(null);
  const inView = useRef(true);

  const cities = useMemo(() => Object.fromEntries(Object.values(world.chapters).map((c) => [c.id, c.city])), [world.chapters]);
  const cast = useMemo<StoryCast>(() => {
    const walk = world.events["det-first-mile"];
    const sweep = walk?.sweep ? world.members[walk.sweep]?.name : undefined;
    // Everyone already coming to Saturday's walk, plus her.
    const already = walk ? walk.rsvps.length + (walk.backgroundRsvps ?? 0) : 17;
    return { lead: world.chapters.detroit?.leadName ?? "Nina", sweep: sweep ?? "James", coming: already + 1 };
  }, [world]);
  const words = useMemo(() => sceneWords(cast), [cast]);

  const go = useCallback((n: number) => setScene(Math.max(0, Math.min(SCENE_COUNT - 1, n))), []);
  const finish = useCallback(() => document.getElementById("five-summers")?.scrollIntoView({ behavior: "smooth", block: "start" }), []);

  // ← → step the story while it's on screen, wherever focus is (never while typing).
  useEffect(() => {
    const el = hero.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (inView.current = Boolean(e?.isIntersecting)), { threshold: 0.35 });
    io.observe(el);
    const onKey = (e: KeyboardEvent) => {
      if (!inView.current || e.altKey || e.metaKey || e.ctrlKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowRight") setScene((s) => Math.min(SCENE_COUNT - 1, s + 1));
      if (e.key === "ArrowLeft") setScene((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      io.disconnect();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div>
      <section ref={hero} aria-labelledby="vision-title" data-hero="dawn" className="relative isolate overflow-hidden" style={{ background: BG }}>
        <div className="absolute inset-0 -z-20">
          <Stage
            name="vision"
            scene={LivingCityScene}
            props={{ scene, needs, cities, lead: cast.lead, coming: cast.coming }}
            fallback={<div className="absolute inset-0" style={{ background: "radial-gradient(60% 55% at 68% 38%, #3a2550 0%, #140f22 70%)" }} />}
          />
        </div>
        {/* Scrims keep the words readable over any frame: the left on wide screens, the bottom on phones.
            The left one is measured from the words' own column, so it holds through the end of the lede at
            any width, where close-up scenes bring lit windows near the words. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden lg:block" style={{ background: `linear-gradient(90deg, ${alpha(BG, 0.94)} 0px, ${alpha(BG, 0.82)} calc(${TEXT_LEFT} + 420px), ${alpha(BG, 0.42)} calc(${TEXT_LEFT} + 580px), ${alpha(BG, 0)} calc(${TEXT_LEFT} + 760px))` }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 lg:hidden" style={{ background: `linear-gradient(180deg, ${alpha(BG, 0)} 24%, ${alpha(BG, 0.84)} 40%, ${BG} 56%)` }} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24" style={{ background: `linear-gradient(180deg, ${alpha(BG, 0)}, ${BG})` }} />

        <div className="pointer-events-none mx-auto flex min-h-[calc(100svh-56px)] w-full max-w-[1240px] flex-col justify-end gap-5 px-4 pb-6 pt-[34svh] sm:px-6 lg:min-h-[max(660px,calc(100svh-56px))] lg:justify-center lg:gap-5 lg:px-8 lg:py-8">
          {/* On phones, once the story starts the headline steps aside, so the city and the card share one screen. */}
          <div className={cn("pointer-events-auto max-w-[580px]", scene > 0 && "max-lg:sr-only")}>
            {/* The kicker and "why it matters" share a row, so the headline and the story card fit one screen. */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="kicker">Big picture · 2027 – 2031</div>
              <WhyStory className="hidden lg:inline-flex" />
            </div>
            <h1 id="vision-title" className="mt-4 font-[family-name:var(--font-display)] text-[clamp(1.85rem,0.9rem+2.35vw,3.3rem)] font-black uppercase leading-[0.92] tracking-[-0.035em] [text-wrap:balance]">
              <Words text="Find your people. Find your place. *Find your next reason to move.*" render={hotWord} />
            </h1>
            <p className="mt-3 hidden max-w-[560px] text-[16px] leading-relaxed text-muted lg:block">{LEDE}</p>
          </div>
          <div className="pointer-events-auto w-full max-w-[600px] lg:max-w-[480px]">
            <Keynote scene={scene} onScene={go} words={words} cast={cast} needs={needs} onNeeds={setNeeds} trees={NEW_TREES} onFinish={finish} />
          </div>
        </div>
      </section>

      {/* On phones the lede and the story follow the hero, so the city and the card share the first screen. */}
      <div className="mx-auto max-w-[1240px] px-4 pt-6 sm:px-6 lg:hidden">
        <p className="t-lede">{LEDE}</p>
        <div className="mt-4">
          <WhyStory />
        </div>
      </div>

      <DataStrip
        className="mt-8 lg:mt-6"
        points={[
          { value: "63%", line: "of adults have sidewalks on most of their streets. Walks that fit start with streets that do." },
          { value: "About 200", line: "volunteer ambassadors grew one national run community. People, not software, are the network." },
          { value: "346,527", line: "people in 173 countries started one charity run at the same minute in 2026. A start line can circle the world." },
        ]}
      />

      <FiveSummers index="01" />

      <IdeasMap index="02" />

      <HowWeBuild
        index="03"
        lines={[
          { what: "Walk pages that need no app", how: "A public web page for each walk reads the events table in Supabase. “I'm coming” saves a first name and a reminder, with a one-time link instead of an account.", effort: "M" },
          { what: "Check-in by QR", how: "The City Lead's phone scans a signed code at the walk: one check-in, once. The miles count if the guest joins later.", effort: "S" },
          { what: "Walks that fit", how: "Route facts — step-free, shade, benches, restrooms — as columns on each walk, each marked “checked by the Lead” or “not checked yet”. Fit is a plain rule, never a guess.", effort: "M" },
          { what: "The Lead's co-pilot", how: "A checklist built from the walk's own fields, plus a drafted message. It drafts; the Lead sends.", effort: "M" },
          { what: "Programs for organizations", how: "One program template makes the pages and an organizer view. Row rules keep each organization to its own people.", effort: "L" },
          { what: "The Living City", how: "Three.js draws the story from the same walk and funding records. The tables hold the truth; the picture only shows it.", effort: "S" },
        ]}
        note="All on the app you run today — FlutterFlow, Firebase sign-in, Supabase. Nothing here needs a new stack."
      />
    </div>
  );
}
