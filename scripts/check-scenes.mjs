// Every lens's 3D hero, checked the same way:
//  - a real WebGL renderer drew real pixels (many colours, not a blank fill);
//  - after its ambient window the scene stops drawing (0 frames while idle);
//  - reduced motion still shows the scene, settled, and it never animates;
//  - leaving the page unmounts it (client-side navigation, no full reload);
//  - at 390 px the canvas has a size and the page doesn't scroll sideways;
//  - no console errors anywhere.
//
//   npm run dev   (port 3240)
//   node scripts/check-scenes.mjs [circles member …]   (default: every lens with a [data-stage])

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const OUT = "shots/scenes";
await mkdir(OUT, { recursive: true });

const LENSES = ["member", "coach", "circles", "partner", "impact", "founder", "future", "xray", "build", "vision"];
const only = process.argv.slice(2);
const routes = only.length ? only : LENSES;
const AMBIENT_SECONDS = 8;

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const problems = [];
let passed = 0;
let skipped = 0;

function watch(page, where) {
  page.on("console", (m) => m.type() === "error" && problems.push(`${where} console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`${where} page: ${e.message}`));
}

async function check(name, run) {
  try {
    await run();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.log(`FAIL  ${name}\n      ${String(err.message).split("\n")[0]}`);
    problems.push(`${name}: ${String(err.message).split("\n")[0]}`);
  }
}

const stats = (page, stage) => page.evaluate((s) => window.__fl4scenes?.[s] ?? null, stage);

/** Distinct colours (quantised) and the share of pixels that differ from the corner colour. */
async function pixels(page) {
  return page.evaluate(async () => {
    const canvas = document.querySelector("[data-stage] canvas");
    if (!canvas) return null;
    const img = new Image();
    img.src = canvas.toDataURL("image/png");
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = Math.round((240 * img.height) / img.width);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const bg = [d[0], d[1], d[2]];
    const colours = new Set();
    let differ = 0;
    for (let i = 0; i < d.length; i += 4) {
      colours.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`);
      if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 24) differ++;
    }
    return { colours: colours.size, differ: differ / (d.length / 4), width: canvas.width, height: canvas.height };
  });
}

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await desktop.newPage();
watch(page, "desktop");

for (const route of routes) {
  await page.goto(`${BASE}/${route}?probe=1`, { waitUntil: "networkidle" });
  const stage = await page.locator("[data-stage]").first().getAttribute("data-stage", { timeout: 20000 }).catch(() => null);
  if (!stage) {
    skipped++;
    console.log(`  --  /${route}: no 3D hero yet`);
    continue;
  }

  await check(`/${route} (${stage}): WebGL renders real pixels`, async () => {
    await page.waitForFunction((s) => (window.__fl4scenes?.[s]?.frames ?? 0) > 2, stage, { timeout: 20000 });
    const s = await stats(page, stage);
    if (!s.renderer) throw new Error("no renderer string");
    await page.waitForTimeout(1500);
    const p = await pixels(page);
    if (!p) throw new Error("no canvas");
    if (p.colours < 40) throw new Error(`only ${p.colours} distinct colours`);
    if (p.differ < 0.06) throw new Error(`only ${(p.differ * 100).toFixed(1)}% of pixels differ from the background`);
    await page.screenshot({ path: `${OUT}/${route}-1440.png` });
  });

  await check(`/${route}: settles after its ambient window (0 frames idle)`, async () => {
    await page.mouse.move(2, 890);
    await page.waitForTimeout((AMBIENT_SECONDS + 2) * 1000);
    const a = (await stats(page, stage)).frames;
    await page.waitForTimeout(2000);
    const b = (await stats(page, stage)).frames;
    if (b !== a) throw new Error(`${b - a} frames drawn while idle`);
  });

  await check(`/${route}: leaving unmounts the scene`, async () => {
    const other = route === "build" ? "Member" : "Roadmap";
    await page.getByRole("navigation", { name: "Lenses" }).first().getByRole("link", { name: other, exact: true }).click();
    await page.waitForFunction((s) => window.__fl4scenes?.[s]?.mounted === false, stage, { timeout: 8000 });
  });
}

// Reduced motion: the scene still shows, settled, and draws nothing on its own.
const calm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const still = await calm.newPage();
watch(still, "reduced-motion");
for (const route of routes) {
  await still.goto(`${BASE}/${route}?probe=1`, { waitUntil: "networkidle" });
  const stage = await still.locator("[data-stage]").first().getAttribute("data-stage", { timeout: 20000 }).catch(() => null);
  if (!stage) {
    console.log(`  --  /${route}: no 3D hero found for the reduced-motion check`);
    continue;
  }
  await check(`/${route}: reduced motion shows a settled scene that never animates`, async () => {
    // The Stage reads the OS setting in an effect after hydration; give it a moment before judging.
    await still.waitForSelector('[data-stage][data-still="true"]', { timeout: 5000 }).catch(() => null);
    const flag = await still.locator("[data-stage]").first().getAttribute("data-still");
    if (flag !== "true") throw new Error(`data-still=${flag}`);
    await still.waitForFunction((s) => (window.__fl4scenes?.[s]?.frames ?? 0) > 0, stage, { timeout: 20000 });
    await still.waitForTimeout(1500);
    const a = (await stats(still, stage)).frames;
    await still.waitForTimeout(2000);
    const b = (await stats(still, stage)).frames;
    if (b !== a) throw new Error(`${b - a} frames drawn with reduced motion`);
    const p = await pixels(still);
    if (!p || p.colours < 40) throw new Error("settled frame is blank");
  });
}

// Phones: the canvas fills its hero and nothing scrolls sideways.
const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const phone = await phoneCtx.newPage();
watch(phone, "phone");
for (const route of routes) {
  await phone.goto(`${BASE}/${route}`, { waitUntil: "networkidle" });
  const stage = await phone.locator("[data-stage]").first().getAttribute("data-stage", { timeout: 20000 }).catch(() => null);
  if (!stage) {
    console.log(`  --  /${route}: no 3D hero found at 390 px`);
    continue;
  }
  await check(`/${route}: 390 px canvas sized, no sideways scroll`, async () => {
    await phone.waitForFunction((s) => (window.__fl4scenes?.[s]?.frames ?? 0) > 0, stage, { timeout: 20000 });
    await phone.waitForTimeout(1200);
    const box = await phone.locator("[data-stage] canvas").first().boundingBox();
    if (!box || box.width < 300 || box.height < 300) throw new Error(`canvas ${box?.width}×${box?.height}`);
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error(`horizontal overflow ${overflow}px`);
    await phone.screenshot({ path: `${OUT}/${route}-390.png` });
  });
}

await check("no console errors anywhere", async () => {
  const errors = problems.filter((p) => p.includes("console:") || p.includes("page:"));
  if (errors.length) throw new Error(errors.join(" | "));
});

await browser.close();
const failed = problems.filter((p) => !p.includes("console:") && !p.includes("page:")).length;
console.log(`\n${passed} checks passed${skipped ? `, ${skipped} lens(es) without a 3D hero` : ""}${failed ? `, ${failed} failed` : ""}.`);
process.exit(problems.length ? 1 : 0);
