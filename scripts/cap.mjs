// Screenshot a screen the way a person meets it: one viewport at a time, scrolling
// down so reveals, counters and lazy images fire, at desktop and phone width.
//   node scripts/cap.mjs <route> <outDir> [width=1440] [height=900]
// Writes <outDir>/<w>-01.png, -02.png … and prints console errors, sideways
// scroll and how many viewports the page is tall.

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const [, , rawRoute = "/", outDir = "shots/cap", w = "1440", h = "900"] = process.argv;
// Git Bash rewrites "/member" into a Windows path; accept "member" and undo the rewrite.
const route = "/" + rawRoute.replace(/^.*\/Git\//, "").replace(/^\/+/, "").replace(/^home$/, "");
const base = process.env.LAB_URL ?? "http://localhost:3240";
const width = Number(w);
const height = Number(h);
const phone = width < 600;
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base + route, { waitUntil: "networkidle" });
await page.evaluate(() => sessionStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const total = await page.evaluate(() => document.documentElement.scrollHeight);
const step = Math.round(height * 0.9);
let i = 0;
for (let y = 0; y < total; y += step) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await page.waitForTimeout(900);
  i++;
  await page.screenshot({ path: `${outDir}/${width}-${String(i).padStart(2, "0")}.png` });
}
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log(JSON.stringify({ route, width, viewports: i, heightPx: total, overflowPx: overflow, errors }));
await browser.close();
