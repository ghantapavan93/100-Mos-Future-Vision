// The opening, checked in a real browser: WebGL actually renders (renderer
// string, frames counted, pixels not blank), each beat can be reached, the
// SVG fallback works, and leaving the page disposes GPU resources.

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const OUT = "shots";
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 900) } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
const fail = (msg) => {
  console.log("FAIL", msg, errors);
  process.exit(1);
};

await page.goto(BASE + "/?probe=1", { waitUntil: "networkidle" });
await page.waitForTimeout(4500);
const scene = await page.evaluate(() => window.__fl4scene ?? null);
if (!scene) fail("no WebGL scene registered");
const pixels = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  if (!c) return null;
  const off = document.createElement("canvas");
  off.width = 64;
  off.height = 36;
  const ctx = off.getContext("2d");
  ctx.drawImage(c, 0, 0, 64, 36);
  const d = ctx.getImageData(0, 0, 64, 36).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4) seen.add(`${d[i] >> 4}-${d[i + 1] >> 4}-${d[i + 2] >> 4}-${d[i + 3] >> 6}`);
  return seen.size;
});
console.log("renderer:", scene.renderer, "webgl2:", scene.webgl2, "frames:", scene.frames, "lines:", scene.lines, "distinct colours:", pixels);
// The opening move is time-based (2.4 s), so a software renderer (SwiftShader, as in CI) draws only a
// handful of frames with bloom on; a loop that is running draws more than one or two.
if (scene.frames < 4) fail("render loop not running");
if (!pixels || pixels < 6) fail("canvas looks blank");
// Render on demand: once the opening move settles, no more frames are drawn.
const settledA = await page.evaluate(() => window.__fl4scene.frames);
await page.waitForTimeout(1500);
const settledB = await page.evaluate(() => window.__fl4scene.frames);
console.log("frames while idle:", settledB - settledA);
if (settledB - settledA > 2) fail("scene keeps rendering while nothing moves");
await page.screenshot({ path: `${OUT}/story-beat1.png` });
for (let b = 2; b <= 4; b++) {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(b === 4 ? 5200 : 3800);
  await page.screenshot({ path: `${OUT}/story-beat${b}.png` });
}
await page.getByRole("button", { name: "Take the tour · 13 stops" }).first().waitFor();
// Client-side navigation (a full load would reset window and hide a leak).
await page.getByRole("navigation", { name: "Lenses" }).getByRole("link", { name: "Member" }).click();
await page.waitForURL("**/member");
await page.waitForTimeout(1200);
const after = await page.evaluate(() => window.__fl4scene?.disposed ?? 0);
console.log("disposals after leaving:", after);
if (after < 2) fail("GPU resources not disposed on unmount");
// Reduced motion: the still, and three.js is never requested.
const reducedCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const reducedPage = await reducedCtx.newPage();
const scripts = [];
reducedPage.on("response", (r) => r.url().endsWith(".js") && scripts.push(r.url()));
await reducedPage.goto(BASE + "/", { waitUntil: "networkidle" });
await reducedPage.waitForTimeout(1200);
const still = await reducedPage.locator("section[data-render=still]").count();
const canvases = await reducedPage.locator("canvas").count();
const threeLoaded = await reducedPage.evaluate(() => typeof window.__fl4scene !== "undefined");
console.log("reduced motion: still", still, "canvases", canvases, "scene registered", threeLoaded);
if (!still || canvases || threeLoaded) fail("reduced motion still runs WebGL");
await reducedCtx.close();
// Portrait phone: the line must be in frame on the first beat.
const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const phone = await phoneCtx.newPage();
await phone.goto(BASE + "/?probe=1", { waitUntil: "networkidle" });
await phone.waitForTimeout(4000);
const orange = await phone.evaluate(() => {
  const c = document.querySelector("canvas");
  if (!c) return 0;
  const off = document.createElement("canvas");
  off.width = 78;
  off.height = 168;
  const ctx = off.getContext("2d");
  ctx.drawImage(c, 0, 0, 78, 168);
  const d = ctx.getImageData(0, 0, 78, 168).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] > 80 && d[i + 1] < 170 && d[i + 2] < 90) n++;
  return n;
});
console.log("phone beat 1, orange pixels:", orange);
await phone.screenshot({ path: `${OUT}/story-phone-beat1.png` });
if (orange < 4) fail("the first-mile line is off-screen on a phone");
await phoneCtx.close();
await page.goto(BASE + "/?render=poster", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
if (!(await page.locator("svg[role=img]").first().isVisible())) fail("poster fallback missing");
await page.screenshot({ path: `${OUT}/story-poster.png` });
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/story-full.png`, fullPage: true });
if (errors.length) fail("console errors");
console.log("ok: story");
await browser.close();
