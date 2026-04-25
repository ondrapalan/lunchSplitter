# Caching & loading UX

Because the app runs on Neon's free tier (slow cold starts, latency-bound queries), every data path uses **two cache layers** plus **route-level skeletons** to keep the UI feeling snappy. This doc explains where each piece lives and how to extend it.

## The two layers

```
 ┌─────────────────┐     invalidate via       ┌──────────────────────┐
 │  React Query    │ ◄──── invalidateQueries ─│  useMutation in hook │
 │  (per browser)  │                          └──────────────────────┘
 └────────┬────────┘
          │ queryFn calls server action
          ▼
 ┌─────────────────┐     invalidate via       ┌──────────────────────┐
 │ unstable_cache  │ ◄──── revalidateTag ─────│  mutation server-side│
 │  (per region)   │                          └──────────────────────┘
 └────────┬────────┘
          │ on miss
          ▼
 ┌─────────────────┐
 │     Neon DB     │
 └─────────────────┘
```

- **`unstable_cache` (server)** — shared across all users in a region. Biggest win: a single DB scan serves everyone for the TTL window. Tagged so mutations can invalidate precisely.
- **React Query (client)** — per-browser, dedupes concurrent calls and gives instant renders on back-navigation. Default `staleTime` 60s, `gcTime` 5min, no refetch on window focus.

They compose: a cold visit costs one DB scan; repeat visits inside 60s hit `unstable_cache`; repeat renders inside the same session hit React Query and skip the network entirely.

## Server side: `src/lib/cache.ts`

Thin wrapper around `unstable_cache` plus a tag registry.

```ts
import { cached, ORDER_TAGS } from '~/lib/cache'

const listGuestsCached = cached(
  async () => prisma.guest.findMany({ ... }),
  ['guests-list'],
  { tags: [ORDER_TAGS.guests], revalidate: 300 },
)

export async function listGuests() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  return listGuestsCached()   // auth check OUTSIDE the cache
}
```

**Rules of thumb**
- Put `auth()` **outside** the cached function. `unstable_cache` captures no request context — calling `auth()` inside would either fail or cache per-request nonsense.
- Cache keys are primitive args. Don't pass objects or sessions in.
- Every cached read must be paired with a `revalidateTag(tag)` in its mutations. See `invalidateOrder()` in `src/actions/orders.ts` for the pattern.
- TTLs: 60s for order-scoped reads, 300s for rarely-changing lookups (users, guests, restaurant names, item history).

**Tag registry** (in `src/lib/cache.ts`):

| Tag | Invalidated by |
|---|---|
| `orders:open` | createOrder, per-item/per-person mutations, joinOrder/leaveOrder, closeOrder/closeOrderWithDraft |
| `orders:list` | closeOrder, closeOrderWithDraft, deleteOrder |
| `orders:closed` | closeOrder, closeOrderWithDraft, reopenOrder, deleteOrder |
| `orders:admin` | any order mutation |
| `order:<id>` | any mutation on that order |
| `items:restaurant:<name>`, `items:all` | saveMyItems |
| `users:registered`, `users:all` | deleteUser, updateUserAliases, setUserDiscordId |
| `guests:list` | createGuest, updateGuest, deleteGuest, backfillLegacyGuest |
| `restaurants:names` | createOrder |

## Client side: `src/lib/queries/`

One file per domain. Each exports query hooks and mutation hooks.

```ts
// src/lib/queries/orders.ts
export function useOpenOrders() {
  return useQuery({
    queryKey: qk.orders.open(),
    queryFn: () => listOpenOrders(),
  })
}

export function useCloseOrder() {
  const invalidate = useInvalidateOrders()
  return useMutation({
    mutationFn: ({ orderId, sendDiscord }) => closeOrder(orderId, { sendDiscord }),
    onSuccess: (_d, { orderId }) => invalidate(orderId),
  })
}
```

**Query keys** live in `src/lib/queries/keys.ts`. Never hand-roll a key in a component — use `qk.*` so invalidation stays consistent.

**In components**: read with a hook, render inline skeletons while pending.

```tsx
const { data = [], isPending } = useOpenOrders()
if (isPending) return <SkeletonCard />
return <List items={data} />
```

Don't combine React Query with a local `useState` mirror — let React Query be the source of truth.

## The stats bundle

`/stats` used to fire 6 independent server actions, each re-scanning closed orders. Now there's a single server action:

```ts
// src/actions/stats.ts
export async function getStatsBundle(period: StatPeriod): Promise<StatsBundle>
```

It calls every aggregation in `Promise.all`. Because each aggregation goes through a cached `fetchClosedOrders(period)` / `fetchSekackaOrders(period)` / `getVisitorsCached()`, the underlying DB scans are deduped automatically.

Client side, each card selects its slice:

```tsx
const { data: spending } = useStatsBundle(period, b => b.spending)
const { data: personal } = useStatsBundle('month', b => b.personal)
```

React Query shares the bundle across components that use the same `period`. Default load of `/stats`: 2 bundles (`month` + `all`) → 2 RPC calls → ~1 DB scan per distinct period thanks to `unstable_cache`.

## Loading states

All primitives are in `src/features/ui/components/Skeleton.tsx`:

- `<Skeleton $width $height $radius />` — the base rectangle with a pulse animation
- `<SkeletonText lines />` — stack of lines
- `<SkeletonCard lines showTitle />` — shaped like `<Card>`
- `<SkeletonTable rows showHeader />` — for leaderboards
- `<SkeletonTitle />` — page heading placeholder

Route-level `loading.tsx` files exist for every data-heavy page (`/orders`, `/stats`, `/settings`, `/orders/new`, all `/admin/*`). App Router renders them automatically during navigation transitions — no user wiring needed.

Inside a page, prefer **inline skeletons** over a blocking spinner so that partial data renders as it arrives. React Query makes this natural:

```tsx
const { data, isPending } = useStatsBundle(period, b => b.spending)
// isPending = no data yet; show skeleton
// data + isFetching = stale data from cache, refreshing in background
```

## Adding a new cached read

1. In the relevant `src/actions/*.ts`, write a `cached()` helper with a unique key-parts array and the right tags.
2. Export a public server action that calls `auth()`, then the cached helper.
3. Add a tag to `ORDER_TAGS` in `src/lib/cache.ts` if it doesn't fit an existing one.
4. Add `revalidateTag(...)` to every mutation that affects this data.
5. Add a React Query hook in `src/lib/queries/<domain>.ts`.
6. Add a key in `src/lib/queries/keys.ts`.
7. Call the hook from components; add a skeleton for the pending state.

## Troubleshooting

- **Mutation runs but UI doesn't refresh** → your mutation hook isn't calling `invalidateQueries` (or it's invalidating the wrong key). Check the `onSuccess` in `src/lib/queries/<domain>.ts`.
- **Different user sees another user's data** → a user-scoped query was cached without the user ID in its `keyParts`. For user-filtered reads, don't use `unstable_cache` — rely on React Query alone, which is per-browser.
- **Cache never seems to hit** → `unstable_cache` requires stable `keyParts`. Make sure you're not serializing something that changes each call (e.g. a `new Date()`).
