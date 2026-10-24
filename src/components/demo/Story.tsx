"use client";

// "Why it matters": depth as a story, not citations. One button opens a sheet
// with a few short beats — like telling a friend — and, when it helps, one
// number that makes the point. Closed, the page stays simple; open, it answers
// "but why?" without a single footnote.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Hot, cn } from "@/components/ui/kit";

export interface StoryBeat {
  /** A short line; *starred words* run hot. */
  text: string;
}

export interface StoryProps {
  /** The button's words, e.g. "Why it matters". */
  label?: string;
  /** The sheet's headline; *starred words* run hot. */
  title: string;
  beats: StoryBeat[];
  /** One number that carries the point, in plain words. */
  stat?: { value: string; line: string };
  /** Where the story leaves you: what to tap next. */
  close?: ReactNode;
  className?: string;
}

export function Story({ label = "Why it matters", title, beats, stat, close, className }: StoryProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      (previous ?? opener.current)?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "tap group inline-flex items-center gap-2 rounded-xl border border-accent/50 bg-accent/10 px-4 text-[14px] font-bold text-ink transition-colors hover:border-accent hover:bg-accent/15",
          className,
        )}
      >
        <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-accent text-[12px] font-black text-on-accent">
          ?
        </span>
        {label}
      </button>
      {/* Portalled to <body>: a revealed (transformed) ancestor would otherwise
          trap this fixed sheet inside itself, under the sticky header. */}
      {open ? createPortal(
        <div className="fixed inset-0 z-[80] flex justify-end" role="presentation">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            tabIndex={-1}
            data-mode="night"
            className="rise-in relative flex h-full w-full max-w-[560px] flex-col overflow-y-auto border-l border-line bg-bg px-6 pb-10 pt-6 text-ink shadow-[-30px_0_80px_-20px_rgba(0,0,0,0.9)] outline-none sm:px-10"
          >
            <div className="flex items-center justify-between">
              <span className="kicker">{label}</span>
              <button type="button" onClick={() => setOpen(false)} className="tap -mr-2 rounded-full px-3 text-[14px] font-semibold text-muted hover:text-ink">
                Close
              </button>
            </div>
            <h2 id={`${id}-title`} className="display mt-6 text-[40px] sm:text-[52px]">
              <Hot text={title} />
            </h2>
            {stat ? (
              <div className="mt-8 rounded-2xl border border-accent/40 bg-accent/10 p-5 shadow-[var(--glow)]">
                <div className="font-[family-name:var(--font-display)] text-[56px] font-black leading-none tracking-[-0.04em] text-accent">{stat.value}</div>
                <p className="mt-2 text-[16px] leading-snug">{stat.line}</p>
              </div>
            ) : null}
            <ol className="mt-8 space-y-5">
              {beats.map((b, i) => (
                <li key={i} className="flex gap-4">
                  <span className="num mt-1 text-[13px] font-bold text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
                  <p className="text-[18px] leading-relaxed">
                    <Hot text={b.text} />
                  </p>
                </li>
              ))}
            </ol>
            {close ? <div className="mt-10 border-t border-line pt-6 text-[15px] text-muted">{close}</div> : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
