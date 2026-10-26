// A simplified outline of the contiguous United States, drawn from about 140
// coastline and border points (Great Lakes shores traced, so the lakes are
// water), shown in an Albers equal-area conic projection — the projection US
// maps usually use, so the shape reads as familiar rather than stretched. No
// map tiles, no network: the atlas works offline and is a visualisation only;
// the chapter list next to it is the real control.

/** The SVG canvas the atlas draws on. */
export const ATLAS_W = 1000;
export const ATLAS_H = 540;

// Clockwise from Cape Flattery, as [longitude, latitude].
const OUTLINE_LONLAT: [number, number][] = [
  // Northern border to Lake of the Woods and the Minnesota arrowhead
  [-124.73, 48.38], [-123.1, 48.18], [-122.76, 49.0], [-117.0, 49.0], [-110.0, 49.0], [-104.0, 49.0], [-97.2, 49.0],
  [-95.15, 49.0], [-95.15, 49.38], [-94.82, 49.32], [-94.6, 48.72], [-93.0, 48.62], [-91.4, 48.05], [-89.6, 48.0],
  // Lake Superior: Minnesota's north shore, then the south shore to Sault Ste. Marie
  [-90.6, 47.55], [-92.1, 46.75], [-91.0, 46.62], [-90.0, 46.62], [-89.3, 46.9], [-88.3, 47.3], [-87.9, 47.42],
  [-88.4, 47.05], [-87.5, 46.5], [-86.6, 46.45], [-85.6, 46.68], [-84.95, 46.77], [-84.4, 46.5],
  // St. Marys River, then the Upper Peninsula's Lake Michigan shore to Green Bay
  [-84.1, 46.1], [-84.75, 45.9], [-85.6, 46.05], [-86.6, 45.85], [-87.05, 45.75], [-87.6, 45.1], [-88.0, 44.55],
  // Door Peninsula, Wisconsin's lakeshore, Chicago, and up Michigan's west coast
  [-87.0, 45.25], [-87.5, 44.6], [-87.7, 43.8], [-87.9, 43.05], [-87.8, 42.3], [-87.6, 41.85], [-87.3, 41.62],
  [-86.9, 41.72], [-86.5, 42.2], [-86.25, 43.2], [-86.5, 44.0], [-86.25, 44.7], [-85.6, 45.1], [-85.0, 45.4],
  [-84.75, 45.78],
  // Lake Huron's west shore, Saginaw Bay and the Thumb, Detroit, Lake Erie, Niagara, Lake Ontario
  [-84.2, 45.6], [-83.4, 45.05], [-83.4, 44.3], [-83.9, 43.85], [-83.5, 43.75], [-82.95, 44.05], [-82.45, 43.0],
  [-82.9, 42.4], [-83.15, 42.05], [-83.45, 41.7], [-82.7, 41.45], [-81.7, 41.5], [-80.1, 42.15], [-78.9, 42.9],
  [-79.05, 43.25], [-77.6, 43.25], [-76.5, 43.45], [-76.35, 44.1],
  // St. Lawrence, the 45th parallel, and Maine's northern border
  [-75.3, 44.85], [-74.7, 45.0], [-71.5, 45.01], [-71.08, 45.3], [-70.85, 45.4], [-70.2, 46.35], [-70.0, 46.7],
  [-69.23, 47.45], [-68.3, 47.35], [-67.8, 47.07], [-67.78, 45.95], [-67.2, 45.2], [-67.0, 44.8],
  // Atlantic coast
  [-68.2, 44.4], [-69.8, 43.8], [-70.25, 43.65], [-70.7, 43.05], [-70.6, 42.65], [-71.0, 42.35], [-70.6, 41.95],
  [-70.0, 41.75], [-70.5, 41.55], [-71.1, 41.5], [-71.85, 41.32], [-72.9, 41.27], [-73.6, 40.95], [-73.97, 40.6],
  [-74.0, 40.45], [-74.05, 39.8], [-74.95, 38.93], [-75.05, 38.8], [-75.1, 38.3], [-75.6, 37.6], [-75.95, 37.12],
  [-76.0, 36.9], [-75.55, 35.8], [-75.5, 35.2], [-76.5, 34.65], [-77.95, 33.85], [-78.9, 33.6], [-79.9, 32.75],
  [-80.85, 32.05], [-81.4, 30.4], [-81.2, 29.6], [-80.55, 28.45], [-80.03, 26.7], [-80.13, 25.77], [-80.4, 25.2],
  // Florida's Gulf coast and the northern Gulf
  [-81.1, 25.12], [-81.8, 26.1], [-82.75, 27.75], [-82.65, 28.7], [-83.6, 29.9], [-84.0, 30.1], [-85.0, 29.6],
  [-85.7, 30.1], [-87.2, 30.35], [-88.05, 30.25], [-88.9, 30.4], [-89.6, 30.15], [-89.4, 29.6], [-89.15, 29.0],
  [-90.2, 29.1], [-91.3, 29.25], [-92.3, 29.55], [-93.85, 29.7], [-94.75, 29.3], [-95.8, 28.65], [-97.25, 27.7],
  [-97.4, 26.8], [-97.15, 25.95],
  // The Rio Grande and the land border to the Pacific
  [-98.3, 26.1], [-99.5, 27.5], [-100.3, 28.3], [-100.9, 29.35], [-101.7, 29.75], [-102.6, 29.75], [-103.1, 28.98],
  [-103.9, 29.3], [-104.7, 29.95], [-105.1, 30.6], [-106.5, 31.78], [-108.2, 31.78], [-108.2, 31.33], [-111.07, 31.33],
  [-114.8, 32.5], [-117.12, 32.53],
  // Pacific coast
  [-117.3, 33.0], [-118.0, 33.7], [-118.4, 33.9], [-119.2, 34.15], [-120.6, 34.55], [-120.9, 35.4], [-121.9, 36.3],
  [-121.9, 36.6], [-122.5, 37.7], [-123.0, 38.0], [-123.7, 38.9], [-124.4, 40.4], [-124.2, 41.75], [-124.55, 42.8],
  [-124.1, 44.0], [-123.95, 46.2], [-124.1, 46.9],
];

