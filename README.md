# 100 Miles of Summer — Future Vision

[![CI](https://github.com/ghantapavan93/100-Mos-Future-Vision/actions/workflows/ci.yml/badge.svg)](https://github.com/ghantapavan93/100-Mos-Future-Vision/actions/workflows/ci.yml)

Where 100 Miles of Summer can go in Year 10 and beyond, as a working front end.
Eleven screens, each with a live 3D hero and a phone you can tap, all driven by
one shared engine — plus the Quantum Health Coach, an AI coach kept inside
approved tips and safety rules. People and walks are sample data.

**Live:** https://100-mos-future-vision.vercel.app

> Concept work. Not an official 100 Miles of Summer product. The brand mark and
> community photos are used with the team's permission.

## Screens

| Route | Screen | What it shows |
|---|---|---|
| `/` | Home | Nine summers in, why groups keep people moving, and a guided tour. |
| `/member` | Member app | Logging that counts once, sharing switches, a note to your September self. |
| `/circles` | City Circles | A no-app first walk, walks that fit you, a City Lead co-pilot, check-in. |
| `/partner` | Sponsors | Fund a city in five taps, where each dollar goes, the Year 10 money. |
| `/founder` | Kayla's week | City Leads, the few decisions only the founder makes, money in vs promised. |
| `/future` | Next 3 summers | A pilot season with go / fix / stop lines, the team in hiring order. |
| `/vision` | Big picture | A seven-scene living city, five summers, an ideas map. |
| `/coach` | AI Coach | The Quantum Health Coach: kind, personal answers inside approved tips, every word checked, Safe Stop for pain and crisis. |
| `/impact` | Giving back | Sponsor money that stays in the neighborhood, proven by a real walk. |
| `/xray` | How miles count | One walk, seven checks, counted once across apps, with replay. |
| `/build` | Roadmap | What works today, quick fixes, six steps to May 1, 2027. |

The screens are grouped into five acts — the first mile; members and community;
the AI coach and the work; sponsors and money; the future and proof — and Home
maps them on one page. The header **Tour** ("One Saturday", 14 stops) runs the
real commands on each phone, including a walk called off for heat.

## Stack

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript 5.9**
- **Tailwind CSS 4**, Motion
- **three.js** via React Three Fiber, drei and postprocessing
- **Vitest** + fast-check for unit and property tests
- **playwright-core** for browser checks (uses the installed Edge)

Every screen prerenders as static HTML. The one server route is the coach's
AI step (`/api/coach`), and it is off until a key is set.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3240
```

Requires Node 22.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server on port 3240 |
| `npm run build` | Static production build |
| `npm test` | Unit, invariant and property tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | Typecheck, tests and build in one go |
| `npm run check:browser` | Every browser check against the dev server |

Browser checks write screenshots and logs to `shots/` (git-ignored).
Set `LAB_URL` to run them against another server, such as the live site.
`GL=gpu` runs the load and hero captures on the machine's real GPU instead
of SwiftShader:

```bash
GL=gpu LAB_URL=https://100-mos-future-vision.vercel.app node scripts/check-load.mjs
```

### On a real phone

Open `/device-check` on the phone. It loads every screen in turn, full size,
and measures time to the poster, time to live 3D, the quality tier, frame
times and errors, then shows the results and posts them to
`/api/device-report`. That route stores nothing: it logs one line per report
(Vercel's runtime logs), and appends to `DEVICE_REPORT_FILE` when that is set.
To test a local build from a phone on the same Wi-Fi:

```bash
npx next build
DEVICE_REPORT_FILE=device-reports.ndjson npx next start -H 0.0.0.0 -p 3240
# then open http://<this computer's LAN IP>:3240/device-check on the phone
```

## Deploy

Vercel, connected to this repo: every push to `main` deploys to production,
and CI runs typecheck, tests and build on every push and pull request. Pages
are static, served from the edge cache. Posters, renders and photos carry a
one-day cache with a week of stale-while-revalidate.

To switch the AI coach on, add `ANTHROPIC_API_KEY` in the Vercel project's
environment variables and redeploy. Without it, the approved tips answer alone
and the phone says so.

## The AI coach

```
question ─▶ classify ──▶ safety first ──▶ AI drafts ──▶ every check ──▶ answer
            (topic)      pain, crisis,     kind lines     diagnosis,       with
                         food, others'     + approved     prescription,    "who says"
                         data: rules only  tip ids        new facts, …
```

- **The AI writes the kind part, never the facts.** `/api/coach` asks Claude
  for one or two personal lines and which approved tips fit, as JSON. The tips
  appear in their own words.
- **Some topics never reach the model.** The same classifier runs on the
  server and in the engine: pain, crisis, health conditions, food, other
  members' data and anything not understood get the fixed, reviewed answer.
- **The engine decides.** The AI's draft is a proposal on the `ASK_COACH`
  command. The validator runs every check on it — plus no new facts or
  numbers, approved tips only, no links. One failure and the approved tips
  answer alone. The answer records which it was.
- **Two locks.** A new set of tips must pass the regression gate (nothing that
  passed before may fail). Typing free text also needs the absolute safety
  gate: every safety-critical test passes, old misses included. "No worse
  than before" never counts as "safe".
- **Private by design.** The model sees the member's first name and the
  summary they chose to share — never Strava, never other members. The AI's
  words stay out of the audit trail, and "Forget what I asked" erases them.

## Architecture

```
UI (screens, phones)  ── dispatch(command, actor) ──▶  engine.execute()
                                                        input → authorize → reconcile
                                                        → policy → apply → audit → project
                                                                     │
selectors (memberView, chapterView, partnerView, …)  ◀──── World ────┘
```

- **One engine.** Every screen sends commands to the same pure-TypeScript
  engine. Each command leaves a receipt on a hash chain, so the whole world
  can be replayed and checked.
- **Rules as data.** `policy.ts` decides, per source and purpose, who may see
  or count what. Selectors ask it before showing anything.
- **Erasure that holds.** Deleting a member shreds their payloads; the chain
  still replays.
- **One money model.** Sponsors and Next 3 summers read the same module, so
  the two screens can't disagree.

### 3D without the wait

- Each hero paints a poster (`public/posters`) with the HTML, then crossfades
  to the live canvas once its first frame is ready.
- A GPU probe picks a quality tier (DPR, MSAA, grain). A frame budget steps
  down once if frames run slow.
- Scenes render on demand, so an idle page costs nothing.
- three.js loads in its own chunk, behind the poster.

## Project structure

```
src/
  app/            routes, layout, global styles
  blueprint/      feature and roadmap data for the Roadmap screen
  components/
    three/        shared 3D kit: Stage, SceneCanvas, Hero, Label, palette
    demo/         shared screen kit: Phone, TryIt, Ideas, DataStrip, Story
    ui/           primitives: kit, reveals, marquee
    shell/        header, nav, page frame
    present/      the guided tour
    inspect/      under-the-hood drawer
    story/        home page
    <screen>/     one folder per screen (member, circles, partner, …)
  domain/         the engine: commands, policy, erasure, projections, plans
    quantum/      the coach: classifier, cards, composer, validator, evals, AI checks
  app/api/coach/  the AI step (server)
  lib/            client store, lenses, the coach's AI client
public/
  brand/          logo and community photos
  posters/        first frame of each 3D hero, wide and tall
  renders/        stills used in cards
  fonts/          self-hosted fonts
scripts/          browser checks, screenshots, poster rendering
```

## Known limits

- **The AI needs a key, and its words are measured only by the checks.** The
  live model path is tested for its gates, not yet against real model output
  at scale. Free text stays closed until the safety gate passes.
- **The engine runs in the browser.** Roles and receipts here are a
  simulation, not security: the hash chain uses FNV-1a (not cryptographic),
  and anyone can edit client state. In production the same rules would live
  server-side: one ingest function, row-level rules, a totals view, signed
  receipts.
- **Money figures are planning ranges**, not forecasts or prices.
- **Accessibility** is checked by keyboard and automated checks only, not
  yet with a screen reader.
- **3D timing** on the live site, with an integrated AMD Radeon GPU: posters
  paint in about 0.5 s, and live 3D takes over in 1.0–2.6 s at the high tier.
  Not yet measured on a phone GPU.
