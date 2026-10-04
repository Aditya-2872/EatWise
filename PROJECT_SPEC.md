# PROJECT_SPEC.md

# AI Nutrition Intelligence Platform
### Full-Stack Progressive Web App — Product & Engineering Specification
**Version:** 1.0  
**Date:** 2026-10-04  
**Status:** Build specification  
**Primary goal:** Give an AI coding agent enough product, UX, architecture, data, API, security, and acceptance requirements to build a production-quality MVP without inventing missing requirements.

---

# 1. Product Overview

Build a full-stack, installable Progressive Web App (PWA) for personal nutrition tracking and guidance.

The product is **not** positioned as a generic calorie counter. Its core concept is:

> **Know what you ate. Know what you need. Know what to eat next.**

Users can log food through:
- AI photo analysis
- barcode scanning
- manual food search
- natural-language text
- voice input
- saved meals
- recipes

The system then:
1. identifies food;
2. retrieves authoritative nutrition data;
3. estimates portions;
4. calculates calories/macros/micros;
5. communicates uncertainty where appropriate;
6. learns recurring user foods and portions;
7. compares intake against the user's goals;
8. recommends useful next actions/meals;
9. adapts targets based on real progress.

The product's core differentiator is **nutrition intelligence**, not merely AI image recognition.

## Core product pillars

1. **Fast logging**
2. **Trustworthy AI**
3. **Personal food memory**
4. **Adaptive nutrition targets**
5. **Next-meal recommendations**
6. **Strong Indian/regional food support**
7. **Budget-aware nutrition as a future differentiator**
8. **Cross-device PWA experience**

---

# 2. Problem Statement

Existing nutrition apps commonly make users manually search for foods, enter portions, track calories, and interpret the resulting numbers themselves.

Major competitors already provide many individual capabilities:
- calorie tracking
- barcode scanning
- photo logging
- voice logging
- recipes
- meal planning
- wearable integrations
- AI coaching
- detailed nutrient databases

Therefore, simply adding "AI photo calorie detection" is not sufficient differentiation.

The product must solve the larger problem:

> Users do not only need to know what they ate. They need help understanding what that means for their personal goal and what they should do next.

Additional problems:
- mixed dishes are difficult to estimate;
- restaurant food has unknown preparation quantities;
- hidden oils/sauces create uncertainty;
- generic TDEE calculations can become inaccurate;
- users repeatedly eat the same foods but repeatedly log them;
- nutrition data can differ between sources;
- users often abandon trackers because logging is tedious;
- Indian and regional homemade foods are particularly variable;
- users need practical recommendations rather than walls of nutritional numbers.

---

# 3. Product Vision

Build a **personal nutrition intelligence system**.

The product should evolve from:

> "Track your calories"

to:

> "Tell/show us what you eat and what you want to achieve; we will help manage the nutrition decisions."

Long-term progression:

```text
LOG
 ↓
UNDERSTAND
 ↓
VERIFY
 ↓
LEARN
 ↓
ADAPT
 ↓
RECOMMEND
 ↓
PREDICT
```

Long-term vision:
- personal nutrition model;
- adaptive calorie/macro targets;
- food recognition;
- personalized recipes;
- restaurant guidance;
- grocery intelligence;
- budget-aware nutrition;
- health/wearable integrations;
- optional professional/dietitian workflows.

The app must not make medical diagnoses or unsupported medical claims.

---

# 4. Target Users

## Primary

### A. Fitness / gym users
Goals:
- fat loss
- muscle gain
- body recomposition
- maintenance

Needs:
- calories
- protein
- macros
- meal recommendations
- progress tracking

### B. General health-conscious users
Needs:
- simple food logging
- nutrition quality
- practical recommendations
- habit consistency

### C. Students / young adults
Important initial market opportunity, especially in India.

Needs:
- affordable food
- Indian meals
- simple logging
- protein guidance
- budget-conscious meal ideas

### D. Indian users
Need support for:
- homemade meals
- Indian dishes
- thalis
- rotis/parathas
- dal/sabzi
- regional cuisines
- packaged Indian foods
- restaurant food

## Secondary / future

- athletes
- dietitians
- nutrition coaches
- gyms
- corporate wellness programs
- families

---

# 5. Core Differentiator

## Primary differentiator

### Confidence-aware AI nutrition

The system must not present uncertain computer-vision estimates as absolute facts.

Example:

> Paneer Butter Masala  
> ~470–590 kcal  
> Confidence: 74%  
> Main uncertainty: oil quantity and portion size

The system should ask a short clarification question only when the answer can materially improve the estimate.

Example:

> Was the rice approximately 1/2 cup or 1 cup?

This is called **Smart Clarification**.

## Secondary differentiators

### Personal Food Model
The system learns:
- frequent foods
- brands
- recipes
- portions
- meal combinations
- cooking methods
- user corrections

### Next-Meal Intelligence
The app recommends what the user should eat next based on:
- remaining calories
- remaining protein/macros
- goal
- preferences
- dietary restrictions
- previous meals
- time of day
- available foods
- optional budget

### Adaptive Targets
Over time, targets should be informed by actual weight/intake trends rather than permanently relying on an initial calculator.

### India-first food intelligence
Build strong Indian-food support without claiming that Indian food recognition itself is unique.

---

# 6. Platforms & Responsiveness

## Platforms

One responsive web application:
- mobile browsers
- Android PWA
- iOS Safari/PWA where supported
- Windows
- macOS
- Linux
- desktop browsers

## Breakpoints

Use responsive layout rather than separate mobile/desktop applications.

Suggested:
- mobile: < 640px
- tablet: 640–1023px
- desktop: >= 1024px
- wide desktop: >= 1440px

Do not make the interface merely a stretched mobile layout.

