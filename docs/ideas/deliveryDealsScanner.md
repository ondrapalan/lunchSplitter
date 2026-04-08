# Delivery Deals Scanner — Implementation Plan

## Context

The lunch splitter team uses Foodora, Wolt, and Bolt Food for deliveries but has no way to compare daily deals across services. Since none of these services offer public APIs, we'll build a Playwright-based scraping system that extracts deals and displays them in the app. The scraper runs as standalone Node.js scripts for speed, but is executed through Claude Code so Claude can step in with interactive playwright-cli when selectors break or CAPTCHAs appear.

---

## Architecture

```
[Local machine]                        [Vercel]
┌─────────────────────┐     POST       ┌──────────────────┐
│ npm run deals:scrape │ ──────────►   │ /api/deals/import│
│ (Playwright scripts) │  (Bearer      │ (Zod + secret)   │
│                      │   secret)     └────────┬─────────┘
│ Claude monitors &    │                        │
│ fixes via            │                        ▼
│ playwright-cli       │               ┌──────────────────┐
└─────────────────────┘               │ PostgreSQL       │
                                       │ DeliveryDeal     │
                                       └────────┬─────────┘
                                                │
                                       ┌────────▼─────────┐
                                       │ /deals page      │
                                       │ (all users see)  │
                                       └──────────────────┘
```

---

## Implementation Sequence

### Step 1: Prisma Schema — `DeliveryDeal` model

**Modify**: `prisma/schema.prisma`

Add `DeliveryService` enum (`FOODORA`, `WOLT`, `BOLT_FOOD`) and `DeliveryDeal` model with fields:

- `id`, `service`, `title`, `description?`, `restaurantName?`
- `discountPercent?`, `discountText?` (free-form like "1+1", "Free delivery")
- `originalPrice?`, `dealPrice?`, `imageUrl?`, `dealUrl?`
- `validFrom?`, `validUntil?`, `scrapedAt`, `scrapedBy`, `batchId`

Run migration: `npx prisma migrate dev --name add-delivery-deals`

### Step 2: API Route — Deal Import Endpoint

**Create**: `src/app/api/deals/import/route.ts`

- POST endpoint, authenticated via `Authorization: Bearer <DEALS_IMPORT_SECRET>`
- Validates body with Zod schema (add to `src/lib/validations.ts`)
- On import: deletes today's existing deals for that service, inserts new batch
- Middleware already excludes `/api` routes (confirmed in `src/middleware.ts:48`)
- Add `DEALS_IMPORT_SECRET` to `.env` and Vercel env vars

### Step 3: Server Actions — Read Deals

**Create**: `src/actions/deals.ts`

Following existing pattern from `src/actions/orders.ts`:

- `listDeals()` — returns today's deals grouped by service
- `getDealsLastUpdated()` — most recent `scrapedAt` per service

### Step 4: Frontend Types

**Create**: `src/features/deals/types.ts`

- `DeliveryServiceType` — `'FOODORA' | 'WOLT' | 'BOLT_FOOD'`
- `DealItem` — frontend representation of a deal
- `ServiceDeals` — grouped deals with `lastUpdated`

### Step 5: Deals Page & Components

**Create**: `src/app/(app)/deals/page.tsx`

Page structure following `src/app/(app)/orders/page.tsx` pattern:

- Groups deals by service with `SectionTitle`
- Each deal rendered as a `DealCard` (Card-based, matching existing UI patterns)
- Service color coding: Foodora=red, Wolt=blue, Bolt=green (maps to theme colors)
- Shows "Last updated X ago" per service
- Empty state when no deals scraped yet

**Create**: `src/features/deals/components/DealCard.tsx`

- Restaurant name, deal title/description
- Discount badge (styled like StatusBadge)
- Price comparison (original → deal price)
- Link to open deal URL

### Step 6: Navigation Update

**Modify**: `src/app/(app)/layout.tsx`

Add "Deals" NavLink between "All Orders" and "Invite" (line ~136), using a price-tag icon SVG.

### Step 7: Scraping Scripts

**Create**: `scripts/deals/` directory:

