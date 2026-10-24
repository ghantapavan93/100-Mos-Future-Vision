"use client";

// Things rise into place once as they come into view, then stay put. The page
// renders fully visible on the server and for anything already on screen; only
// content that starts below the fold is hidden, and only after the browser
// says so — so nothing is ever lost if scripts are slow, and reduced or paused
// motion (CSS in globals.css) shows everything at once.

import { createElement, Fragment, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "./kit";

function useShown<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92) return;
    setShown(false);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { rootMargin: "0px 0px -2% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, shown };
}

/** A block that fades up once. `delay` in ms staggers siblings. */
export function Reveal({ children, delay = 0, className, as = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "li" | "section" | "p" }) {
  const { ref, shown } = useShown<HTMLElement>();
  return createElement(as, { ref, className: cn("reveal", className), "data-shown": shown ? "true" : "false", style: { transitionDelay: `${delay}ms` } satisfies CSSProperties }, children);
}

/**
 * A headline whose words rise one after another from a mask. `children` is a
 * string, or a string with *starred* hot words rendered by `render`.
 */
export function Words({ text, className, render, step = 45 }: { text: string; className?: string; render?: (word: string) => ReactNode; step?: number }) {
  const { ref, shown } = useShown<HTMLSpanElement>();
  // Keep *starred phrases* whole so they still run hot as one span.
  const tokens = text.match(/\*[^*]+\*|\S+/g) ?? [];
  return (
    <>
      {/* Screen readers (and accessible names) get the sentence once, plainly. */}
      <span className="sr-only">{text.replaceAll("*", "")}</span>
      <span ref={ref} aria-hidden className={cn("words", className)} data-shown={shown ? "true" : "false"}>
        {tokens.map((t, i) => (
          // The space sits between the masks, not inside one, so it never collapses.
          <Fragment key={i}>
            <span>
              <span style={{ transitionDelay: `${i * step}ms` }}>{render ? render(t) : t}</span>
            </span>
            {i < tokens.length - 1 ? " " : null}
          </Fragment>
        ))}
      </span>
    </>
  );
}
