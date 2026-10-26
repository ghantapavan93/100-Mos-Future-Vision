"use client";

// The step card over the Living City: which scene this is, what changed in it
// (two short sentences), a small "what they see" panel where that helps — the
// no-app page she opened, the route-fit check, the City Lead's list, the
// partner's walks, the fixed route, the relay — and Back / Next. The card is
// the scene's text for everyone, including screen readers: the 3D is a picture
// of the same thing.

import Link from "next/link";
import { useState } from "react";
import { Button, Hot, cn } from "@/components/ui/kit";
import { SCENE_COUNT, type SceneWords, type StoryCast } from "./scenes";
import type { Needs } from "./LivingCityScene";

const NEED_WORDS: { key: keyof Needs; label: string; missing: string }[] = [
  { key: "stepFree", label: "Step-free", missing: "stairs" },
  { key: "shade", label: "Shade", missing: "no shade" },
  { key: "rest", label: "Somewhere to rest", missing: "no benches" },
];

/** The cities in the order opening day's baton runs. */
const RELAY_WORDS = ["Chicago", "Detroit", "Durham", "Charleston", "New York", "Montreal", "Los Angeles"];

function Chip({ tone, children }: { tone: "fit" | "notYet" | "quiet"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.06em]",
        tone === "fit" && "bg-ok-soft text-ok",
        tone === "notYet" && "bg-bad-soft text-bad",
        tone === "quiet" && "border border-line-strong text-muted",
      )}
    >
      {children}
    </span>
  );
}

function Doorway({ coming }: { coming: number }) {
  const [going, setGoing] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-bg/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <Chip tone="quiet">No app needed</Chip>
        <span className="text-[12px] text-muted">Scanned at the library</span>
      </div>
      <div className="mt-2 font-[family-name:var(--font-display)] text-[17px] font-black uppercase leading-tight">Saturday First Mile</div>
      <div className="mt-0.5 text-[13px] text-muted">Rivard Plaza · Sat 8:00 · 1 or 2.5 mi · every pace</div>
      <button
        type="button"
        onClick={() => setGoing((g) => !g)}
        aria-pressed={going}
        className={cn("mt-2 min-h-10 w-full rounded-xl border text-[14px] font-bold transition-colors", going ? "border-ok/60 bg-ok-soft text-ok" : "border-line-strong hover:border-accent")}
      >
        {going ? `You're in ✓ · ${coming} coming · reminder Friday` : "I'm coming"}
      </button>
      <Link href="/circles" className="mt-1.5 block text-[11.5px] font-semibold text-muted underline-offset-4 hover:underline">
        A picture of it — the real sign-up runs on City Circles →
      </Link>
    </div>
  );
}

function Fit({ needs, onNeeds, fixed, lead }: { needs: Needs; onNeeds: (n: Needs) => void; fixed: boolean; lead: string }) {
  const missing = NEED_WORDS.filter((n) => needs[n.key] && !fixed).map((n) => n.missing);
  return (
    <div className="rounded-2xl border border-line bg-bg/70 p-3">
      <div className="text-[12.5px] text-muted">What she needs — tap to change it:</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="What she needs">
        {NEED_WORDS.map((n) => (
          <button
            key={n.key}
            type="button"
            aria-pressed={needs[n.key]}
            onClick={() => onNeeds({ ...needs, [n.key]: !needs[n.key] })}
            className={cn("min-h-9 rounded-full border px-3 text-[13px] font-semibold transition-colors", needs[n.key] ? "border-ok/60 bg-ok-soft text-ok" : "border-line-strong text-muted hover:text-ink")}
          >
            {needs[n.key] ? "✓ " : ""}
            {n.label}
          </button>
        ))}
      </div>
      <ul className="mt-2 space-y-1 text-[13.5px]">
        <li className="flex items-center justify-between gap-2">
          <span>
            <b>Route A</b> <span className="text-muted">{missing.length ? `· ${missing.join(", ")}` : "· everything she needs"}</span>
          </span>
          {missing.length ? <Chip tone="notYet">Not yet</Chip> : <Chip tone="fit">Fits</Chip>}
        </li>
        <li className="flex items-center justify-between gap-2">
          <span>
            <b>Route B</b> <span className="text-muted">· checked by {lead}</span>
          </span>
          <Chip tone="fit">Fits</Chip>
        </li>
      </ul>
    </div>
  );
}

function LeadView({ lead, sweep, coming }: StoryCast) {
  return (
    <div className="rounded-2xl border border-line bg-bg/70 p-3 text-[13.5px]">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{lead}'s phone</span>
        <Chip tone="fit">{coming} coming</Chip>
      </div>
      <ul className="mt-1.5 space-y-1">
        <li className="flex justify-between gap-2">
          <span className="text-muted">Back walker</span>
          <span className="font-semibold">{sweep} ✓</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-muted">First walks</span>
          <span className="font-semibold">hers, and 3 more</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-muted">Co-pilot, Thursday</span>
          <span className="font-semibold">“No back walker yet”</span>
        </li>
      </ul>
    </div>
  );
}

function PartnerView({ lead }: { lead: string }) {
  return (
    <div className="rounded-2xl border border-line bg-bg/70 p-3 text-[13.5px]">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Northline Outfitters</span>
        <Chip tone="fit">Paid ✓</Chip>
      </div>
      <ul className="mt-1.5 space-y-1">
        <li className="flex justify-between gap-2">
          <span className="text-muted">Two more walks</span>
          <span className="font-semibold">Thu 6:30 pm · Sun 9:00 am</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-muted">They see</span>
          <span className="font-semibold">totals, never names</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-muted">Kayla's week</span>
          <span className="font-semibold">money in · {lead}: still fine</span>
        </li>
      </ul>
    </div>
  );
}

