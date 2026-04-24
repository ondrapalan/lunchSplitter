# Stats

`/stats` shows six cards aggregated from closed orders. Every card reads from one shared server action — `getStatsBundle(period)` — which runs all aggregations against a cached order fetch.

## Page structure

`src/app/(app)/stats/page.tsx` renders six components. Each one picks its own period (week/month/year/all) and reads its slice via the shared hook:

```tsx
const { data: spending } = useStatsBundle(period, b => b.spending)
```

See `src/lib/queries/stats.ts` for the hook. Period selection is local per card — components don't share a period.

## The bundle

`src/actions/stats.ts → getStatsBundle(period)` returns:

```ts
StatsBundle = {
  spending:     SpendingEntry[]
  frequency:    SpendingEntry[]
  hospitality:  HospitalityEntry[]
  sekacka:      SekackaStatsData
  personal:     PersonalStats           // always all-time
  fun:          FunStat[]               // always all-time
  visitors:     VisitorEntry[]          // always all-time
}
```

The bundle's period only constrains the first four. The last three ignore it (personal/fun/visitors are all-time by design). That means any component reading a non-period-scoped slice can pass any period — sharing cache with siblings that already fetched that bundle.

Underneath, the bundle just `Promise.all`s the existing per-card server actions; because those share `fetchClosedOrders(period)` / `fetchSekackaOrders(period)` / `getVisitorsCached()` and all three are wrapped in `unstable_cache`, concurrent aggregations dedupe DB scans automatically. See [`caching-and-loading.md`](../caching-and-loading.md).

## Cards

### Your Stats (`PersonalPrediction`)
Always all-time.

| Field | Formula |
|---|---|
| `weekSpent`/`monthSpent`/`yearSpent`/`allTimeSpent` | Sum of `withFees` for the current user's `OrderPerson`, plus any guest's `withFees` the user hosted in that order. |
| `totalOrders` | Count of closed orders the user participated in. |
| `avgPerOrder` | `allTimeSpent / totalOrders`. |
| `ordersPerMonth` | `totalOrders / monthsSince(firstOrder)`. |
| `projectedYearly` | `yearSpent / daysSinceJan1 * 365` — straight-line extrapolation. |

### Spending Leaderboard (`SpendingLeaderboard`)
Period-aware. Sum of `withFees` per user (excluding guest rows — those belong to the host's total). Sorted descending by `totalSpent`. Packaging items are included since they're still a chargeable cost.

### Order Frequency (`OrderFrequency`)
Same aggregation as the leaderboard, re-sorted by `orderCount`. Rendered as a bar chart.

### Fun Stats (`FunStats`)
All-time. A mix of "achievements" — each is only shown if it has enough data:

| Title | What it finds | Threshold |
|---|---|---|
| The Regular | Same `(item, restaurant)` most often | ≥ 3 |
| The Explorer | Most unique items across orders | ≥ 5 total items |
| The Sharer | Most `sharedWith` links on own items | ≥ 2 |
| Biggest Single Order | Highest single `withFees` | — |
| Lunch Regular | Most order participations | ≥ 2 |
| The Bargain Hunter | Lowest average item price | ≥ 3 items |
| The Gourmet | Highest average item price | ≥ 3 items (skipped if same person as Bargain Hunter) |
| Favourite Spot | Most-used restaurant | ≥ 2 |
| The Loyalist | Most orders at one restaurant | ≥ 3 |
| The Feast | Most food items in one order | ≥ 3 |
| The Organizer | Created the most orders | ≥ 2 |
| Fan Favourite | Single most-ordered item name | ≥ 3 |
| The Host | Hosted the most guest-lunches | — |

`isPackaging` items are excluded from every fun-stat aggregation. Guests never appear (their host gets the credit).

### Hospitality (`VisitorsSection → Hospitable Hosts`)
Period-aware, scoped to the period selected in `VisitorsSection` (currently hard-coded to `'all'`).

| Field | Formula |
|---|---|
| `guestLunchCount` | How many guest-lunches this host has paid for. |
| `distinctGuestCount` | How many unique `Guest` IDs they've hosted. |
| `totalCovered` | Sum of `withFees` of all guest rows where `hostUserId === user.id`. |

### Visitors (`VisitorsSection → Visitors`)
All-time list of guests, with `visitCount` (closed-order appearances only) and `lastVisit` (latest `Order.createdAt`). Data source: `Guest.orderPersons.order`, not via `fetchClosedOrders`.

### Sekačka (`SekackaStats`)
Period-aware, same period selector as Spending. Uses a separate cached fetch `fetchSekackaOrders(period)` because the required `include` shape differs.

| Field | Meaning |
|---|---|
| `summary.totalCount` | Closed Sekačka orders in period. |
| `summary.totalSpent` | Sum of all items across those orders. |
| `summary.avgParticipants` | `totalParticipants / totalCount`. |
| `summary.avgPerPortion` | `totalSpent / totalParticipants`. |
| `topEaters` | Each participant counts 1 portion per order + their equal share of the cost. Sorted by count, then totalKc. |
| `topProviders` | Per creator: how many sekačkas they hosted and total Kč they brought. |
| `items` | Item-name breakdown (lowercased+trimmed). |

## Caching & freshness

- Server: `fetchClosedOrders`, `fetchSekackaOrders`, and the `getVisitorsCached` helper are tagged `orders:closed` / `guests` and auto-invalidated when orders or guests change. TTL 60s.
- Client: `useStatsBundle(period)` follows the global React Query defaults — `staleTime 60s`, refetch on invalidation from any order/guest/user mutation.

## Extending stats

To add a new card:
1. Write the aggregation in `src/actions/stats.ts`, using `fetchClosedOrders(period)` so it shares the cache.
2. Add the slice to `StatsBundle` and to `getStatsBundle`.
3. Build the component under `src/features/stats/components/` and read via `useStatsBundle(period, b => b.yourSlice)`.
4. Mount it in `src/app/(app)/stats/page.tsx`.

Don't add new server actions that bypass the bundle — it will re-run aggregations that a bundle read already did (even cached, that's wasted RPC latency).
