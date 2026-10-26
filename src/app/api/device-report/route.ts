// Where /device-check sends a real phone's numbers. It keeps nothing itself:
// it logs one line per report (the deployment's runtime logs on Vercel), and
// when DEVICE_REPORT_FILE is set — a local server a phone on the same Wi-Fi is
// testing — it appends the line to that file too. Device details only, no person.

import { appendFile } from "node:fs/promises";
import { z } from "zod";

const Screen = z.object({
  route: z.string().max(40),
  label: z.string().max(40),
  posterMs: z.number().nullable(),
  liveMs: z.number().nullable(),
  render: z.string().max(20).nullable(),
  tier: z.string().max(10).nullable(),
  failure: z.string().max(40).nullable(),
  frameMedianMs: z.number().nullable(),
  frameP95Ms: z.number().nullable(),
  frames: z.number(),
  slowFrames: z.number(),
  stepped: z.boolean(),
  longestGapMs: z.number(),
  triangles: z.number(),
  errors: z.array(z.string().max(200)).max(50),
});

const Report = z.object({
  /** "started" is sent as the check begins, so a run that never finishes still shows it reached the server. */
  stage: z.enum(["started", "done"]).optional(),
  device: z.object({
    userAgent: z.string().max(600),
    renderer: z.string().max(300),
    webgl2: z.boolean(),
    maxTexture: z.number(),
    dpr: z.number(),
    viewport: z.string().max(40),
    screen: z.string().max(40),
    cores: z.number().nullable(),
    memoryGb: z.number().nullable(),
    reducedMotion: z.boolean(),
    connection: z.string().max(20).nullable(),
  }),
  results: z.array(Screen).max(20),
});

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > 64_000) return Response.json({ error: "too-large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  // A real phone's run is worth more than a tidy schema: a report that doesn't match is still
  // logged (truncated, with what didn't match), never silently dropped.
  const parsed = Report.safeParse(body);
  const at = new Date().toISOString();
  const line = parsed.success
    ? JSON.stringify({ at, ...parsed.data })
    : JSON.stringify({ at, unmatched: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`), raw: text.slice(0, 20_000) });
  console.log(`[device-report] ${line}`);
  const file = process.env.DEVICE_REPORT_FILE;
  if (file) await appendFile(file, `${line}\n`);
  return new Response(null, { status: parsed.success ? 204 : 202 });
}