## Mobile priorities
- thumb-friendly controls
- camera-first logging
- bottom navigation
- compact cards
- bottom sheets
- large touch targets
- minimal typing

## Desktop priorities
- sidebar navigation
- richer dashboard
- multi-column views
- larger charts
- keyboard accessibility
- drag/drop where useful

---

# 7. Tech Stack

## Required frontend

- Next.js latest stable version using App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui or equivalent accessible component primitives
- Lucide icons or equivalent
- Recharts or equivalent charting library

## Backend

Use Next.js server-side functionality for application APIs where practical:
- Route Handlers
- Server Actions where appropriate
- server-side Supabase client
- background jobs/queues for expensive asynchronous tasks

Do not expose privileged AI/API secrets to the browser.

## Database/backend platform

### Supabase

Use:
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security
- Realtime only where actually needed

Supabase's current Next.js guidance supports cookie-based SSR authentication using `@supabase/ssr`. Use server/client Supabase utilities appropriately.

## State management

Use:
- TanStack Query for server/remote state
- Zustand only for local cross-component UI state
- React state for simple component-local state

Do not put the entire database into Zustand.

## Forms/validation

- React Hook Form
- Zod

## PWA

- Web App Manifest
- Service Worker
- Workbox or next-pwa equivalent if compatible with the chosen Next.js version
- IndexedDB via Dexie or equivalent for offline data
- background synchronization where supported

## AI

Implement an internal **AI Provider Gateway** so providers can be replaced.

Do not tightly couple application code to one AI vendor.

The gateway should support:
- vision model
- language model
- embeddings if needed
- structured JSON output
- model routing
- usage tracking
- retries
- timeouts
- rate limits

## Food data

Potential sources:
- USDA FoodData Central
- Open Food Facts
- licensed/commercial food databases where required
- proprietary normalized food database

External providers must be wrapped behind an internal data-access layer.

---

# 8. Design System

## Design direction

Modern, premium, calm, health-focused.

Avoid:
- generic "AI startup" gradients everywhere;
- excessive neon;
- over-rounded childish cards;
- dense spreadsheet-like nutrition screens;
- fake medical aesthetics.

The product should feel:
- trustworthy
- intelligent
- warm
- clean
- fast
- premium
- approachable

## Color system

Define semantic tokens, not hard-coded colors throughout components.

Example:
- background
- surface
- surface-muted
- foreground
- foreground-muted
- primary
- primary-foreground
- success
- warning
- destructive
- border

Choose a restrained primary accent associated with freshness/nutrition.

## Typography

Use a modern sans-serif.
Prioritize:
- readability
- numeric clarity
- clear hierarchy

Numbers for calories/macros should be visually strong.

## Radius

Use moderate corner radii consistently.

## Spacing

Use an 8px-based spacing system.

## Components

Create reusable:
- Button
- Input
- Select
- Dialog
- Drawer/Sheet
- Tabs
- Card
- Badge
- Tooltip
- Progress bar
- Progress ring
- Skeleton
- Toast
- Dropdown
- Command/search
- Data table
- Chart
- Food result card
- Meal card
- Nutrition summary
- AI insight card
- Confidence indicator

---

# 9. Pages & Navigation

## Public routes

- `/`
- `/about`
- `/privacy`
- `/terms`
- `/contact`

## Auth routes

- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/auth/callback`
- `/auth/confirm`

## App routes

- `/app`
- `/app/dashboard`
- `/app/log`
- `/app/food`
- `/app/meals`
- `/app/recipes`
- `/app/progress`
- `/app/goals`
- `/app/insights`
- `/app/settings`

Optional future:
- `/app/grocery`
- `/app/restaurants`
- `/app/budget`
- `/app/coach`

## Navigation

### Mobile bottom nav

Recommended:
1. Home
2. Log
3. Progress
4. Insights
5. Profile

### Desktop sidebar

- Dashboard
- Log Food
- Meals
- Recipes
- Progress
- Insights
- Goals
- Settings

Prominent global action:
> **+ Log Food**

---

# 10. User Authentication

Use Supabase Auth.

## Required

- email/password signup
- email/password login
- email verification
- password reset
- logout
- persistent session
- protected routes

## Optional MVP

- Google OAuth

## Future

- Apple
- passkeys
- magic link

## Security

Never trust client-side user IDs.

Every protected database operation must derive identity from the authenticated server session.

Use Row Level Security on all user-owned tables.

Supabase documentation recommends RLS for protecting database data and cookie-based SSR auth for Next.js.

---

# 11. User Onboarding

Onboarding must be short.

## Required information

1. name/display name
2. age
3. sex where required for calculation
4. height
5. current weight
6. activity level
7. primary goal
8. optional target weight
9. dietary preference
10. optional allergies/restrictions

## Goal options

- Lose weight
- Gain weight
- Build muscle
- Recomposition
- Maintain
- Improve nutrition

## Optional preferences

- vegetarian
- vegan
- eggitarian
- halal
- allergies
- disliked foods
- cuisine preferences
- meal frequency
- budget

## Onboarding result

Show:

> Your starting target

with:
- estimated calorie target
- protein target
- macro targets
- explanation
- disclaimer that these are estimates

Do not present calorie targets as medical prescriptions.

---

# 12. Dashboard

Dashboard is the primary screen.

## Required sections

### Today's summary
- calories consumed
- calorie target
- calories remaining
- protein consumed/target
- carbs consumed/target
- fat consumed/target

### Today's meals
- breakfast
- lunch
- snacks
- dinner
- timestamps

### Quick logging
- camera
- barcode
- voice
- manual

### AI insight

Example:

> You're 38g short of your protein target. A high-protein dinner around 600–700 kcal would fit your remaining budget.

### Progress snapshot

- current weight
- 7-day trend
- goal progress

## Dashboard principle

Do not overwhelm users with every micronutrient.

Advanced nutrients are available through details.

---

# 13. Food Logging

Support:

1. Photo
2. Barcode
3. Voice
4. Text
5. Manual search
6. Saved food
7. Saved meal
8. Recipe

## Logging object

Each food log should record:
- food ID
- user ID
- quantity
- unit
- meal type
- timestamp
- source
- nutrition snapshot
- confidence
- AI analysis metadata where applicable

## Important

When a food's master nutrition data later changes, historical logs should retain a nutrition snapshot so past records do not silently change.

---

# 14. AI Food Photo Analysis

## User flow

1. User opens Log Food.
2. Chooses camera/upload.
3. Captures image.
4. Image is compressed client-side where practical.
5. Image is uploaded securely.
6. Vision model identifies candidate foods.
7. System estimates portions.
8. System maps foods to normalized database records.
9. Nutrition engine calculates values.
10. Confidence is calculated.
11. System decides whether clarification is required.
12. User reviews.
13. User edits if necessary.
14. User confirms.
15. Food log is saved.

## AI output must be structured

Example:

```json
{
  "items": [
    {
      "candidate": "dal tadka",
      "estimated_quantity": 180,
      "unit": "g",
      "confidence": 0.81,
      "uncertainty_factors": [
        "oil_quantity",
        "exact_recipe"
      ]
    }
  ],
  "needs_clarification": true,
  "clarification": {
    "question": "Was this homemade or restaurant-prepared?"
  }
}
```

## Never allow the model to directly invent nutrition numbers if a verified database match exists.

AI should primarily:
- identify;
- classify;
- estimate portion;
- decompose dishes;
- ask questions.

The nutrition engine should calculate numbers from structured food data.

---

# 15. Barcode Scanner

## User flow

1. Open scanner.
2. Request camera permission.
3. Detect EAN/UPC/other supported barcode.
4. Normalize barcode.
5. Search local product database/cache.
6. If not found, query external provider.
7. Display product.
8. Allow serving/quantity selection.
9. Add to meal.

## Important fallback

If barcode scanning is unavailable:
- provide manual barcode entry;
- provide product search;
- allow camera retry.

If a valid barcode has no product record:
- do not crash;
- show "Product not found";
- offer "Add product manually";
- optionally allow label photo/OCR in future.

## Data source

Open Food Facts can be used as an initial barcode source, subject to its API terms, rate limits, attribution requirements, and production architecture.

Do not call external barcode APIs directly from every client request in production.

Use server-side caching and a normalized internal product database.

---

# 16. Manual Food Search

Provide fast search.

Search by:
- food name
- brand
- barcode
- cuisine
- common synonym

Examples:
- paneer
- paneer tikka
- Amul paneer
- roti
- chicken biryani

## Search ranking

Prioritize:
1. user's recent foods
2. user's frequent foods
3. exact verified foods
4. branded products
5. generic foods
6. external database fallback

## Search result

Show:
- food name
- brand if available
- serving
- calories
- protein
- verification/confidence status

---

# 17. Meal & Recipe Tracking

## Meals

Users can create:
- breakfast
- lunch
- dinner
- snack
- custom meal

Users can save combinations.

Example:
> "My normal breakfast"

contains:
- 3 eggs
- 2 toast
- curd

## Recipes

Recipe model:
- name
- servings
- ingredients
- ingredient quantities
- instructions
- nutrition per serving
- image
- owner

## Recipe nutrition

Calculate nutrition from ingredients.

Do not rely on LLM arithmetic.

## Future AI recipe editing

User:

> Make this under 650 calories and above 40g protein.

AI proposes ingredient modifications.

All modifications require user confirmation.

---

# 18. Nutrition Calculations

Create a dedicated nutrition calculation service.

## Core calculations

- calories
- protein
- carbohydrates
- fat
- fiber
- sugar
- saturated fat
- sodium

## Advanced

- cholesterol
- potassium
- calcium
- iron
- magnesium
- vitamin D
- B vitamins
- vitamin C
- other available nutrients

## Calculation principle

Nutrition:

```text
nutrition_per_reference_unit
×
user_quantity
```

with correct unit conversions.

## Never use an LLM for deterministic arithmetic.

Use typed server-side functions.

## Daily totals

Aggregate confirmed logs for the user's local calendar day.

Handle timezone correctly.

---

# 19. AI Nutrition Guidance

The AI coach is not a generic chatbot.

It must have structured access to:
- user goals
- current targets
- food logs
- recent weight trend
- nutrition totals
- saved foods
- preferences
- restrictions
- available recipes

## AI capabilities

### Explain

> Why am I low on protein?

### Recommend

> What should I eat for dinner?

### Analyze

> How was my week?

### Plan

> Plan tomorrow's meals.

### Adapt

> My weight hasn't changed for two weeks.

### Compare

> Which is better for my goal: rice or roti?

## AI rules

- Never fabricate food database information.
- Never claim certainty where data is uncertain.
- Clearly distinguish estimates from verified values.
- Never diagnose disease.
- Never prescribe medical treatment.
- Recommend professional medical advice when appropriate.
- Ask clarification only when useful.
- Keep recommendations actionable.

---

# 20. Goals & Personalization

## Goal object

Store:
- goal type
- target weight
- target rate
- calorie target
- protein target
- macro targets
- start date
- optional end date
- active/inactive

## Personalization

Track:
- favorite foods
- disliked foods
- frequent meals
- dietary restrictions
- allergies
- cuisines
- budget preference
- meal timing
- user corrections

## Adaptive targets

Do not automatically make large changes.

Use a controlled algorithm:
- observe weight trend;
- compare expected vs observed change;
- evaluate adherence;
- suggest target adjustment;
- require confirmation for meaningful changes.

---

# 21. Progress Tracking

## Weight

- daily/weekly entries
- graph
- moving average
- trend
- target line

## Nutrition

- calorie adherence
- protein adherence
- macro distribution
- fiber
- optional micronutrients

## Goal progress

Examples:
- target weight
- rate of change
- days on target
- protein target hit percentage

## Weekly report

Provide:
- average calories
- average protein
- weight trend
- strongest habit
- biggest issue
- recommended change

Avoid guilt-based language.

---

# 22. Notifications / Reminders

## MVP

Optional:
- meal logging reminder
- weigh-in reminder
- daily summary

Users must be able to disable notifications.

## Future

- smart meal reminders
- personalized protein reminder
- grocery reminder
- weekly review
- adaptive reminders based on missed logs

Never spam users.

---

# 23. PWA Requirements

The application must be installable.

## Required

- `manifest.webmanifest`
- app icons
- theme color
- display mode
- service worker
- offline app shell
- install prompt handling
- responsive viewport
- HTTPS in production

A web app manifest is required for installability in supporting browsers.

## Offline behavior

At minimum:
- open cached application shell;
- display previously loaded dashboard;
- queue basic food-log actions;
- sync when connection returns.

## IndexedDB

Use IndexedDB for:
- offline log queue
- cached recent foods
- cached dashboard data
- pending uploads where feasible

## Do not store sensitive authentication secrets in IndexedDB.

## Camera

Use browser camera APIs with permission handling.

## PWA limitations

Do not assume every native mobile capability is available on every browser.

Feature-detect:
- camera
- notifications
- barcode APIs
- background sync
- installability

Provide fallbacks.

---

# 24. Database Schema

Use PostgreSQL.

All user-owned tables should have RLS.

## `profiles`

```text
id UUID PK references auth.users
display_name TEXT
avatar_url TEXT
date_of_birth DATE nullable
sex TEXT nullable
height_cm NUMERIC
current_weight_kg NUMERIC
timezone TEXT
locale TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## `user_goals`