/** Albers equal-area conic, standard parallels 29.5° and 45.5°, centred on 96° W (the usual US map). */
function albers([lon, lat]: [number, number]): [number, number] {
  const rad = Math.PI / 180;
  const p1 = 29.5 * rad;
  const p2 = 45.5 * rad;
  const p0 = 37.5 * rad;
  const n = (Math.sin(p1) + Math.sin(p2)) / 2;
  const c = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1);
  const rho0 = Math.sqrt(c - 2 * n * Math.sin(p0)) / n;
  const rho = Math.sqrt(c - 2 * n * Math.sin(lat * rad)) / n;
  const theta = n * (lon + 96) * rad;
  return [rho * Math.sin(theta), rho0 - rho * Math.cos(theta)];
}

// Fit the projected outline into the canvas, centred, with a margin.
const PROJECTED = OUTLINE_LONLAT.map(albers);
const FIT = (() => {
  const xs = PROJECTED.map((p) => p[0]);
  const ys = PROJECTED.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 14;
  const k = Math.min((ATLAS_W - pad * 2) / (maxX - minX), (ATLAS_H - pad * 2) / (maxY - minY));
  return { k, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
})();

/** Longitude and latitude to atlas SVG units (y grows southward). */
export function project(lonlat: [number, number]): [number, number] {
  const [x, y] = albers(lonlat);
  return [ATLAS_W / 2 + (x - FIT.cx) * FIT.k, ATLAS_H / 2 - (y - FIT.cy) * FIT.k];
}

/** The outline in atlas SVG units. */
export const OUTLINE: [number, number][] = OUTLINE_LONLAT.map(project);

export const OUTLINE_PATH = `M${OUTLINE.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`;

function inside(x: number, y: number, poly: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Dots on a staggered grid, kept where they fall inside the outline. Computed once. */
export const DOTS: [number, number][] = (() => {
  const step = 12.5;
  const out: [number, number][] = [];
  let row = 0;
  for (let y = step / 2; y < ATLAS_H; y += step * 0.88, row++) {
    const offset = row % 2 ? step / 2 : 0;
    for (let x = step / 2 + offset; x < ATLAS_W; x += step) {
      if (inside(x, y, OUTLINE)) out.push([x, y]);
    }
  }
  return out;
})();

// The fixtures' 0..1 atlas positions were placed on an earlier, unprojected
// sketch. The projected map places each chapter at its city's public
// coordinates instead, and falls back to the fixture box for any other city.
const CITY_LONLAT: Record<string, [number, number]> = {
  chicago: [-87.63, 41.88],
  detroit: [-83.05, 42.33], // Detroit (the sample chapter's id predates the move to real cities)
  charleston: [-79.93, 32.78], // Charleston
  nyc: [-73.97, 40.68],
  la: [-118.24, 34.05],
  durham: [-78.9, 35.99],
  montreal: [-73.57, 45.5], // just over the border, north of New York
};
const BOX = { west: -124.8, east: -66.9, north: 49.4, south: 24.5 };

/** A chapter's place on the atlas, in SVG units. */
export function chapterPoint(chapter: { id: string; atlas: { x: number; y: number } }): [number, number] {
  const known = CITY_LONLAT[chapter.id];
  if (known) return project(known);
  const lon = BOX.west + chapter.atlas.x * (BOX.east - BOX.west);
  const lat = BOX.north - chapter.atlas.y * (BOX.north - BOX.south);
  return project([lon, lat]);
}
