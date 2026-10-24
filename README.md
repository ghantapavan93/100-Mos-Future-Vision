# 100 Miles of Summer — Future Vision

Where 100 Miles of Summer can go in Year 10 and beyond, as a working front end.
Eleven screens, each with a live 3D hero and a phone you can tap, all driven by
one shared engine. People and walks are sample data. It runs fully offline.

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
| `/coach` | Ask a question | Short, kind answers from approved tips, with a clear stop when it matters. |
| `/impact` | Giving back | Sponsor money that stays in the neighborhood, proven by a real walk. |
| `/xray` | How miles count | One walk, seven checks, counted once across apps, with replay. |
| `/build` | Roadmap | What works today, quick fixes, six steps to May 1, 2027. |

The header **Tour** walks every stop and runs the real commands on each phone.

## Stack

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript 5.9**
- **Tailwind CSS 4**, Motion
- **three.js** via React Three Fiber, drei and postprocessing
- **Vitest** + fast-check for unit and property tests
- **playwright-core** for browser checks (uses the installed Edge)

Every route prerenders as static HTML. No APIs, keys or map tiles.

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

## Deploy

Vercel, connected to this repo: every push to `main` deploys to production.
All routes are static, served from the edge cache. Posters, renders and
photos carry a one-day cache with a week of stale-while-revalidate.

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
    quantum/      the coach: classifier, cards, composer, validator, evals
  lib/            client store and lenses
public/
  brand/          logo and community photos
  posters/        first frame of each 3D hero, wide and tall
  renders/        stills used in cards
  fonts/          self-hosted fonts
scripts/          browser checks, screenshots, poster rendering
```

## Known limits

- **No language model.** The coach is a deterministic composer behind a
  model-ready contract. Free text stays behind a release gate.
- **The engine runs in the browser.** In production the same rules would live
  server-side: one ingest function, row-level rules, a totals view.
- **Money figures are planning ranges**, not forecasts or prices.
- **Accessibility** is checked by keyboard and automated checks only, not
  yet with a screen reader.
- **3D timing** on the live site, with an integrated AMD Radeon GPU: posters
  paint in about 0.5 s, and live 3D takes over in 1.0–2.6 s at the high tier.
  Not yet measured on a phone GPU.