```
scripts/deals/
  scrape.ts              — Main entry: reads creds, runs scrapers, posts results
  scrapers/
    foodora.ts           — Foodora.cz scraper
    wolt.ts              — Wolt.com scraper
    bolt.ts              — Bolt Food scraper
    types.ts             — ScrapedDeal interface
  lib/
    credentials.ts       — Reads .delivery-credentials.json
    api.ts               — Posts results to /api/deals/import
```

**Credential file**: `.delivery-credentials.json` (gitignored) with per-service email/password + app import URL and secret.

**Add to `.gitignore`**: `.delivery-credentials.json`

**Add to `package.json`**: `"deals:scrape": "npx tsx scripts/deals/scrape.ts"`

**Script design**:

- Uses Playwright Node.js library (`playwright` package) with `headless: false`
- Each scraper navigates to deals/offers page, extracts structured data
- On CAPTCHA: logs message to console, waits for user to solve in visible browser
- On completion: POSTs JSON to `/api/deals/import`
- Exit codes indicate success/failure per service so Claude knows what broke

**Claude integration**: When run via Claude Code (`npm run deals:scrape`), Claude monitors output. If a scraper fails (selector changed, login flow changed), Claude can:

1. Open the problematic site with `playwright-cli`
2. Take a snapshot to see current DOM structure
3. Update the scraper script with corrected selectors
4. Re-run

### Step 8: Configuration

- Add `DEALS_IMPORT_SECRET` to `.env`
- Add `DEALS_IMPORT_SECRET` to Vercel environment variables
- Add `.delivery-credentials.json` to `.gitignore`
- Install `playwright` as a dev dependency (for scraping scripts)

### Step 9: Smart Recommendations — Deal Matching Based on Order History

Analyze the team's ordering patterns and cross-reference with today's scraped deals to surface personalized recommendations.

**Data available for analysis** (all in existing Prisma schema):
- `Order.restaurantId` + `Order.createdAt` → restaurant frequency + day-of-week patterns
- `OrderPerson.userId` + `OrderPerson.orderId` → who orders together, who prefers what
- `OrderItem.name` + `OrderItem.price` → item popularity per restaurant
- `Restaurant.name` → maps to `DeliveryDeal.restaurantName` for matching

**Create**: `src/actions/recommendations.ts`

Server action `getRecommendedDeals()` that:
1. Queries the current user's order history (restaurants they've participated in, via `OrderPerson → Order → Restaurant`)
2. Ranks restaurants by frequency (weighted: recent orders count more)
3. Extracts day-of-week patterns (e.g., "this group orders Thai on Wednesdays")
4. Cross-references ranked restaurants with today's `DeliveryDeal` entries (fuzzy match on `restaurantName`)
5. Returns scored recommendations: `{ deal: DealItem, matchReason: string, score: number }[]`

**Match reasons** (shown as tags on the deal card):
- "Your team's #2 favourite" — restaurant frequency
- "You usually order here on Wednesdays" — day-of-week match
- "3 of your colleagues ordered here this week" — group popularity
- "Great deal at a favourite spot" — high discount + high frequency

**Integration into Deals page** (`src/app/(app)/deals/page.tsx`):
- Add a "Recommended for You" section at the top of the Deals page (above the per-service sections)
- Only shown when there are matches between order history and today's deals
- Each recommended deal shows the `matchReason` as a subtle tag
- Falls back to "Top deals today" (sorted by discount %) when no history matches

**Reuse existing**:
- `getItemsByRestaurant()` in `src/actions/orders.ts:9` — already does item history per restaurant
- `getRestaurantNames()` in `src/actions/orders.ts` — already lists all known restaurants

### Step 10: Wheel of Fortune — Restaurant Spinner

A fun, interactive spinner to help the indecisive team pick where to order. Populated with favourite restaurants and boosted by today's deals.

**Create**: `src/features/deals/components/WheelOfFortune.tsx`

**Wheel segments** populated from:
1. Team's top N restaurants (from order history frequency)
2. Restaurants with active deals today (from `DeliveryDeal`)
3. Segment size weighted by: `(order_frequency × 1) + (has_deal_today × 2) + (discount_percent × 0.5)`
   - Frequently ordered restaurants get fair representation
   - Restaurants with good deals get a boost (larger slice)

