// How fast each 3D hero shows something, and whether the hand-over from poster
// to live canvas is clean. For each screen: time to the poster painting, time to
// the live first frame, and a screenshot at both moments so the two can be
// compared. Run against `next start` to see what a deployed visit feels like.
//
//   node scripts/check-load.mjs [lens …]        (LAB_URL defaults to :3240)

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const OUT = "shots/load";
const ALL = ["member", "coach", "circles", "partner", "impact", "founder", "future", "xray", "build", "vision"];
const LENSES = process.argv.length > 2 ? process.argv.slice(2) : ALL;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
let failed = 0;
for (const lens of LENSES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const t0 = Date.now();
  const res = await page.goto(`${BASE}/${lens}`, { waitUntil: "commit" });
  if (!res || res.status() >= 400) {
    console.log(`  --  ${lens}: ${res?.status() ?? "no response"}`);
    await page.close();
    continue;
  }
  const stage = page.locator("[data-stage]").first();
  await stage.waitFor({ state: "attached", timeout: 30000 });
  const posterMs = await page
    .locator("[data-stage] picture img")
    .first()
    .evaluate((img) => (img.complete && img.naturalWidth > 0 ? 0 : new Promise((r) => img.addEventListener("load", () => r(0), { once: true }))))
    .then(() => Date.now() - t0)
    .catch(() => null);
  await page.screenshot({ path: `${OUT}/${lens}-1-poster.png` });
  await page.waitForFunction(() => document.querySelector("[data-stage]")?.getAttribute("data-ready") === "true", null, { timeout: 90000 }).catch(() => null);
  const liveMs = Date.now() - t0;
  const ready = (await stage.getAttribute("data-ready")) === "true";
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${lens}-2-live.png` });
  const tier = await stage.getAttribute("data-tier");
  const ok = ready && posterMs !== null && errors.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? "  ok" : "FAIL"}  ${lens.padEnd(8)} poster ${posterMs ?? "none"} ms · live ${ready ? liveMs + " ms" : "never"} · tier ${tier}${errors.length ? " · " + errors[0] : ""}`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
