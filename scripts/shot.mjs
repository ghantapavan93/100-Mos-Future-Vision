// Screenshot one route of the running dev server in headless Edge.
//   node scripts/shot.mjs member docs/screens/member.png [width=1440] [height=900] [--full]
// Prints console errors and horizontal overflow, so a quick look is also a quick check.

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "playwright-core";

const [, , rawRoute = "/", out = "docs/screens/shot.png", w = "1440", h = "900", ...flags] = process.argv;
// Git Bash rewrites "/member" into a Windows path; accept "member" and undo the rewrite.
const route = "/" + rawRoute.replace(/^.*\/Git\//, "").replace(/^\/+/, "");
const base = process.env.LAB_URL ?? "http://localhost:3240";
await mkdir(dirname(out), { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base + route, { waitUntil: "networkidle" });
await page.waitForTimeout(Number(process.env.WAIT ?? 1800));
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
await page.screenshot({ path: out, fullPage: flags.includes("--full") });
console.log(JSON.stringify({ route, out, overflowPx: overflow, errors }, null, 0));
await browser.close();
