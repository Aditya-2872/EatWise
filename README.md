# EatWise — AI Nutrition Intelligence

An installable PWA that understands what you eat. Log food by **photo, barcode, search, or
manual entry**; EatWise identifies it, shows its confidence, asks a clarifying question when
unsure, updates your deterministic nutrition totals, and explains what to do next.

> Built to `PROJECT_SPEC.md` v1.0. The spec is the product contract — §39 lists the MVP scope
> (all implemented) and §40 lists future features that are deliberately **not** built
> (recipes, saved meals, voice logging, weekly AI reports).

## Core loop

Sign up → set a goal → deterministic calorie/macro targets → log food (photo / barcode /
search / manual) → AI identifies items with confidence + uncertainty factors → **you confirm
or edit** → server recomputes totals from the food database (never from the LLM) → AI explains
today and recommends the next meal.

## Feature map

| Area | What's implemented |
| --- | --- |
| Auth | Email/password + reset via Supabase SSR cookies; RLS on every table |
| Onboarding | Goal wizard (sex, age, height, weight, activity, goal) → Mifflin-St Jeor targets with safety floors |
| Dashboard | Today's rings/bars, macro + micro progress, meal slots, weight trend, AI next-meal card (on demand) |
| Log food | Search (local DB + USDA FoodData Central + Open Food Facts), manual quick-add, recent/favorites, barcode (camera scan + manual), photo AI analysis with confirm/edit/clarify |
| Meals | Day view grouped by meal with per-meal totals and edit/delete |
| Progress | Weight log, adherence, calorie/macro trends (Recharts) |
| Goals | Current target card + full recalculation on demand |
| Insights | Nutrient density, streaks, AI coach Q&A (rate-limited, medical disclaimer) |
| Settings | Profile, targets, units (kg/lb), theme, PWA install, account/delete |
| PWA | Manifest + icons, network-first service worker, offline shell, IndexedDB (Dexie) log queue with sync-on-reconnect, install prompt handling |
| AI | Gemini (`gemini-3.6-flash`) via a provider gateway; Zod-validated structured output; per-user rate limits; usage accounting; mock provider for tests |

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind CSS v4 ·
shadcn/ui (Base-UI) · Lucide · Recharts · Supabase (`@supabase/ssr`, Postgres + RLS) ·
TanStack Query · Zustand · react-hook-form + Zod · Dexie (IndexedDB) · sonner · next-themes ·
Vitest · Gemini API

## Getting started

### 1. Prerequisites

- Node.js ≥ 20 (22 LTS recommended)
- A Supabase project (free tier works)
- Optional: a Gemini API key (free tier works, ~20 requests/day/model), a USDA FoodData
  Central API key

### 2. Database setup

Apply the migrations and seed **in order** via the Supabase SQL editor (or `psql` against the
IPv4 session pooler):

```
supabase/migrations/0001_initial_schema.sql   -- all tables (incl. AI), RLS, functions, triggers
supabase/migrations/0002_search_rpc.sql       -- food search / recents RPCs
supabase/seed.sql                             -- common seed foods (idempotent)
```

### 3. Environment

```bash
cp .env.example .env.local       # then fill in your values
```

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Anon/publishable key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | recommended | Server-only; needed for AI-created foods, USDA/off caching, account delete |
| `AI_PROVIDER` | no | `gemini` (default) or `mock` (deterministic fake responses for development) |
| `AI_API_KEY` | for gemini | Gemini API key — server-only, never exposed to the browser |
| `AI_VISION_MODEL` / `AI_LANGUAGE_MODEL` | no | Default `gemini-3.6-flash` |
| `FOOD_API_KEY` | no | USDA FoodData Central key; search works without it (local DB + OFF only) |
| `OFF_CONTACT_EMAIL` | no | Contact email for Open Food Facts API etiquette |

Missing required variables throw a clear error naming the variable (no silent fallbacks).

### 4. Run

```bash
npm install
npm run dev        # http://localhost:3000
```

> The service worker registers in **production only** (`npm run build && npm start`) to avoid
> stale-shell issues during development.

