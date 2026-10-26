"use client";

// The optional walkthrough: a small panel that names the one move that carries
// the story on, rings the button that makes it, and can scroll to it or press
// it. It never acts on its own; it presses the same button a person would, so
// there is one code path for every move.

import type { Move } from "./flow";
import { STEPS } from "./flow";
import { Button } from "@/components/ui/kit";

function calm(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "paused";
}

function reach(move: Move): HTMLElement | null {
  const el = document.getElementById(move.target) ?? document.getElementById(`step-${move.step}`);
  el?.scrollIntoView({ block: "center", behavior: calm() ? "auto" : "smooth" });
  return el;
}

export function Guide({ move, ended, onClose, onRestart }: { move: Move | null; ended: string; onClose: () => void; onRestart: () => void }) {
  const index = move ? STEPS.findIndex((s) => s.id === move.step) : STEPS.length;
  const step = move ? STEPS[index] : null;
  return (
    <aside
      aria-label="Walkthrough"
      data-testid="guide"
      className="card fixed inset-x-4 bottom-4 z-40 p-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[360px]"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="eyebrow">
          Walkthrough · {Math.min(index + 1, STEPS.length)} of {STEPS.length}
        </div>
        <button type="button" onClick={onClose} aria-label="Close the walkthrough" className="-mr-1 -mt-1 flex size-9 items-center justify-center rounded-full text-[18px] text-muted hover:text-ink">
          ×
        </button>
      </div>
      {move && step ? (
        <>
          <p className="mt-1 text-[13px] text-muted">{step.title}</p>
          <p className="mt-0.5 text-[16px] font-bold leading-snug" aria-live="polite" data-testid="guide-move">
            {move.label}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => reach(move)}>
              Show me
            </Button>
            <Button
              size="sm"
              variant="primary"
              data-testid="guide-do"
              onClick={() => {
                const el = reach(move);
                if (el instanceof HTMLButtonElement && !el.disabled) window.setTimeout(() => el.click(), calm() ? 0 : 380);
              }}
            >
              Do it for me
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-[16px] font-bold leading-snug" data-testid="guide-move">
            {ended}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={onRestart}>
              Start over
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
