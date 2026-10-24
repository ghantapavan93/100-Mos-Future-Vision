// The picture on the "friendly fair check" idea: the same leaderboard before
// and after. Without it, one odd walk runs off the end of the board; with
// the fair check it waits in a box for a person, and the honest totals rank as
// they are. No names and no numbers: it is about the check, not about anyone.
//
// On a phone the picture is drawn at under half size, so a media query inside
// the SVG (it measures the picture, not the page) swaps in shorter words at a
// size that still reads there.

const W = 800;
const H = 400;
const C = {
  bg: "#17130f",
  rule: "#3a332a",
  ink: "#efe7da",
  muted: "#8f8577",
  accent: "#ff6a13",
  ok: "#5fd3a2",
  warn: "#f2b544",
};
const FONT = "Inter, Segoe UI, Arial, sans-serif";
const BAR_H = 30;

/** Sizes by role; the narrow block takes over when the picture is drawn under 560px wide. */
const STYLE = [
  `text{font-family:${FONT}}`,
  ".h{font-size:13px;font-weight:800;letter-spacing:3px}",
  ".n{font-size:15px;font-weight:700}",
  ".b{font-size:14px;font-weight:700}",
  ".w{font-size:14px;font-weight:700}",
  ".f{font-size:17px;font-weight:700}",
  ".narrow{display:none}",
  "@media (max-width:560px){",
  ".wide{display:none}.narrow{display:inline}",
  ".h{font-size:28px;letter-spacing:2px}.n{font-size:22px}.b{font-size:22px}.w{font-size:25px}.f{font-size:33px}",
  "}",
].join("");

/** The honest totals, as bar lengths: the same on both sides. */
const HONEST = [168, 144, 126];

function text(x: number, y: number, body: string, role: string, fill: string, only?: "wide" | "narrow"): string {
  return `<text x="${x}" y="${y}" class="${role}${only ? ` ${only}` : ""}" fill="${fill}">${body}</text>`;
}

/** The same spot in two wordings: the full line, and a short one for phones. */
function both(x: number, y: number, wide: string, narrow: string, role: string, fill: string): string {
  return text(x, y, wide, role, fill, "wide") + text(x, y, narrow, role, fill, "narrow");
}

function bar(x: number, y: number, w: number, fill: string, opacity = 1): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${fill}" opacity="${opacity}"/>`;
}

function board(x0: number, rows: { w: number; fill: string; opacity?: number; label?: string; labelFill?: string }[]): string {
  return rows
    .map((r, i) => {
      const y = 100 + i * 54;
      const mid = y + BAR_H / 2;
      return [
        `<text x="${x0}" y="${mid}" dominant-baseline="central" class="n" fill="${C.muted}">${i + 1}</text>`,
        bar(x0 + 30, y, r.w, r.fill, r.opacity),
        r.label ? `<text x="${x0 + 46}" y="${mid}" dominant-baseline="central" class="b" fill="${r.labelFill ?? C.bg}">${r.label}</text>` : "",
      ].join("");
    })
    .join("");
}

function picture(): string {
  const left = board(40, [
    { w: 340, fill: "url(#runaway)", label: "one odd walk", labelFill: C.bg },
    ...HONEST.map((w) => ({ w, fill: C.accent, opacity: 0.55 })),
  ]);
  const right = board(440, HONEST.map((w) => ({ w, fill: C.ok, opacity: 0.85 })));
  const waiting = `<rect x="440" y="262" width="320" height="50" rx="14" fill="none" stroke="${C.warn}" stroke-width="2" stroke-dasharray="7 6"/>${[
    `<text x="460" y="287" dominant-baseline="central" class="w wide" fill="${C.warn}">Waiting for a person · not counted yet</text>`,
    `<text x="460" y="287" dominant-baseline="central" class="w narrow" fill="${C.warn}">Waits for a person</text>`,
  ].join("")}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<style>${STYLE}</style>`,
    `<defs><linearGradient id="runaway" x1="0" x2="1"><stop offset="0" stop-color="${C.warn}"/><stop offset="0.8" stop-color="${C.accent}"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></linearGradient></defs>`,
    `<rect width="${W}" height="${H}" fill="${C.bg}"/>`,
    `<line x1="410" y1="40" x2="410" y2="360" stroke="${C.rule}" stroke-width="1"/>`,
    both(40, 66, "WITHOUT A FAIR CHECK", "NO CHECK", "h", C.muted),
    both(440, 66, "WITH THE FAIR CHECK", "FAIR CHECK", "h", C.accent),
    left,
    right,
    waiting,
    both(40, 362, "Could jump the leaderboard.", "Jumps the board.", "f", C.ink),
    both(440, 362, "Stopped before it counts.", "Stopped first.", "f", C.ink),
    `</svg>`,
  ].join("");
}

export const FAIR_CHECK_PICTURE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(picture())}`;
