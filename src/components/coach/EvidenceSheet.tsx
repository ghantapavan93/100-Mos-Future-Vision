"use client";

// The evidence drawer: everything a citation stands on. A card's status is the
// first thing shown, because "public guideline" and "proposed lesson, not
// Kayla's words" deserve very different levels of trust.

import { useEffect, useRef } from "react";
import { CARD } from "@/domain/quantum/knowledge";
import { Badge } from "@/components/ui/kit";
import { STATUS } from "./labels";

export function EvidenceSheet({ cardId, index, onClose }: { cardId: string | null; index: number | null; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const card = cardId ? CARD[cardId] : undefined;

  useEffect(() => {
    if (!card) return;
    const opener = document.activeElement;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [card, onClose]);

  if (!card) return null;
  const status = STATUS[card.status];
  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-end sm:items-stretch" role="presentation">
      <button type="button" aria-label="Close evidence" className="absolute inset-0 bg-[rgba(20,18,14,0.32)]" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Evidence: ${card.title}`}
        data-mode="day"
        className="rise-in relative max-h-[86dvh] w-full overflow-y-auto rounded-t-[22px] bg-bg p-6 text-ink shadow-2xl outline-none sm:h-full sm:max-h-none sm:max-w-[460px] sm:rounded-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="eyebrow">Evidence{index !== null ? ` · citation ${index}` : ""}</div>
          <button type="button" onClick={onClose} className="tap -mr-2 -mt-3 rounded-full px-3 text-[14px] text-muted hover:text-ink">
            Close
          </button>
        </div>
        <div className="mt-2">
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <h2 className="display mt-3 text-[28px]">{card.title}</h2>
        <blockquote className="mt-4 border-l-2 border-accent pl-4 text-[17px] leading-relaxed">{card.body}</blockquote>

        <dl className="mt-6 space-y-4 text-[14px]">
          <div>
            <dt className="eyebrow">Where it comes from</dt>
            <dd className="mt-1 leading-relaxed">{card.source}</dd>
            {card.url ? (
              <dd className="mt-1">
                <a href={card.url} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-accent-ink underline underline-offset-4">
                  {card.url.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            ) : null}
          </div>
          <div>
            <dt className="eyebrow">Needs review by</dt>
            <dd className="mt-1">{card.needsReviewBy ?? "No further review — published guidance, paraphrased."}</dd>
          </div>
          <div>
            <dt className="eyebrow">Rulesets that include it</dt>
            <dd className="mt-1 flex gap-1.5">
              {card.rulesets.map((r) => (
                <Badge key={r}>{r}</Badge>
              ))}
            </dd>
          </div>
        </dl>

        {card.status === "proposed-lesson" ? (
          <p className="mt-6 rounded-2xl bg-warn-soft p-4 text-[13.5px] leading-relaxed text-warn">
            Written by the 100 Miles team for Kayla to review. Not her words until she says yes.
          </p>
        ) : null}
        {card.status === "proposed-rule" ? (
          <p className="mt-6 rounded-2xl bg-info-soft p-4 text-[13.5px] leading-relaxed text-info">A program rule, not a medical guideline. A certified coach should review it before anyone relies on it.</p>
        ) : null}
      </div>
    </div>
  );
}
