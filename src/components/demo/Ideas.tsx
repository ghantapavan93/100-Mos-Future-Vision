"use client";

// The ideas for a screen. The first one is the feature story (large, with a
// picture when there is one); the rest sit beside it; ideas for later sit in a
// quiet list. Every idea says honestly whether it builds on something 100 Miles
// of Summer already has, or is new — Kayla should never see her own idea pitched
// back to her as ours.

import type { ReactNode } from "react";
import { cn } from "@/components/ui/kit";
import { Reveal, Words } from "@/components/ui/Reveal";
import { hotWord } from "./TryIt";

export interface Idea {
  title: string;
  /** One sentence, plain words. */
  line: string;
  /** Makes the idea happen on the phone above, then scrolls up to it. */
  show?: () => void;
  /** "live": works on the phone above. "next": a picture of what comes after. */
  state?: "live" | "next";
  /** "yours": builds on something they already have (say what in `line`). "new": not something they have or have announced. */
  origin?: "yours" | "new";
  /** For the feature story: a picture (a render or a photo). */
  image?: string;
  /** Which part of the image the 2:1 crop keeps (CSS object-position), e.g. "50% 30%". */
  imagePosition?: string;
  icon?: ReactNode;
}

function Origin({ origin }: { origin?: Idea["origin"] }) {
  if (!origin) return null;
  return (
    <span
      className={cn(
        "w-fit justify-self-start whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em]",
        origin === "yours" ? "border border-line-strong text-muted" : "bg-accent/15 text-accent-ink",
      )}
    >
      {origin === "yours" ? "Builds on what you have" : "New"}
    </span>
  );
}

function ShowMe({ idea, anchor }: { idea: Idea; anchor: string }) {
  if (!idea.show) return null;
  return (
    <button
      type="button"
      onClick={() => {
        idea.show!();
        // Land on the phone itself: on a narrow screen it sits well below the section's top.
        const box = document.getElementById(anchor);
        (box?.querySelector('[data-testid="phone"]') ?? box)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className="tap group mt-5 inline-flex items-center gap-2 self-start text-[14px] font-bold text-accent-ink"
    >
      Show me on the phone
      <span aria-hidden className="transition-transform group-hover:translate-x-1">
        →
      </span>
    </button>
  );
}

export function Ideas({ id = "ideas", index = "02", title, intro, ideas, phoneAnchor = "try" }: { id?: string; index?: string; title: string; intro?: ReactNode; ideas: Idea[]; phoneAnchor?: string }) {
  const now = ideas.filter((i) => i.state !== "next");
  const later = ideas.filter((i) => i.state === "next");
  const [lead, ...rest] = now;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto w-full max-w-[1320px] px-4 pb-20 sm:px-6 lg:px-8">
      <div className="index-line">
        <b>{index}</b> Ideas
      </div>
      <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
        <h2 id={`${id}-title`} className="t-section">
          <Words text={title} render={hotWord} />
        </h2>
        {intro ? (
          <Reveal>
            <p className="t-lede">{intro}</p>
          </Reveal>
        ) : null}
      </div>

      <ul className="mt-10 grid gap-4 lg:grid-cols-3">
        {lead ? (
          <Reveal as="li" className="card flex flex-col overflow-hidden lg:col-span-2 lg:row-span-2">
            {lead.image ? (
              <span className="relative block aspect-[16/8] overflow-hidden bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lead.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" style={lead.imagePosition ? { objectPosition: lead.imagePosition } : undefined} />
              </span>
            ) : null}
            <div className="flex flex-1 flex-col p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-[13px] font-bold text-accent-ink">01</span>
                <Origin origin={lead.origin} />
              </div>
              <h3 className="mt-4 font-[family-name:var(--font-display)] text-[clamp(26px,3vw,36px)] font-black uppercase leading-[0.95] tracking-[-0.03em]">{lead.title}</h3>
              <p className="mt-3 max-w-[52ch] flex-1 text-[17px] leading-relaxed text-muted">{lead.line}</p>
              <ShowMe idea={lead} anchor={phoneAnchor} />
            </div>
          </Reveal>
        ) : null}
        {rest.map((idea, i) => (
          <Reveal as="li" key={idea.title} delay={80 * (i + 1)} className="card relative flex flex-col overflow-hidden p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-[13px] font-bold text-accent-ink">{String(i + 2).padStart(2, "0")}</span>
              <Origin origin={idea.origin} />
            </div>
            <h3 className="t-card mt-4 flex items-center gap-2">
              {idea.icon}
              {idea.title}
            </h3>
            <p className="mt-2 text-[15.5px] leading-relaxed text-muted">{idea.line}</p>
            <ShowMe idea={idea} anchor={phoneAnchor} />
            <span aria-hidden className="pointer-events-none absolute -bottom-5 right-4 select-none font-[family-name:var(--font-display)] text-[112px] font-black leading-none tracking-[-0.06em] text-ink/[0.045]">
              {String(i + 2).padStart(2, "0")}
            </span>
          </Reveal>
        ))}
      </ul>

      {later.length ? (
        <Reveal className="mt-10">
          <div className="eyebrow">Next, once the basics hold</div>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {later.map((idea) => (
              <li key={idea.title} className="grid gap-1 py-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)_13rem] sm:items-baseline sm:gap-6">
                <span className="text-[16px] font-bold">{idea.title}</span>
                <span className="text-[15px] leading-relaxed text-muted">{idea.line}</span>
                <Origin origin={idea.origin} />
              </li>
            ))}
          </ul>
        </Reveal>
      ) : null}
    </section>
  );
}