function ChangeView({ lead, trees }: { lead: string; trees: number }) {
  const rows = [
    { what: "Shade", before: "none", after: `${trees} new trees` },
    { what: "Somewhere to rest", before: "none", after: "3 benches" },
    { what: "Step-free", before: "not checked", after: `checked by ${lead}` },
  ];
  return (
    <div className="rounded-2xl border border-line bg-bg/70 p-3 text-[13.5px]">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Route A, before → after</span>
        <Chip tone="fit">Fits now</Chip>
      </div>
      <ul className="mt-1.5 space-y-1">
        {rows.map((r) => (
          <li key={r.what} className="grid grid-cols-[1fr_auto] gap-2">
            <span className="text-muted">{r.what}</span>
            <span>
              <s className="text-muted/80">{r.before}</s> → <b className="text-ok">{r.after}</b>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12.5px] text-muted">Paid for by the members' giving fund and a matched neighborhood grant.</p>
    </div>
  );
}

function RelayView() {
  return (
    <div className="rounded-2xl border border-line bg-bg/70 p-3">
      <div className="eyebrow">Opening day, Year 10</div>
      <ol className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1.5 text-[13px] font-semibold">
        {RELAY_WORDS.map((c, i) => (
          <li key={c} className="flex items-center gap-1">
            <span className={cn("rounded-full px-2 py-0.5", i === 0 || i === RELAY_WORDS.length - 1 ? "bg-accent/15 text-accent-ink" : "bg-surface-2")}>{c}</span>
            {i < RELAY_WORDS.length - 1 ? <span aria-hidden className="text-muted">→</span> : null}
          </li>
        ))}
      </ol>
      <Link href="/xray" className="mt-2.5 inline-flex text-[13px] font-semibold text-accent-ink underline-offset-4 hover:underline">
        See how every mile is counted →
      </Link>
    </div>
  );
}

export function Keynote({
  scene,
  onScene,
  words,
  cast,
  needs,
  onNeeds,
  trees,
  onFinish,
}: {
  scene: number;
  onScene: (n: number) => void;
  words: SceneWords[];
  cast: StoryCast;
  needs: Needs;
  onNeeds: (n: Needs) => void;
  /** How many trees the fix adds, from the scene's own layout. */
  trees: number;
  /** After the last scene: on to the five summers. */
  onFinish: () => void;
}) {
  const w = words[scene]!;
  const last = scene === SCENE_COUNT - 1;
  return (
    <section aria-label="The story, in seven scenes" className="card overflow-hidden p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5 whitespace-nowrap">
          <span className="num text-[13px] font-bold text-accent-ink">
            {String(scene + 1).padStart(2, "0")} / {String(SCENE_COUNT).padStart(2, "0")}
          </span>
          <span className="eyebrow hidden sm:inline">{w.name}</span>
        </div>
        <ol className="flex items-center gap-1" aria-label="Scenes">
          {words.map((s, i) => (
            <li key={s.name}>
              <button
                type="button"
                aria-label={`Scene ${i + 1}: ${s.name}`}
                aria-current={i === scene ? "step" : undefined}
                onClick={() => onScene(i)}
                className="flex h-8 w-6 items-center justify-center"
              >
                <span className={cn("block h-1.5 rounded-full transition-all duration-300", i === scene ? "w-5 bg-accent" : i < scene ? "w-2.5 bg-accent/50" : "w-2.5 bg-line-strong")} />
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* Re-keyed per scene so each one rises in; the live region reads the change aloud. */}
      <div key={scene} className="rise-in" aria-live="polite">
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-[24px] font-black uppercase leading-[0.95] tracking-[-0.03em] sm:text-[27px]">
          <Hot text={w.title} />
        </h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink/90">
          {w.lines[0]} <span className="text-muted">{w.lines[1]}</span>
        </p>
        <div className="mt-2.5">
          {scene === 0 ? <p className="text-[13px] text-muted">Tap Next<span className="hidden lg:inline">, or use the ← → keys</span>. Each scene is one change.</p> : null}
          {scene === 1 ? <Doorway coming={cast.coming} /> : null}
          {scene === 2 ? <Fit needs={needs} onNeeds={onNeeds} fixed={false} lead={cast.lead} /> : null}
          {scene === 3 ? <LeadView {...cast} /> : null}
          {scene === 4 ? <PartnerView lead={cast.lead} /> : null}
          {scene === 5 ? <ChangeView lead={cast.lead} trees={trees} /> : null}
          {scene === 6 ? <RelayView /> : null}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {/* On the last scene a phone has room for two buttons, so Back steps aside there. */}
        <Button variant="quiet" onClick={() => onScene(Math.max(0, scene - 1))} disabled={scene === 0} className={cn("whitespace-nowrap px-2", last && "max-sm:hidden")}>
          ← Back
        </Button>
        {last ? (
          <div className="flex items-center gap-1">
            <Button variant="quiet" onClick={() => onScene(0)} className="whitespace-nowrap px-2">
              Start again
            </Button>
            <Button variant="primary" onClick={onFinish} className="whitespace-nowrap">
              Five summers ↓
            </Button>
          </div>
        ) : (
          // The first tap is obvious: a soft ring around Next until the story starts moving.
          <span className={cn("rounded-xl", scene === 0 && "step-ring")}>
            <Button variant="primary" onClick={() => onScene(scene + 1)}>
              Next →
            </Button>
          </span>
        )}
      </div>
    </section>
  );
}
