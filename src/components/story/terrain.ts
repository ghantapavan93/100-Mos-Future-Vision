// The geometry of the opening, as pure math shared by the WebGL scene and its
// SVG poster, so both tell the same picture: rolling ground at dawn, one
// person's line, and many lines that meet where a First Mile walk begins.

export type Vec3 = [number, number, number];

/** Gentle rolling ground. Deterministic, cheap, no noise library. */
export function height(x: number, z: number): number {
  return (
    0.55 * Math.sin(x * 0.31 + z * 0.11) +
    0.42 * Math.sin(z * 0.27 - x * 0.18 + 0.7) +
    0.22 * Math.sin(x * 0.83 + 1.3) * Math.cos(z * 0.61) +
    0.0035 * z * z * 0.12 -
    0.4
  );
}

export const MEET: Vec3 = [3.2, 0, -26];

/** Direction to the sun: low, behind the start line. Shared by the WebGL sky and the SVG still. */
export const SUN_DIR: Vec3 = (() => {
  const v: Vec3 = [MEET[0] + 10, 7, MEET[2] - 120];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

function onGround(x: number, z: number, lift = 0.06): Vec3 {
  return [x, height(x, z) + lift, z];
}

/** Catmull-Rom through control points, sampled evenly by parameter. */
export function sampleCurve(ctrl: Vec3[], samples: number): Vec3[] {
  const out: Vec3[] = [];
  const n = ctrl.length;
  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * (n - 1);
    const k = Math.min(n - 2, Math.floor(t));
    const u = t - k;
    const p0 = ctrl[Math.max(0, k - 1)]!;
    const p1 = ctrl[k]!;
    const p2 = ctrl[k + 1]!;
    const p3 = ctrl[Math.min(n - 1, k + 2)]!;
    const v = [0, 1, 2].map((d) => {
      const a = p0[d]!;
      const b = p1[d]!;
      const c = p2[d]!;
      const e = p3[d]!;
      return 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - e) * u * u + (-a + 3 * b - 3 * c + e) * u * u * u);
    }) as Vec3;
    out.push(onGround(v[0], v[2]));
  }
  return out;
}

/** The protagonist: a first mile that wanders a little, as first miles do. */
export function firstMile(samples = 160): Vec3[] {
  const ctrl: Vec3[] = [
    [-1.4, 0, 7.5],
    [-0.4, 0, 4],
    [-1.8, 0, 0],
    [0.6, 0, -4.5],
    [-0.6, 0, -9],
    [1.8, 0, -14],
    [1.2, 0, -19],
    [2.6, 0, -23],
    [MEET[0], 0, MEET[2]],
  ];
  return sampleCurve(ctrl, samples);
}

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ModeColor = "walk" | "jog" | "run" | "roll";
export const MODE_COLORS: Record<ModeColor, string> = {
  walk: "#f2b544",
  jog: "#f6f0e4",
  run: "#ec8a6b",
  roll: "#7fb7a4",
};

export interface OtherLine {
  points: Vec3[];
  mode: ModeColor;
  delay: number;
}

/** Everyone else: lines that begin all over the ground and meet at the start line. */
export function others(count: number, samples = 90, seed = 10): OtherLine[] {
  const r = seeded(seed);
  const modes: ModeColor[] = ["walk", "walk", "jog", "run", "roll"];
  const lines: OtherLine[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + r() * 0.4;
    const dist = 16 + r() * 22;
    const sx = MEET[0] + Math.cos(angle) * dist * 1.25;
    const sz = MEET[2] + Math.sin(angle) * dist * 0.9;
    const mid1: Vec3 = [sx + (MEET[0] - sx) * 0.35 + (r() - 0.5) * 6, 0, sz + (MEET[2] - sz) * 0.35 + (r() - 0.5) * 6];
    const mid2: Vec3 = [sx + (MEET[0] - sx) * 0.72 + (r() - 0.5) * 3, 0, sz + (MEET[2] - sz) * 0.72 + (r() - 0.5) * 3];
    const end: Vec3 = [MEET[0] + (r() - 0.5) * 1.2, 0, MEET[2] + (r() - 0.5) * 1.2];
    lines.push({ points: sampleCurve([[sx, 0, sz], mid1, mid2, end], samples), mode: modes[i % modes.length]!, delay: r() * 0.55 });
  }
  return lines;
}

/** Ridgelines: rows of the ground drawn as lines, like a contour print. */
export function ridgelines(rows: number, cols: number): Vec3[][] {
  const out: Vec3[][] = [];
  for (let j = 0; j < rows; j++) {
    const z = 10 - (j / (rows - 1)) * 72;
    const row: Vec3[] = [];
    for (let i = 0; i < cols; i++) {
      const x = -34 + (i / (cols - 1)) * 68;
      row.push([x, height(x, z) - 0.01, z]);
    }
    out.push(row);
  }
  return out;
}

export interface Shot {
  position: Vec3;
  target: Vec3;
  fov: number;
}

/** One camera, four beats: on the ground, along the line, rising, above everyone. */
export const SHOTS: Shot[] = [
  // Ground shots look a little left of the line so it sits to the right of the words.
  { position: [-5.4, 1.3, 11.5], target: [-6.4, 0.2, -2], fov: 46 },
  { position: [-7.2, 1.9, 4.5], target: [-4.6, 0.1, -14], fov: 46 },
  { position: [-9, 9.5, 12], target: [2.4, -0.4, -16], fov: 48 },
  { position: [3.2, 26, 6], target: [3.2, -1, -24], fov: 50 },
];

/**
 * Portrait screens (phones, tablets upright) have a narrow horizontal field of view,
 * so the "line to the right of the words" framing would leave the line off-screen.
 * Here the line sits in the upper half and the words below it.
 */
export const PORTRAIT_SHOTS: Shot[] = [
  { position: [-1.4, 2.6, 14], target: [-0.6, -0.6, 1], fov: 64 },
  { position: [-2.2, 3.6, 8], target: [1.0, -0.4, -10], fov: 62 },
  { position: [-6, 15, 15], target: [2.6, -1.4, -17], fov: 64 },
  // Aimed short of the start line, so the meeting point sits in the upper third, above the words.
  { position: [3.2, 40, 8], target: [3.2, -1, -12], fov: 64 },
];

export function shotsFor(portrait: boolean): Shot[] {
  return portrait ? PORTRAIT_SHOTS : SHOTS;
}

