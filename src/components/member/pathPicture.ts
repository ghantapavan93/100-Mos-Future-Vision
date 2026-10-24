// The On-Track Helper's picture for the ideas section: a Summer Path of 100
// stepping stones winding away from the viewer in three switchbacks, the miles
// already moved lit, the rest waiting, a ring at every 25. Drawn as SVG in code
// (no photo, no text), so it is ours and stays sharp at any size.

const W = 1600;
const H = 800;
const STONES = 100;
const NEAR_Y = 640;
const FAR_Y = 270;

type Pt = [number, number];

/** A quadratic curve from a through control c to b, as points. */
function quad(a: Pt, c: Pt, b: Pt, n = 40): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as Pt;
  });
}

/** The path as a dense polyline: three rows, narrower as they recede, joined by U-turns. */
const PATH: Pt[] = [
  ...quad([150, 650], [800, 620], [1440, 640]),
  ...quad([1440, 640], [1600, 540], [1380, 450]),
  ...quad([1380, 450], [800, 420], [230, 445]),
  ...quad([230, 445], [90, 360], [290, 280]),
  ...quad([290, 280], [800, 250], [1320, 270]),
];

/** 100 points spaced evenly along the path. */
function stones(): Pt[] {
  const lengths = [0];
  for (let i = 1; i < PATH.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(PATH[i]![0] - PATH[i - 1]![0], PATH[i]![1] - PATH[i - 1]![1]));
  const total = lengths.at(-1)!;
  const out: Pt[] = [];
  let j = 1;
  for (let k = 0; k < STONES; k++) {
    const want = (k / (STONES - 1)) * total;
    while (j < PATH.length - 1 && lengths[j]! < want) j++;
    const span = lengths[j]! - lengths[j - 1]! || 1;
    const t = (want - lengths[j - 1]!) / span;
    out.push([PATH[j - 1]![0] + (PATH[j]![0] - PATH[j - 1]![0]) * t, PATH[j - 1]![1] + (PATH[j]![1] - PATH[j - 1]![1]) * t]);
  }
  return out;
}

const POINTS = stones();

/** Nearer stones are bigger, so the path recedes. */
const radius = (y: number) => 6 + ((y - FAR_Y) / (NEAR_Y - FAR_Y)) * 9;

/** The picture for `miles` moved so far, as a data URI an `<img>` can show. */
export function summerPathPicture(miles: number): string {
  const lit = Math.min(STONES, Math.floor(miles));
  const parts = POINTS.map(([x, y], i) => {
    const r = radius(y).toFixed(1);
    const milestone = (i + 1) % 25 === 0;
    if (i < lit) return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#ff6a13" filter="url(#glow)"/>`;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#1b1815" stroke="${milestone ? "#ffc14d" : "rgba(247,242,234,0.3)"}" stroke-width="${milestone ? 3 : 2}"/>`;
  });
  const [hx, hy] = POINTS[Math.min(lit, STONES - 1)]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
<radialGradient id="bg" cx="0.2" cy="0.85" r="0.95"><stop offset="0" stop-color="#4a220c"/><stop offset="0.45" stop-color="#1c1410"/><stop offset="1" stop-color="#0e0d0c"/></radialGradient>
<radialGradient id="here" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffc14d" stop-opacity="0.75"/><stop offset="1" stop-color="#ff6a13" stop-opacity="0"/></radialGradient>
<filter id="glow" x="-1.5" y="-1.5" width="4" height="4"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="90" fill="url(#here)"/>
${parts.join("")}
<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${(radius(hy) * 0.6).toFixed(1)}" fill="#fff6ec"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
