// The first screen of every page, the way someone opening a link sees it: wait
// for the live 3D (or Home's opening scene), let it settle, screenshot. Desktop
// shots are kept one per screen; phone shots are also tiled four to a sheet so
// all eleven can be compared at a glance.
//
//   node scripts/heroes.mjs [outDir=shots/heroes]
//   GL=gpu node scripts/heroes.mjs              (the machine's real GPU, not SwiftShader)

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import sharp from "sharp";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const OUT = process.argv[2] ?? "shots/heroes";
const ROUTES = ["", "member", "circles", "partner", "founder", "future", "vision", "coach", "impact", "xray", "build"];
await mkdir(OUT, { recursive: true });

const args = process.env.GL === "gpu" ? ["--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const browser = await chromium.launch({ channel: "msedge", headless: true, args });
const phones = [];
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const mobile = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  for (const r of ROUTES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(`${BASE}/${r}`, { waitUntil: "networkidle" });
    await page
      .waitForFunction(
        () => document.querySelector("[data-stage]")?.getAttribute("data-ready") === "true" || document.querySelector("section[data-scene-ready]")?.getAttribute("data-scene-ready") === "true",
        null,
        { timeout: 60000 },
      )
      .catch(() => errors.push("3D never became ready"));
    await page.waitForTimeout(2500);
    const name = `${r || "home"}-${w}`;
    const file = `${OUT}/${name}.png`;
    await page.screenshot({ path: file });
    if (mobile) phones.push(file);
    console.log(`${errors.length ? "WARN" : "  ok"}  ${name}${errors.length ? "  " + errors[0] : ""}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();

// Phone sheets: four phones side by side, at half size.
for (let i = 0; i < phones.length; i += 4) {
  const group = phones.slice(i, i + 4);
  const tiles = await Promise.all(group.map((f) => sharp(f).resize(390, 844).toBuffer()));
  await sharp({ create: { width: 390 * 4 + 30, height: 844, channels: 3, background: "#222" } })
    .composite(tiles.map((input, k) => ({ input, left: k * 400, top: 0 })))
    .png()
    .toFile(`${OUT}/phones-${i / 4 + 1}.png`);
}
console.log("done");