```text
id UUID PK
user_id UUID FK
goal_type TEXT
target_weight_kg NUMERIC nullable
target_rate_per_week NUMERIC nullable
calorie_target INTEGER
protein_target_g NUMERIC
carb_target_g NUMERIC
fat_target_g NUMERIC
start_date DATE
end_date DATE nullable
is_active BOOLEAN
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## `dietary_preferences`

```text
id UUID PK
user_id UUID FK UNIQUE
diet_type TEXT
allergies JSONB
disliked_foods JSONB
preferred_cuisines JSONB
budget_level TEXT nullable
meal_preferences JSONB
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## `food_items`

Master normalized foods.

```text
id UUID PK
name TEXT
normalized_name TEXT
brand TEXT nullable
barcode TEXT nullable
source TEXT
source_id TEXT nullable
verification_status TEXT
serving_size NUMERIC
serving_unit TEXT
calories NUMERIC
protein_g NUMERIC
carbs_g NUMERIC
fat_g NUMERIC
fiber_g NUMERIC
sugar_g NUMERIC
sodium_mg NUMERIC
micronutrients JSONB
metadata JSONB
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## `food_aliases`

```text
id UUID PK
food_id UUID FK
alias TEXT
locale TEXT
```

## `food_sources`

Track provenance.

```text
id UUID PK
food_id UUID FK
provider TEXT
external_id TEXT
source_url TEXT nullable
source_version TEXT nullable
retrieved_at TIMESTAMPTZ
```

## `user_foods`

Personal food memory.

```text
id UUID PK
user_id UUID FK
food_id UUID FK
custom_name TEXT nullable
usual_quantity NUMERIC nullable
usual_unit TEXT nullable
usage_count INTEGER
last_used_at TIMESTAMPTZ
custom_metadata JSONB
```

## `food_logs`

```text
id UUID PK
user_id UUID FK
food_id UUID FK nullable
meal_id UUID FK nullable
quantity NUMERIC
unit TEXT
meal_type TEXT
logged_at TIMESTAMPTZ
source TEXT
confidence NUMERIC nullable
nutrition_snapshot JSONB
ai_metadata JSONB nullable
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## `meals`

```text
id UUID PK
user_id UUID FK
name TEXT
meal_type TEXT
logged_at TIMESTAMPTZ
notes TEXT nullable
created_at TIMESTAMPTZ
```

## `meal_items`

```text
id UUID PK
meal_id UUID FK
food_id UUID FK
quantity NUMERIC
unit TEXT
nutrition_snapshot JSONB
```

## `recipes`

```text
id UUID PK
user_id UUID FK
name TEXT
description TEXT nullable
servings NUMERIC
instructions TEXT nullable
image_url TEXT nullable
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## `recipe_ingredients`

```text
id UUID PK
recipe_id UUID FK
food_id UUID FK
quantity NUMERIC
unit TEXT
sort_order INTEGER
```

## `weight_entries`

```text
id UUID PK
user_id UUID FK
weight_kg NUMERIC
recorded_at TIMESTAMPTZ
source TEXT
notes TEXT nullable
```

## `ai_analyses`

```text
id UUID PK
user_id UUID FK
type TEXT
input_storage_path TEXT nullable
model_provider TEXT
model_name TEXT
request_metadata JSONB
response_json JSONB
confidence NUMERIC nullable
status TEXT
error_code TEXT nullable
created_at TIMESTAMPTZ
```

## `ai_corrections`

```text
id UUID PK
user_id UUID FK
analysis_id UUID FK
field_name TEXT
original_value JSONB
corrected_value JSONB
created_at TIMESTAMPTZ
```

## `notifications`

```text
id UUID PK
user_id UUID FK
type TEXT
title TEXT
body TEXT
scheduled_for TIMESTAMPTZ
read_at TIMESTAMPTZ nullable
created_at TIMESTAMPTZ
```

## `user_settings`

```text
user_id UUID PK
theme TEXT
notifications_enabled BOOLEAN
analytics_enabled BOOLEAN
ai_personalization_enabled BOOLEAN
units TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## Indexes

