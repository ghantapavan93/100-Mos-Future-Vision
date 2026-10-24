"use client";

// The small shared kit every lens uses. Restraint is the point: one button
// family, one badge family, one stat, one rule chip. Colour carries state only
// (ok / warn / bad / info); every coloured state also has words.

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { MATURITY_LABEL, type Maturity } from "@/blueprint/features";
import type { Outcome } from "@/domain/engine";
import { RULES } from "@/domain/policy";
import type { ActivitySource } from "@/domain/types";
import { SOURCE_LABEL } from "@/domain/selectors";

/** Class names, with later Tailwind utilities winning over earlier ones (relative vs absolute, etc.). */
export function cn(...parts: (string | false | null | undefined)[]) {
  return twMerge(clsx(parts));
}

type Variant = "primary" | "secondary" | "quiet" | "danger";

/**
 * Headline text where a *starred phrase* runs hot — orange, italic, glowing —
 * the proto's signature move. The stars never reach the page or a screen reader.
 */
export function Hot({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.length > 2 && part.startsWith("*") && part.endsWith("*") ? (
          <span key={i} className="hot">
            {part.slice(1, -1)}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function Button({ variant = "secondary", size = "md", className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100",
        size === "md" ? "min-h-11 px-5 text-[15px]" : "min-h-11 px-3.5 text-[13.5px]",
        // The primary action glows like the proto's, and says it in the headline voice.
        variant === "primary" && "btn-primary bg-accent font-black uppercase tracking-[0.08em] text-on-accent",
        variant === "secondary" && "border border-line-strong bg-surface text-ink hover:border-accent",
        variant === "quiet" && "text-ink underline-offset-4 hover:underline",
        variant === "danger" && "border border-bad text-bad hover:bg-bad-soft",
        className,
      )}
    />
  );
}

type Tone = "neutral" | "ok" | "warn" | "bad" | "info" | "accent";

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em]",
        tone === "neutral" && "border-line-strong text-muted",
        tone === "ok" && "border-transparent bg-ok-soft text-ok",
        tone === "warn" && "border-transparent bg-warn-soft text-warn",
        tone === "bad" && "border-transparent bg-bad-soft text-bad",
        tone === "info" && "border-transparent bg-info-soft text-info",
        tone === "accent" && "border-transparent bg-accent text-on-accent",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Every number or claim that is not real carries one of these. */
/**
 * What a number is (sample, modelled, proposed…). The founder demo shows the
 * idea, not the paperwork, so these stay silent; the kinds are kept so a
 * review build can turn them back on in one place.
 */
export const SHOW_BASIS = false;

export function Basis({ kind }: { kind: "fictional" | "simulated" | "proposed" | "assumption" | "public" | "computed" }) {
  if (!SHOW_BASIS) return null;
  const map = {
    fictional: ["Fictional", "neutral"],
    simulated: ["Simulated", "neutral"],
    proposed: ["Proposed", "info"],
    assumption: ["Assumption", "warn"],
    public: ["Public source", "ok"],
    computed: ["Computed", "neutral"],
  } as const;
  const [label, tone] = map[kind];
  return <Badge tone={tone}>{label}</Badge>;
}

export function MaturityBadge({ maturity }: { maturity: Maturity }) {
  const tone: Tone = maturity === "exists" ? "ok" : maturity === "prototype" ? "accent" : maturity === "proposed" ? "info" : "warn";
  return <Badge tone={tone}>{MATURITY_LABEL[maturity]}</Badge>;
}

export const OUTCOME_TONE: Record<Outcome, Tone> = {
  applied: "ok",
  noop: "neutral",
  rejected: "bad",
  blocked: "bad",
  deferred: "warn",
  quarantined: "warn",
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  applied: "Applied",
  noop: "No change",
  rejected: "Refused",
  blocked: "Blocked by rule",
  deferred: "Queued",
  quarantined: "Quarantined",
};

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return <Badge tone={OUTCOME_TONE[outcome]}>{OUTCOME_LABEL[outcome]}</Badge>;
}

export function Stat({ label, value, note, tone, size = "md" }: { label: string; value: ReactNode; note?: ReactNode; tone?: "ok" | "bad" | "warn"; size?: "md" | "lg" }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow">{label}</div>
      <div className={cn("num mt-1 font-semibold", size === "lg" ? "text-[34px] leading-none" : "text-[22px] leading-tight", tone === "ok" && "text-ok", tone === "bad" && "text-bad", tone === "warn" && "text-warn")}>{value}</div>
      {note ? <div className="mt-1 text-[12.5px] leading-snug text-muted">{note}</div> : null}
    </div>
  );
}

/** A rule id that opens its plain-language summary in place. */
/** A rule's id. Silent in the founder demo, like Basis: the plain sentence beside it carries the meaning. */
export function RuleChip({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const rule = RULES[id];
  if (!SHOW_BASIS) return null;
  if (!rule) return <Badge>{id}</Badge>;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="rounded-full border border-line-strong px-2 py-0.5 font-mono text-[11px] tracking-[0.04em] text-ink hover:border-ink"
        title={rule.title}
      >
        {id}
      </button>
      {open ? (
        <span role="note" className="card absolute left-0 top-[calc(100%+6px)] z-40 block w-[min(320px,80vw)] p-3 text-left text-[13px] leading-snug">
          <span className="block font-semibold">{rule.title}</span>
          <span className="mt-1 block text-muted">{rule.summary}</span>
          <span className="mt-2 block font-mono text-[11px] text-muted">
            {rule.source}
            {rule.confidence === "review" ? " · needs legal review" : rule.confidence === "ours" ? " · our product rule" : ""}
          </span>
          {rule.url ? (
            <a className="mt-1 block font-mono text-[11px] text-accent-ink underline" href={rule.url} target="_blank" rel="noreferrer">
              Read the source
            </a>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

const SOURCE_DOT: Record<ActivitySource, string> = {
  manual: "bg-[var(--ink)]",
  event_checkin: "bg-[var(--accent)]",
  healthkit: "bg-[#c2406b]",
  health_connect: "bg-[#3d7fc7]",
  garmin: "bg-[#1d6fa5]",
  strava: "bg-[#fc4c02]",
};

export function SourceTag({ source, attribution }: { source: ActivitySource; attribution?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
      <span aria-hidden className={cn("h-2 w-2 rounded-full", SOURCE_DOT[source])} />
      {source === "strava" ? "Powered by Strava" : source === "garmin" && attribution ? attribution : SOURCE_LABEL[source]}
    </span>
  );
}

export function Section({ eyebrow, title, lede, children, actions, id }: { eyebrow?: string; title: ReactNode; lede?: ReactNode; children?: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[760px]">
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h1 className="t-page mt-2">{title}</h1>
          {lede ? <p className="t-lede mt-3">{lede}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children ? <div className="mt-8">{children}</div> : null}
    </section>
  );
}

export function Toggle({ checked, onChange, label, disabled, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={hint}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200",
        checked ? "border-transparent bg-ok" : "border-line-strong bg-surface-2",
        disabled && "opacity-50",
      )}
    >
      <span className={cn("absolute h-5 w-5 rounded-full bg-surface shadow transition-transform duration-200", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

export function Meter({ value, max, label, tone = "accent" }: { value: number; max: number; label: string; tone?: "accent" | "ok" | "bad" }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={cn("h-full rounded-full transition-[width] duration-500", tone === "accent" ? "bg-accent" : tone === "ok" ? "bg-ok" : "bg-bad")} style={{ width: `${pct}%` }} />
    </div>
  );
}
