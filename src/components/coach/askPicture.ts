// The "Ask a question" picture for the ideas section: a member's question in
// orange, a short answer beside it, and the few approved tips it stands on
// lighting up in the wall behind — the hero's idea, flattened to one still.
// Drawn as SVG in code (no photo, no words), so it is ours and stays sharp.

const W = 1600;
const H = 800;

/** Rows of "text" as soft bars: the shape of a sentence without the words. */
function bars(x: number, y: number, widths: number[], color: string, h = 16, gap = 30): string {
  return widths.map((w, i) => `<rect x="${x}" y="${y + i * gap}" width="${w}" height="${h}" rx="${h / 2}" fill="${color}"/>`).join("");
}

export function askPicture(): string {
  // The wall of tips: a 5×3 grid on the right; two of them are what the answer stands on.
  const cols = 5;
  const tips: string[] = [];
  const cited = new Set([6, 12]);
  const tipAt = (i: number) => ({ x: 860 + (i % cols) * 140, y: 150 + Math.floor(i / cols) * 120 });
  for (let i = 0; i < 15; i++) {
    const { x, y } = tipAt(i);
    const on = cited.has(i);
    tips.push(
      `<g opacity="${on ? 1 : 0.42}"><rect x="${x}" y="${y}" width="120" height="96" rx="10" fill="#1d1a17" stroke="${on ? "#ff6a13" : "rgba(247,242,234,0.12)"}" stroke-width="${on ? 3 : 1.5}"${on ? ' filter="url(#glow)"' : ""}/>` +
        `<rect x="${x}" y="${y}" width="120" height="6" rx="3" fill="${i % 3 === 0 ? "#5fd3a2" : "#ff6a13"}" opacity="0.85"/>${bars(x + 14, y + 26, [84, 62], "rgba(247,242,234,0.35)", 10, 20)}</g>`,
    );
  }
  // Threads from the cited tips to the answer card.
  const threads = [...cited]
    .map((i) => {
      const { x, y } = tipAt(i);
      return `<path d="M ${x} ${y + 48} C ${x - 140} ${y + 48}, 760 470, 700 470" fill="none" stroke="#ff8a3d" stroke-width="3" stroke-linecap="round" opacity="0.85" filter="url(#glow)"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
<radialGradient id="bg" cx="0.3" cy="0.6" r="0.9"><stop offset="0" stop-color="#3a1d0c"/><stop offset="0.5" stop-color="#17120f"/><stop offset="1" stop-color="#0e0d0c"/></radialGradient>
<filter id="glow" x="-0.5" y="-0.5" width="2" height="2"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${tips.join("")}
${threads}
<g>
<rect x="330" y="170" width="380" height="110" rx="40" fill="#ff6a13"/>
${bars(372, 204, [290, 200], "rgba(12,11,10,0.55)", 16, 32)}
<rect x="160" y="320" width="540" height="300" rx="32" fill="#1f1c19" stroke="rgba(247,242,234,0.14)" stroke-width="2"/>
${bars(204, 362, [420, 360], "rgba(247,242,234,0.62)", 16, 34)}
<rect x="204" y="452" width="4" height="78" rx="2" fill="#ff6a13"/>
${bars(226, 458, [380, 330], "rgba(247,242,234,0.42)", 14, 30)}
<rect x="204" y="552" width="150" height="44" rx="22" fill="none" stroke="rgba(247,242,234,0.4)" stroke-width="2"/>
<rect x="370" y="552" width="286" height="44" rx="22" fill="#ff6a13" opacity="0.9"/>
</g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