At minimum:
- all `user_id`
- `food_items.normalized_name`
- `food_items.barcode`
- `food_aliases.alias`
- `food_logs.logged_at`
- `weight_entries.recorded_at`

Use appropriate full-text/trigram/search indexes as the database grows.

---

# 25. API Requirements

Use typed request/response schemas.

## Authentication

Handled through Supabase Auth.

## Food

### `GET /api/foods/search?q=`

Search normalized food database.

### `GET /api/foods/:id`

Get food details.

### `GET /api/products/barcode/:barcode`

Resolve barcode.

### `POST /api/foods/custom`

Create user custom food.

## Logging

### `POST /api/logs`

Create confirmed food log.

### `PATCH /api/logs/:id`

Edit log.

### `DELETE /api/logs/:id`

Delete log.

### `GET /api/logs?date=YYYY-MM-DD`

Get daily logs.

## AI

### `POST /api/ai/analyze-food-image`

Accept image metadata/upload reference.

Return structured candidates.

### `POST /api/ai/clarify`

Process user's clarification.

### `POST /api/ai/guidance`

Return nutrition guidance.

### `POST /api/ai/meal-plan`

Generate meal suggestions.

## Progress

### `GET /api/progress/summary`

### `GET /api/progress/weight`

### `POST /api/progress/weight`

## Goals

### `GET /api/goals`

### `POST /api/goals`

### `PATCH /api/goals/:id`

## API rules

- validate every request with Zod;
- authenticate protected requests;
- derive user identity server-side;
- enforce authorization;
- rate-limit expensive endpoints;
- never expose provider API keys;
- return consistent error structures.

---

# 26. AI Requirements

## AI Gateway

Create:

```text
lib/ai/
  gateway.ts
  providers/
    provider-a.ts
    provider-b.ts
  prompts/
  schemas/
  routing/
  usage.ts
```

Application code should call the gateway rather than a vendor SDK directly.

## Structured output

Every AI workflow must have a Zod schema.

Example:

```ts
const FoodAnalysisSchema = z.object({
  items: z.array(...),
  needsClarification: z.boolean(),
  clarification: z.object({
    question: z.string()
  }).nullable()
});
```

## Model routing

Use cheaper models for:
- simple classification
- simple text parsing
- known foods

Use stronger models for:
- complex mixed dishes
- ambiguous photos
- recipe decomposition

## AI cost controls

Track:
- model
- tokens
- image count
- latency
- estimated cost
- user
- endpoint

Set per-user rate limits.

## AI evaluation

Create an internal evaluation dataset for:
- Indian dishes
- packaged products
- mixed plates
- portion estimation
- common mistakes

Track:
- identification accuracy
- correction rate
- confidence calibration
- latency
- cost

---

# 27. External APIs

## USDA FoodData Central

Use as a nutrition data source where appropriate.

Store normalized records internally rather than making the browser dependent on the external API.

## Open Food Facts

Use for packaged food/barcode discovery where appropriate.

Respect:
- API terms
- attribution
- rate limits
- User-Agent requirements
- licensing
- production caching requirements

## AI providers

Use configurable provider adapters.

Do not hard-code the project to a single vendor.

## Future

Potential integrations:
- Apple Health
- Google Health/Health Connect ecosystem
- wearable providers
- restaurant/menu data providers
- grocery/product providers

---

# 28. State Management

## Server state

Use TanStack Query for:
- dashboard
- food search
- logs
- progress
- goals
- recipes

## Client state

Use Zustand for:
- logging modal state
- temporary food-analysis workflow
- offline sync status
- global UI preferences

## Local state

Use React state for:
- form fields
- dialogs
- tabs
- temporary UI state

## Rule

Do not duplicate server data into multiple client stores.

Invalidate/refetch queries after mutations.

Use optimistic updates only when rollback is safe.

---

# 29. Error Handling

Every error must have:
- user-friendly message
- internal error code
- logging/observability metadata
- retry behavior where appropriate

## AI failure

Never leave the user stuck.

Example:

> AI analysis couldn't be completed.

Actions:
- Try again
- Enter manually

## Barcode failure

> Product not found.

Actions:
- Search product
- Enter manually
- Scan again

## Network failure

> You're offline. Your log will be saved and synced when you're back online.

## Database failure

Do not expose raw SQL/provider errors.

---

# 30. Loading / Empty States

Every data-driven screen needs:
- loading
- empty
- error
- success

## Dashboard loading

Use skeletons, not blank screens.

## No meals

> Nothing logged yet.

CTA:
> Log your first meal

## No progress

> Add your first weight entry to see your trend.

## AI processing

Show meaningful progress:

> Looking at your meal...  
> Identifying foods...  
> Estimating portions...  
> Checking nutrition...

Do not fake exact progress percentages.

---

# 31. Accessibility

Target WCAG 2.2 AA where practical.

Required:
- keyboard navigation
- visible focus states
- semantic HTML
- labels for form controls
- screen-reader-friendly dialogs
- sufficient contrast
- reduced-motion support
- no color-only information
- accessible charts with text summaries
- touch targets of appropriate size

Camera/scanner must have accessible fallback.

---

# 32. Security

## Authentication

Use Supabase Auth.

## Authorization

RLS on user-owned tables.

Every API endpoint must verify the authenticated user.

## Secrets

Never expose:
- AI API keys
- database service-role keys
- privileged credentials

