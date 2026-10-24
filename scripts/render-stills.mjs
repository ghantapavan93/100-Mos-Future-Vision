// Renders each lens's live 3D hero to stills:
//  - public/posters/<lens>-wide.webp and -tall.webp: the full first frame of a
//    fresh visit, desktop and phone, which the Stage shows instantly and then
//    crossfades to the live canvas;
//  - public/renders/<lens>.webp: a cropped card image for Home's screen grid,
//    after the sample Saturday has run so the scene looks lived-in.
// Pictures of this demo's own scenes — sample data, same as the scenes.
//
//   npm run dev   (port 3240)
//   node scripts/render-stills.mjs [lens …]

import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const OUT = "public/renders";
const POSTERS = "public/posters";
const ALL = ["member", "coach", "circles", "partner", "impact", "founder", "future", "xray", "build", "vision"];
const LENSES = process.argv.length > 2 ? process.argv.slice(2) : ALL;
await mkdir(OUT, { recursive: true });
await mkdir(POSTERS, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

/** The settled first frame of a fresh visit, at one viewport. */
async function poster(lens, viewport, file, quality) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 600 ? 2 : 1, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/${lens}?probe=1&tier=high`, { waitUntil: "networkidle" });
  const stage = await p.locator("[data-stage]").first().getAttribute("data-stage", { timeout: 4000 }).catch(() => null);
  if (!stage) {
    await ctx.close();
    return false;
  }
  await p.waitForFunction(() => document.querySelector("[data-stage]")?.getAttribute("data-ready") === "true", null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  const data = await p.evaluate(async (q) => {
    const canvas = document.querySelector("[data-stage] canvas");
    return canvas.toDataURL("image/webp", q).split(",")[1];
  }, quality);
  await writeFile(`${POSTERS}/${file}`, Buffer.from(data, "base64"));
  await ctx.close();
  return true;
}

/** Home's opening has its own canvas, not a Stage: wait for its first frame, then keep it. */
async function homePoster(viewport, file) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 600 ? 2 : 1, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/?probe=1&tier=high`, { waitUntil: "networkidle" });
  await p.waitForFunction(() => document.querySelector("section[data-scene-ready]")?.getAttribute("data-scene-ready") === "true", null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  const data = await p.evaluate((q) => document.querySelector("section[data-scene-ready] canvas").toDataURL("image/webp", q).split(",")[1], 0.8);
  await writeFile(`${POSTERS}/${file}`, Buffer.from(data, "base64"));
  await ctx.close();
}

if (process.argv.length <= 2 || LENSES.includes("home")) {
  await homePoster({ width: 1440, height: 900 }, "home-wide.webp");
  await homePoster({ width: 390, height: 844 }, "home-tall.webp");
  console.log(`  ok  home → ${POSTERS}/home-wide.webp, -tall.webp`);
}

for (const lens of LENSES.filter((l) => l !== "home")) {
  const wide = await poster(lens, { width: 1440, height: 900 }, `${lens}-wide.webp`, 0.8);
  if (!wide) {
    console.log(`  --  ${lens}: no 3D hero`);
    continue;
  }
  await poster(lens, { width: 390, height: 844 }, `${lens}-tall.webp`, 0.82);
  console.log(`  ok  ${lens} → ${POSTERS}/${lens}-wide.webp, -tall.webp`);
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
/** Where the 16:10 crop sits, as a share of the spare height: Kayla's week names its cities near the top, so keep the top. */
const CROP_TOP = { founder: 0 };

// Card stills, in one session: play the sample Saturday once (Kayla's week), so every scene shows a lived-in season.
await page.goto(`${BASE}/founder`, { waitUntil: "networkidle" });
await page.evaluate(() => sessionStorage.clear());
await page.reload({ waitUntil: "networkidle" });
const load = page.getByRole("button", { name: /Play a sample Saturday/ }).first();
if (await load.count()) {
  await load.click();
  await page.waitForTimeout(1500);
}

for (const lens of LENSES.filter((l) => l !== "home")) {
  await page.goto(`${BASE}/${lens}?probe=1`, { waitUntil: "networkidle" });
  const stage = await page.locator("[data-stage]").first().getAttribute("data-stage", { timeout: 4000 }).catch(() => null);
  if (!stage) {
    console.log(`  --  ${lens}: no 3D hero`);
    continue;
  }
  await page.waitForFunction((s) => (window.__fl4scenes?.[s]?.frames ?? 0) > 2, stage, { timeout: 30000 });
  // Let entrances finish, so the still is the settled picture.
  await page.waitForTimeout(9000);
  const data = await page.evaluate(async (anchor) => {
    const canvas = document.querySelector("[data-stage] canvas");
    const img = new Image();
    img.src = canvas.toDataURL("image/png");
    await img.decode();
    // Wide layouts put the subject right of the words: keep the right two thirds, at 16:10.
    const sx = Math.round(img.width * 0.3);
    const sw = img.width - sx;
    const sh = Math.min(img.height, Math.round(sw / 1.6));
    const sy = Math.max(0, Math.round((img.height - sh) * anchor));
    const c = document.createElement("canvas");
    c.width = 960;
    c.height = 600;
    c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL("image/webp", 0.86).split(",")[1];
  }, CROP_TOP[lens] ?? 0.35);
  await writeFile(`${OUT}/${lens}.webp`, Buffer.from(data, "base64"));
  console.log(`  ok  ${lens} → ${OUT}/${lens}.webp`);
}

await browser.close();
