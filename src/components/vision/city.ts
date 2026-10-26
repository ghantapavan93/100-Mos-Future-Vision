// The Living City's layout: one riverside district (Detroit, by the river — the
// demo's own Riverwalk Circle), laid out once from a seed so every visit, every
// poster and every test sees the same streets. Pure data: the scene draws it,
// nothing here knows about three.js.
//
// Coordinates are world units on the ground plane: x runs west → east, z runs
// north → south, and the river is the district's southern edge.

/** A point on the ground: [x, z]. */
export type XZ = [number, number];

export interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** 0..1, a small per-building shade so the blocks don't read as one slab. */
  tone: number;
}

export interface District {
  buildings: Building[];
  /** Street centre lines (light runs along them). */
  streets: [XZ, XZ][];
  /** Polylines the movement-light flows along: streets and the riverwalk. */
  flows: XZ[][];
  /** Trees that are there from the start (park, riverwalk). */
  trees: XZ[];
  /** Benches along the riverwalk. */
  benches: { at: XZ; turn: number }[];
  /** Trees and benches a funded fix adds along Route A. */
  newTrees: XZ[];
  newBenches: { at: XZ; turn: number }[];
  park: { x0: number; x1: number; z0: number; z1: number };
}

/** The district's streets: avenues run north–south at these x, streets east–west at these z. */
export const AVENUES = [-13, -7.5, -2, 3.5, 9, 14.5];
export const STREETS = [-9, -4.5, 0, 4.5];
/** The riverwalk, just above the water's edge. */
export const RIVERWALK_Z = 6.4;
export const WATER_Z = 7.3;

/** Where the story happens. */
export const LIBRARY: XZ = [-10.2, 2.25];
/** The library's front door, on the avenue. */
export const DOOR: XZ = [-7.95, 1.9];
/** Rivard Plaza, on the riverwalk: where Saturday's walk meets. */
export const PLAZA: XZ = [6, RIVERWALK_Z];
/** The sponsor's storefront. */
export const STORE: XZ = [6.25, -6.75];
/** The two walks the sponsor funds. */
export const NEW_WALKS: XZ[] = [
  [-0.6, -6.75],
  [11.75, -2.25],
];
/** Where Route A has to climb stairs (over the cut), and the step-free way around them the Lead marks. */
export const STAIRS: XZ = [-2, 0];

/** Route B: from the library's door down to the river, then along the riverwalk. Step-free, shaded, benches. */
export const ROUTE_B: XZ[] = [DOOR, [-7.5, 1.9], [-7.5, RIVERWALK_Z], PLAZA];
/** Route A: inland along the street, over the stairs, then down to the plaza. No shade, nowhere to sit — until it's fixed. */
export const ROUTE_A: XZ[] = [DOOR, [-7.5, 1.9], [-7.5, 0], [3.5, 0], [3.5, RIVERWALK_Z], PLAZA];

/** Deterministic random numbers (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARK = { x0: -7.5, x1: -2, z0: -4.5, z1: 0 };
const STREET_HALF = 0.55;

function inside(x: number, z: number, box: { x0: number; x1: number; z0: number; z1: number }, pad = 0) {
  return x > box.x0 - pad && x < box.x1 + pad && z > box.z0 - pad && z < box.z1 + pad;
}

/** Points every `step` along a polyline, starting half a step in. */
export function along(line: XZ[], step: number): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i]!;
    const [bx, bz] = line[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    for (let s = step / 2; s < len; s += step) out.push([ax + ((bx - ax) * s) / len, az + ((bz - az) * s) / len]);
  }
  return out;
}

export function polylineLength(line: XZ[]): number {
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) total += Math.hypot(line[i + 1]![0] - line[i]![0], line[i + 1]![1] - line[i]![1]);
  return total;
}

/** The point a fraction `u` (0..1) of the way along a polyline, and the heading there. */
export function pointAt(line: XZ[], u: number, lengths?: number[]): { x: number; z: number; heading: number } {
  const segs = lengths ?? line.slice(1).map((p, i) => Math.hypot(p[0] - line[i]![0], p[1] - line[i]![1]));
  const total = segs.reduce((a, b) => a + b, 0);
  let d = (((u % 1) + 1) % 1) * total;
  for (let i = 0; i < segs.length; i++) {
    const len = segs[i]!;
    if (d <= len || i === segs.length - 1) {
      const [ax, az] = line[i]!;
      const [bx, bz] = line[i + 1]!;
      const k = len > 0 ? Math.min(1, d / len) : 0;
      return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, heading: Math.atan2(bx - ax, bz - az) };
    }
    d -= len;
  }
  const last = line[line.length - 1]!;
  return { x: last[0], z: last[1], heading: 0 };
}