to the browser.

## Upload security

- validate MIME type
- validate file size
- generate safe storage paths
- do not trust filename
- restrict storage access
- consider image stripping/resizing

## Input validation

Validate all user input server-side.

## Rate limiting

Especially:
- AI endpoints
- image uploads
- barcode lookup
- account creation
- password-related operations

## Privacy

Nutrition and body data can be sensitive.

Minimize collection.

Provide:
- account deletion
- data export where feasible
- privacy policy
- clear AI-data usage explanation

## Logging

Do not log:
- passwords
- auth tokens
- sensitive food/body data unnecessarily
- raw uploaded images unless required

---

# 33. Performance

## Goals

Aim for:
- fast first load
- small client bundles
- responsive interactions
- lazy loading of heavy features

## Next.js

Prefer:
- Server Components where appropriate
- Client Components only where interactivity requires them
- dynamic imports for camera/scanner/charts
- optimized images

## Database

Use:
- indexes
- pagination
- query limits
- server-side aggregation
- caching

## AI

- compress images before upload
- use model routing
- cache repeated lookups
- async expensive processing
- enforce timeouts

## Search

Do not load entire food database into browser.

---

# 34. Responsive Behavior

## Mobile

Dashboard:
- single column
- sticky quick log action
- bottom nav
- bottom sheets for food selection
- camera takes priority

Food analysis:
- image at top
- identified foods below
- sticky confirmation CTA

## Desktop

Dashboard:
- left navigation
- central dashboard
- optional right insight panel

Food logging:
- split view where useful
- image left
- nutrition analysis right

Charts:
- larger visualizations
- hover details
- accessible text summary

Never hide critical functionality on mobile.

---

# 35. Folder Structure

Suggested:

```text
/
├── app/
│   ├── (marketing)/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── app/
│   │   ├── dashboard/
│   │   ├── log/
│   │   ├── food/
│   │   ├── meals/
│   │   ├── recipes/
│   │   ├── progress/
│   │   ├── insights/
│   │   ├── goals/
│   │   └── settings/
│   ├── api/
│   │   ├── foods/
│   │   ├── logs/
│   │   ├── ai/
│   │   ├── goals/
│   │   └── progress/
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── ui/
│   ├── dashboard/
│   ├── food/
│   ├── logging/
│   ├── meals/
│   ├── recipes/
│   ├── progress/
│   ├── ai/
│   └── navigation/
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── proxy.ts
│   ├── ai/
│   │   ├── gateway.ts
│   │   ├── providers/
│   │   ├── schemas/
│   │   ├── prompts/
│   │   └── routing/
│   ├── nutrition/
│   │   ├── calculations.ts
│   │   ├── targets.ts
│   │   └── units.ts
│   ├── foods/
│   │   ├── search.ts
│   │   ├── barcode.ts
│   │   └── sources/
│   ├── validation/
│   ├── utils/
│   └── constants/
│
├── hooks/
├── stores/
├── types/
├── public/
│   ├── icons/
│   ├── manifest.webmanifest
│   └── ...
│
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.example
├── README.md
├── PROJECT_SPEC.md
├── package.json
└── ...
```

---

# 36. Components

Core reusable components:

## Layout
- AppShell
- Sidebar
- MobileNav
- Header
- PageContainer

## Nutrition
- CalorieRing
- MacroSummary
- MacroProgress
- NutritionCard
- NutrientRow
- DailySummary

## Logging
- FoodLogger
- CameraCapture
- BarcodeScanner
- FoodSearch
- VoiceLogger
- FoodResultCard
- FoodAnalysisCard
- ConfidenceBadge
- ClarificationCard
- PortionEditor
- MealSelector

## AI
- AIInsightCard
- AIRecommendation
- AIThinkingState
- AIChat/GuidancePanel

## Progress
- WeightChart
- CalorieTrendChart
- MacroTrendChart
- GoalProgress

## Recipes
- RecipeCard
- RecipeEditor
- IngredientEditor
- RecipeNutrition

---

# 37. User Flows

## Flow A — Signup

```text
Landing
 ↓
Sign Up
 ↓
Email verification
 ↓
Onboarding
 ↓
Goal calculation
 ↓
Dashboard
```

## Flow B — Photo logging

```text
Dashboard
 ↓
Log Food
 ↓
Camera
 ↓
Capture
 ↓
AI analysis
 ↓
Candidate foods
 ↓
Smart clarification if required
 ↓
User review
 ↓
Confirm
 ↓
Daily totals update
 ↓
AI insight
```

## Flow C — Barcode

```text
Log
 ↓
Barcode
 ↓
Scan
 ↓
Internal DB
 ↓
External fallback
 ↓
Product
 ↓
Serving size
 ↓
Confirm
```

## Flow D — Manual search

```text
Log
 ↓
Search
 ↓
Recent/frequent foods
 ↓
Food result
 ↓
Quantity
 ↓
Meal
 ↓
Confirm
```

## Flow E — AI dinner recommendation

```text
Dashboard
 ↓
AI recommendation
 ↓
Current nutrition state
 ↓
Remaining target
 ↓
Candidate meals
 ↓
User selects
 ↓
Optional recipe/details
```

## Flow F — Weight tracking

```text
Progress
 ↓
Add weight
 ↓
Save
 ↓
Trend calculation
 ↓
Updated progress
```

---

# 38. Edge Cases

Must handle:

## Food
- unknown food
- duplicate foods
- ambiguous foods
- restaurant food
- mixed dishes
- custom foods
- missing nutrition fields
- invalid quantities
- zero/negative quantity

## AI
- no food detected
- multiple foods
- low confidence
- hallucinated food
- API timeout
- provider unavailable
- malformed AI response
- user rejects every result