### Scripts

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build
npm start        # serve production build
npm run lint     # eslint
npm test         # vitest unit tests (50 tests: units, calculations, targets, schemas, barcode)
```

## Architecture

```
app/
  (auth)/…            login, signup, forgot/reset password
  app/…               authenticated views (dashboard, log, food, meals, recipes,
                      progress, goals, insights, settings) + onboarding
  api/
    auth/…            signout
    logs, foods, products/barcode, goals, progress/…   REST contract (spec §25)
    ai/analyze-food-image | clarify | confirm-items | guidance | meal-plan
lib/
  ai/                 gateway.ts (runAi + JSON extraction), providers/ (gemini, mock),
                      prompts/, schemas.ts (Zod), food-mapping.ts (deterministic mapper),
                      context.ts (user context pack), usage.ts, rate limits
  nutrition/          units, calculations, targets, daily, density, trend  — pure functions
  foods/              repository, normalize, nutrients, external/ (usda, openfoodfacts)
  logging/            createLog/updateLog/deleteLog + day totals
  offline/            Dexie db + queued-log flush
  supabase/           browser/server/admin clients (@supabase/ssr)
  validation/         zod schemas shared by actions and routes
components/           feature views + ui/ (shadcn Base-UI primitives)
supabase/             migrations + seed
public/               sw.js, offline.html, icons/, manifest served by app/manifest.ts
tests/                vitest unit tests for the deterministic core
```

### The golden rule: the LLM never computes your nutrition

AI identifies food, estimates portions, and explains — **all arithmetic is deterministic typed
server code** (`lib/nutrition/*`, unit-tested):

1. Photo → Gemini returns items `{candidate, quantity, unit, confidence, uncertainty_factors}`.
2. `food-mapping.ts` matches each candidate against the local DB / USDA / OFF (Jaccard token
   similarity, score ≥ 50). Match → nutrition comes from the **database**; no match → the AI's
   rough per-100 g estimate is used, stored as an `unverified` custom food and flagged
   "AI estimate" in the UI.
3. The user confirms or edits. `confirm-items` writes logs through the same `createLog`
   service as manual logging, which recomputes the frozen `nutrition_snapshot` server-side.
4. All AI payloads pass Zod schemas with sane ranges; malformed optional fields self-heal
   (`.catch()`), out-of-range values are rejected.

Corrections are stored (`ai_corrections`) so estimates improve. The user context pack
(today's totals, remaining budget, meal slots, goal) is built deterministically in
`lib/ai/context.ts` and injected into every prompt.

### AI provider behavior (Gemini free tier)

- `thinkingBudget: 0`; **any** 400 retries once without `thinkingConfig` (the API rejects it
  on some models with a bare INVALID_ARGUMENT that never names the field).
- Only non-`thought` parts are read from `generateContent`.
- 429 is **never** retried (per-day quota); 5xx/network retries once with backoff.
- Per-user rate limits: image 4/h + 10/day · clarify 12/day · guidance 6/h + 15/day ·
  meal-plan 8/day · confirm 20/10 min. Every gateway call is recorded in `ai_analyses`
  (which doubles as the usage log, with per-type counters).

### Offline behavior (spec §23/§29)

- Service worker: navigations **network-first** with cached-shell fallback (`/offline.html`),
  hashed `/_next/static/*` cache-first, `/api/*` never cached.
- Manual logging while offline is queued in IndexedDB (Dexie, `logQueue`) and replayed
  through the same server action on reconnect; a banner shows offline / "n log(s) waiting to
  sync" / "Syncing…". Items failing server validation retry up to 5 times, then surface.
- Auth secrets are never stored in IndexedDB.

## Security notes

- Row Level Security on every table; identity comes only from the server session
  (`getUser()`), never from the request body.
- `SUPABASE_SERVICE_ROLE_KEY` and `AI_API_KEY` are server-only (modules marked `server-only`);
  the admin client is created lazily so the app boots without it.
- `food_logs.nutrition_snapshot` is frozen at write time — history never changes when food
  data is edited later.
- The barcode route validates codes server-side (6–14 digits) before any external lookup;
  external API keys are never exposed to the browser.

## Known limitations (honest, per spec)

- AI photo analysis is identification + portion estimation; per-100 g fallbacks are rough
  estimates, always flagged `unverified`.
- Gemini free tier caps daily AI calls; heavy days will hit the quota (the UI surfaces the
  failure, it never silently degrades).
- Recipes and saved meals are spec §40 future features — `/app/recipes` says so plainly.
