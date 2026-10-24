import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@fontsource-variable/atkinson-hyperlegible-next/index.css";
import "@fontsource-variable/atkinson-hyperlegible-mono/index.css";
import "./globals.css";
import { Shell } from "@/components/shell/Shell";

/**
 * The headline face, preloaded with a size-matched fallback, so the big H1s are
 * set right on first paint instead of rewrapping when the font arrives.
 */
const inter = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "100 Miles of Summer — the next chapter",
  description: "Where 100 Miles of Summer goes next: Year 10 and beyond, on screens you can tap.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0b0a",
};

/**
 * Sets the time-of-day mode from the URL before first paint, so a hard load of /xray
 * never flashes the story's dawn colours. Mirrors lensFor() in src/lib/lenses.ts.
 */
const MODE_SCRIPT = `(function(){var s=location.pathname.split("/")[1]||"";
var modes={member:"day",coach:"day",build:"day",circles:"golden",partner:"golden",impact:"golden",founder:"night",future:"night",xray:"night"};
document.documentElement.dataset.mode=modes[s]||"dawn";})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-motion="running" data-mode="dawn" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