## Barcode
- invalid barcode
- unsupported format
- product missing
- product exists but nutrition incomplete
- camera denied
- camera unavailable
- duplicate scan

## Account
- email already exists
- expired verification link
- expired password reset
- session expiration
- deleted account
- concurrent sessions

## Network
- offline
- reconnect
- queued logs
- duplicate sync
- sync conflict

## Time
- timezone changes
- daylight saving time
- midnight crossing
- travel

## Nutrition
- unit conversion
- recipe serving changes
- historical nutrition snapshots
- incomplete micronutrients

---

# 39. MVP Scope

## MUST HAVE

### Authentication
- signup
- login
- logout
- password reset
- protected app

### Onboarding
- profile
- goal
- calorie target
- macro target

### Dashboard
- daily calories
- protein
- carbs
- fat
- meals
- quick logging

### Food logging
- manual search
- photo AI analysis
- barcode scanning
- quantity
- meal assignment

### Database
- user
- profile
- goals
- foods
- logs
- meals
- weight

### AI
- photo food identification
- portion estimation
- confidence
- smart clarification
- basic nutrition guidance

### Progress
- weight entries
- weight chart
- calorie/macros history

### PWA
- installable
- responsive
- offline shell
- basic offline queue

### Security
- RLS
- server-side authorization
- secure uploads
- environment secrets

---

# 40. Future Features

Do NOT build these unless MVP is stable.

## Phase 2
- personal food model
- recipes
- saved meals
- weekly AI report
- adaptive calorie targets
- voice logging
- restaurant menu scanner
- grocery scanner

## Phase 3
- budget nutrition
- nutrition per ₹
- meal planning
- advanced micronutrients
- Apple/Google health integrations
- wearable data
- multilingual voice
- regional food models

## Phase 4
- dietitian dashboard
- coach accounts
- family accounts
- advanced AI agent
- predictive nutrition
- personalized grocery planning
- B2B wellness

---

# 41. Acceptance Criteria

The MVP is complete only when all of the following are true.

## Authentication
- [ ] New user can register.
- [ ] Verification works.
- [ ] User can log in.
- [ ] User can log out.
- [ ] Password reset works.
- [ ] Protected routes reject unauthenticated users.

## Onboarding
- [ ] New users complete onboarding.
- [ ] Profile is persisted.
- [ ] Goal is persisted.
- [ ] Targets are calculated deterministically.
- [ ] User can edit targets/profile.

## Dashboard
- [ ] Daily totals are correct.
- [ ] User sees remaining calories.
- [ ] Macro totals are correct.
- [ ] Meals display correctly.
- [ ] Timezone is respected.

## Manual logging
- [ ] User can search food.
- [ ] User can select quantity.
- [ ] User can select meal.
- [ ] User can save.
- [ ] Daily totals update immediately.

## Photo AI
- [ ] User can capture/upload image.
- [ ] AI returns structured candidates.
- [ ] Confidence is shown.
- [ ] User can edit candidates.
- [ ] Clarification is shown when needed.
- [ ] Confirming creates logs.
- [ ] AI failure has a manual fallback.

## Barcode
- [ ] Camera permission is handled.
- [ ] Barcode can be detected.
- [ ] Product lookup works.
- [ ] Unknown products have a graceful fallback.
- [ ] Manual barcode entry exists.

## Progress
- [ ] Weight can be recorded.
- [ ] Chart renders.
- [ ] History persists.
- [ ] Trend uses correct date/time handling.

## PWA
- [ ] Manifest exists.
- [ ] App is installable where supported.
- [ ] Icons are configured.
- [ ] Offline app shell works.
- [ ] Basic offline log queue works.

## Security
- [ ] RLS protects user data.
- [ ] Users cannot access another user's records.
- [ ] API keys are server-side only.
- [ ] Uploads are validated.
- [ ] Protected APIs authenticate requests.

## Quality
- [ ] No major console errors.
- [ ] No broken navigation.
- [ ] Mobile layout works.
- [ ] Desktop layout works.
- [ ] Keyboard navigation works.
- [ ] Loading/error/empty states exist.
- [ ] Basic unit/integration/E2E tests pass.

---

# 42. Development Instructions

## Critical instruction

Do not treat this document as a suggestion list.

Treat it as the product contract.

If a requirement is marked MVP/MUST HAVE, implement it.

If a feature is marked future, do not build it unless required to support MVP architecture.

## Development order

### Phase 0 — Planning
1. Read this entire specification.
2. Inspect repository.
3. Identify missing configuration.
4. Create implementation plan.
5. Do not start with random UI screens.

### Phase 1 — Foundation
1. Initialize Next.js/TypeScript.
2. Configure Tailwind.
3. Configure component system.
4. Configure linting/formatting.
5. Configure environment variables.
6. Configure Supabase.
7. Configure auth.
8. Configure database migrations.
9. Configure RLS.
10. Create application shell.

### Phase 2 — Data
1. Create database schema.
2. Add indexes.
3. Create seed data.
4. Create food repository layer.
5. Add food search.
6. Add nutrition calculation service.

### Phase 3 — Core product
1. Onboarding.
2. Dashboard.
3. Manual logging.
4. Meal grouping.
5. Progress tracking.

### Phase 4 — AI
1. AI gateway.
2. Structured schemas.
3. Image upload.
4. Photo analysis.
5. Confidence.
6. Smart clarification.
7. Nutrition guidance.

### Phase 5 — Barcode
1. Camera scanner.
2. Barcode normalization.
3. Internal lookup.
4. External fallback.
5. Product result UI.

### Phase 6 — PWA
1. Manifest.
2. Service worker.
3. Caching.
4. IndexedDB.
5. Offline queue.
6. Sync.