**UI design**:
- Circular wheel built with CSS `conic-gradient` segments (no canvas/library needed)
- Each segment colored distinctly (cycle through theme-friendly palette)
- Restaurant name displayed on each segment
- Deals badge on segments that have active promotions
- "Spin!" button triggers CSS `transform: rotate()` animation with easing
- Random target angle with `transition: transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)`
- Arrow/pointer indicator at the top of the wheel
- Result overlay after spin: shows winning restaurant + its deals if any + "Order from here!" / "Spin again" buttons

**Placement**: On the Deals page as a prominent card/section:
- Collapsed by default with a fun "Can't decide? Spin the wheel!" button
- Expands to show the wheel when clicked
- Mobile-responsive: wheel scales down, maintains tap target for spin button

**Create**: `src/features/deals/components/SpinResult.tsx`
- Shows after the wheel stops
- Winning restaurant name prominently displayed
- If the restaurant has today's deals: show them inline
- "Start a new order" button → navigates to `/orders/new` with restaurant pre-filled
- "Spin again" button

**Server action** addition to `src/actions/recommendations.ts`:
- `getWheelSegments()` — returns `{ restaurantName: string, weight: number, deals: DealItem[], orderCount: number }[]`
- Combines restaurant frequency data with today's deals
- Limits to ~8-12 segments for readability

**Pre-filling restaurant on new order**: Modify `/orders/new` to accept an optional `?restaurant=` query param that pre-selects the restaurant name in the form.

---

## Files Summary

| Action | File                                                          |
| ------ | ------------------------------------------------------------- |
| Modify | `prisma/schema.prisma`                                        |
| Modify | `src/lib/validations.ts`                                      |
| Modify | `src/app/(app)/layout.tsx` (add nav button, ~line 136)        |
| Modify | `src/app/(app)/orders/new/page.tsx` (accept `?restaurant=` query param) |
| Modify | `.gitignore`                                                  |
| Modify | `package.json` (script + playwright dep)                      |
| Create | `src/app/api/deals/import/route.ts`                           |
| Create | `src/actions/deals.ts`                                        |
| Create | `src/actions/recommendations.ts`                              |
| Create | `src/features/deals/types.ts`                                 |
| Create | `src/features/deals/components/DealCard.tsx`                  |
| Create | `src/features/deals/components/WheelOfFortune.tsx`            |
| Create | `src/features/deals/components/SpinResult.tsx`                |
| Create | `src/app/(app)/deals/page.tsx`                                |
| Create | `scripts/deals/scrape.ts`                                     |
| Create | `scripts/deals/scrapers/foodora.ts`                           |
| Create | `scripts/deals/scrapers/wolt.ts`                              |
| Create | `scripts/deals/scrapers/bolt.ts`                              |
| Create | `scripts/deals/scrapers/types.ts`                             |
| Create | `scripts/deals/lib/credentials.ts`                            |
| Create | `scripts/deals/lib/api.ts`                                    |

---

## Verification

1. **Schema**: Run `npx prisma migrate dev` — migration succeeds
2. **API route**: `curl -X POST https://lunch-splitter-black.vercel.app/api/deals/import -H "Authorization: Bearer <secret>" -H "Content-Type: application/json" -d '{"service":"FOODORA","scrapedBy":"test","deals":[{"title":"Test deal","discountText":"50% off"}]}'` — returns 200
3. **Deals page**: Navigate to `/deals` — shows the test deal
4. **Recommendations**: With existing order history + imported deals, "Recommended for You" section appears with matched deals and reason tags
5. **Wheel of Fortune**: Click "Can't decide?" → wheel renders with segments sized by frequency + deals → spin → result shows restaurant + deals + "Start order" button
6. **Pre-fill flow**: Clicking "Start a new order" from spin result navigates to `/orders/new?restaurant=RestaurantName` with the field pre-filled
7. **Scraper**: Run `npm run deals:scrape` with valid credentials — deals appear in app
8. **Claude fallback**: Break a selector intentionally, run scrape, let Claude fix it via playwright-cli