export function buildDistrict(seed = 10): District {
  const rnd = seeded(seed);
  const buildings: Building[] = [];
  const libraryBox = { x0: LIBRARY[0] - 2.4, x1: LIBRARY[0] + 2.3, z0: LIBRARY[1] - 1.8, z1: LIBRARY[1] + 1.8 };
  const storeBox = { x0: STORE[0] - 1.5, x1: STORE[0] + 1.5, z0: STORE[1] - 1.3, z1: STORE[1] + 1.3 };
  const keepClear = NEW_WALKS.map(([x, z]) => ({ x0: x - 1.6, x1: x + 1.6, z0: z - 1.4, z1: z + 1.4 }));

  for (let c = 0; c < AVENUES.length - 1; c++) {
    for (let r = 0; r < STREETS.length - 1; r++) {
      const x0 = AVENUES[c]! + STREET_HALF;
      const x1 = AVENUES[c + 1]! - STREET_HALF;
      const z0 = STREETS[r]! + STREET_HALF;
      const z1 = STREETS[r + 1]! - STREET_HALF;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (inside(cx, cz, PARK)) continue;
      // Taller toward downtown (east of centre, near the river), lower to the west.
      const downtown = Math.max(0, 1 - Math.hypot(cx - 6, cz - 1) / 13);
      // Lots: a loose grid inside the block, each lot one building.
      const cols = Math.max(2, Math.round((x1 - x0) / 1.55));
      const rows = Math.max(2, Math.round((z1 - z0) / 1.5));
      const lw = (x1 - x0) / cols;
      const ld = (z1 - z0) / rows;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          // Interior lots of a block stay open now and then: courtyards, so it isn't one solid slab.
          if (rnd() < 0.12) continue;
          const bx = x0 + lw * (i + 0.5);
          const bz = z0 + ld * (j + 0.5);
          if (inside(bx, bz, libraryBox) || inside(bx, bz, storeBox) || keepClear.some((k) => inside(bx, bz, k))) continue;
          const w = lw * (0.62 + rnd() * 0.3);
          const d = ld * (0.62 + rnd() * 0.3);
          const h = 0.6 + rnd() * 1.2 + downtown * downtown * (1.4 + rnd() * 3.1);
          buildings.push({ x: bx, z: bz, w, d, h, tone: rnd() });
        }
      }
    }
  }
  // The riverfront row south of the last street is lower: a strip of pavilions, so the riverwalk stays open.
  for (let x = -12.4; x < 14; x += 2.2) {
    if (Math.abs(x - PLAZA[0]) < 2.2) continue;
    buildings.push({ x, z: 5.25, w: 1.3 + rnd() * 0.5, d: 0.85, h: 0.45 + rnd() * 0.45, tone: rnd() });
  }

  const streets: [XZ, XZ][] = [
    ...AVENUES.map((x) => [[x, -10.5], [x, RIVERWALK_Z]] as [XZ, XZ]),
    ...STREETS.map((z) => [[-14.5, z], [15.5, z]] as [XZ, XZ]),
  ];

  const flows: XZ[][] = [
    ...STREETS.map((z) => [[-14.5, z], [15.5, z]] as XZ[]),
    ...AVENUES.filter((_, i) => i % 2 === 1 || i === 2).map((x) => [[x, -10.5], [x, RIVERWALK_Z]] as XZ[]),
    [[-14.5, RIVERWALK_Z], [15.5, RIVERWALK_Z]],
  ];

  const trees: XZ[] = [];
  // The park: a loose grove, with a lawn left open in the middle.
  for (let i = 0; i < 26; i++) {
    const x = PARK.x0 + 0.5 + rnd() * (PARK.x1 - PARK.x0 - 1);
    const z = PARK.z0 + 0.5 + rnd() * (PARK.z1 - PARK.z0 - 1);
    if (Math.hypot(x - (PARK.x0 + PARK.x1) / 2, z - (PARK.z0 + PARK.z1) / 2) < 1.1) continue;
    trees.push([x, z]);
  }
  // The riverwalk's shade: a row of trees between the walk and the pavilions.
  for (const [x, z] of along([[-14, 5.85], [15, 5.85]], 1.45)) if (Math.abs(x - PLAZA[0]) > 1.2) trees.push([x, z]);

  const benches = along([[-12, 6.95], [14, 6.95]], 3.2)
    .filter(([x]) => Math.abs(x - PLAZA[0]) > 1.4)
    .map((at) => ({ at, turn: 0 }));

  // Route A's fix: shade along the inland street and the avenue down to the river, and three benches.
  const newTrees: XZ[] = [...along([[-7, 0.62], [3, 0.62]], 1.35), ...along([[4.08, 0.6], [4.08, 5.2]], 1.3)];
  const newBenches = [
    { at: [-4.6, 0.85] as XZ, turn: 0 },
    { at: [1.2, 0.85] as XZ, turn: 0 },
    { at: [4.3, 3.1] as XZ, turn: Math.PI / 2 },
  ];

  return { buildings, streets, flows, trees, benches, newTrees, newBenches, park: PARK };
}

// ── The network: her seven cities ────────────────────────────────────────────

export interface CityNode {
  id: string;
  city: string;
  /** Position relative to Detroit (the district), in world units. */
  at: XZ;
}

/** Real coordinates of 100 Miles of Summer's seven cities. */
const LONLAT: Record<string, [number, number]> = {
  chicago: [-87.63, 41.88],
  detroit: [-83.05, 42.33], // Detroit: the sample chapter's id predates the move to real cities.
  charleston: [-79.93, 32.78], // Charleston
  nyc: [-73.97, 40.68],
  la: [-118.24, 34.05],
  durham: [-78.9, 35.99],
  montreal: [-73.57, 45.5],
};

/** Opening day's baton: from Chicago, where it began in 2018, to Los Angeles, the newest city. */
export const RELAY = ["chicago", "detroit", "durham", "charleston", "nyc", "montreal", "la"];

/**
 * A constellation, not a map: east of Chicago the cities sit roughly where they
 * are; Los Angeles is pulled in so the whole network fits one frame.
 */
export function cityNodes(names: Record<string, string>): CityNode[] {
  const [lon0, lat0] = LONLAT.detroit!;
  return Object.keys(LONLAT).map((id) => {
    const [lon, lat] = LONLAT[id]!;
    let x = (lon - lon0) * 1.3;
    const z = -(lat - lat0) * 1.55;
    if (x < -8) x = -8 - (Math.abs(x) - 8) * 0.25;
    return { id, city: names[id] ?? id, at: [x, z] as XZ };
  });
}