### Phase 7 — Quality
1. Unit tests.
2. Integration tests.
3. E2E tests.
4. Accessibility audit.
5. Security review.
6. Performance audit.
7. Mobile testing.
8. Desktop testing.

## Coding standards

- TypeScript strict mode.
- Avoid `any`.
- Small composable components.
- Server-side validation.
- Typed API contracts.
- No duplicated business logic.
- No hard-coded secrets.
- No magic numbers without named constants.
- No direct database access scattered through UI components.
- No vendor-specific AI calls outside the AI gateway.
- No direct external food API calls scattered through components.

## Business logic separation

Keep:

```text
UI
 ↓
Hooks / query layer
 ↓
API / server action
 ↓
Service
 ↓
Repository
 ↓
Database / external provider
```

AI:

```text
UI
 ↓
AI API
 ↓
AI Gateway
 ↓
Provider
 ↓
Structured response
 ↓
Validation
 ↓
Nutrition engine
```

## Deterministic vs AI logic

Use deterministic code for:
- arithmetic
- nutrition calculations
- calorie totals
- macro totals
- unit conversions
- target calculations
- authorization
- database operations

Use AI for:
- image understanding
- natural-language parsing
- ambiguous food identification
- recipe interpretation
- explanations
- personalized recommendation generation

Never delegate deterministic nutrition arithmetic to an LLM.

## Database migrations

Every schema change must be a migration.

Never rely on manually edited production tables.

## Environment

Provide `.env.example` with placeholders for:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

AI_PROVIDER=
AI_API_KEY=

FOOD_API_KEY=
```

Only variables that are actually required should be included.

## README

The generated project must contain a complete README covering:
- prerequisites
- installation
- environment setup
- Supabase setup
- database migration
- seed process
- local development
- testing
- production build
- deployment
- PWA requirements
- AI provider configuration

## Do not fake integrations

If an external service is not configured:
- provide a clear configuration error;
- use a development mock only when explicitly enabled;
- never silently return fake production nutrition values.

## Demo/mock mode

A clearly isolated development mode may provide:
- sample foods
- sample user
- deterministic mock AI response

Production must never accidentally run on mock data.

## Testing

At minimum test:

### Unit
- calorie calculation
- macro calculation
- unit conversion
- target calculation
- confidence handling

### Integration
- auth + profile
- food search
- logging
- daily totals
- RLS

### E2E
- signup → onboarding → dashboard
- manual food log
- photo analysis flow
- barcode flow
- progress flow

## Deployment

Recommended initial deployment:
- Vercel or equivalent Next.js platform
- Supabase
- object storage through Supabase Storage
- HTTPS
- environment secrets configured through deployment platform

Do not hard-code deployment provider assumptions into business logic.

---

# PRODUCT PRINCIPLES

These principles override superficial feature decisions.

## 1. Trust over fake precision

If uncertain, say so.

## 2. Fewer taps

Logging should become faster over time.

## 3. AI must be useful

Do not add a chatbot merely because the product is "AI-powered."

## 4. Recommendations must be grounded

AI recommendations must use actual user nutrition data.

## 5. User remains in control

AI proposes. User confirms meaningful changes.

## 6. Data provenance matters

Nutrition values should have a source/verification status.

## 7. Privacy matters

Food/body/health-related information is sensitive.

## 8. Build the intelligence layer first

The UI is replaceable. The nutrition/data architecture is the long-term asset.

---

# CORE USP SUMMARY

The product should communicate three major ideas:

### 1. TRUSTWORTHY AI

> AI that shows uncertainty instead of inventing precision.

### 2. PERSONAL FOOD MEMORY

> The more you use it, the less you have to log.

### 3. NEXT-MEAL INTELLIGENCE

> Don't just tell me what I ate. Tell me what I should eat next.

Secondary differentiation:

> **Adaptive targets + Indian/regional food intelligence + future nutrition-per-₹ planning.**

---

# BRAND / POSITIONING DIRECTION

Possible product positioning:

> **Know what you ate. Know what you need. Know what to eat next.**

Alternative:

> **Don't just count calories. Understand them.**

The product should be presented as:

> **An AI nutrition intelligence platform.**

Not:

> "Another calorie counter."

---

# RESEARCH & IMPLEMENTATION REFERENCES

The following references informed the technical choices in this specification and should be checked against current documentation before production implementation:

- Supabase Next.js Auth:
  https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Supabase SSR:
  https://supabase.com/docs/guides/auth/server-side
- Supabase database:
  https://supabase.com/docs/guides/database/overview
- Open Food Facts API:
  https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorial-off-api/
- Open Food Facts barcode guidance:
  https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/scanning-barcodes/
- USDA FoodData Central:
  https://fdc.nal.usda.gov/
- MDN PWA installability:
  https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- MDN BarcodeDetector:
  https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector

---

# FINAL IMPLEMENTATION DIRECTIVE

Build the smallest complete version of the product described here.

Do not create a fake frontend prototype with disconnected buttons.

The MVP must have:

**real authentication → real database → real user profiles → real food logs → real calculations → real AI integration boundary → real barcode integration boundary → real progress data → real PWA behavior → real security.**

At the same time, do not prematurely implement every future feature.

The final MVP should feel like a coherent, polished product rather than a collection of demos.

The most important user journey is:

```text
SIGN UP
 ↓
SET GOAL
 ↓
SEE TODAY'S TARGET
 ↓
LOG FOOD
 ↓
AI UNDERSTANDS IT
 ↓
USER CONFIRMS
 ↓
NUTRITION TOTALS UPDATE
 ↓
AI EXPLAINS WHAT MATTERS
 ↓
AI RECOMMENDS WHAT TO EAT NEXT
 ↓
USER RETURNS TOMORROW
```

That loop is the heart of the application.
