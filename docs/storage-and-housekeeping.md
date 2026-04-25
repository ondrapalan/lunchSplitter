# Storage & housekeeping

How we keep the database small enough to live on Neon's free tier (500 MB) without a scheduler.

## The Neon free-tier reality

Neon's storage gauge counts more than just your row data. The largest contributors on a small project are usually:

1. **Point-in-time history retention** — Neon keeps a configurable history window so you can branch/restore. Default is 24h. For a tiny DB the history can dwarf the live data. Configurable in the Neon console under project Settings → "History retention". **For this project we keep it at 0h** — we don't use branching or PITR.
2. **Dead tuples + system catalogs** — every `prisma db push` leaves dead rows in `pg_catalog`. Postgres' autovacuum reclaims this lazily. Don't run `VACUUM FULL` on Neon: a full rewrite can briefly *increase* storage and exclusive-locks tables. Trust autovacuum.
3. **Branches** — every Neon branch carries its own storage. Confirm only `main` exists in the console.
4. **Actual app data** — at our scale (handful of users, a few orders per week), this is by far the smallest of the four.

Bottom line: the largest single storage win was free — turning history retention off. The housekeeping helper described below caps long-term growth from accumulating audit/cleanup-eligible rows.

## The housekeeping helper

`src/lib/housekeeping.ts` exports a single function:

```ts
export async function runHousekeeping(): Promise<void>
```

It's **fire-and-forget** — callers `void runHousekeeping()` without `await`-ing. It never throws (errors are logged, not surfaced).

### What it deletes

In a single Prisma `$transaction`:

| Table | Condition |
|---|---|
| `OrderActivityLog` | `createdAt < now - 365 days` |
| `AccessRequest` | `status IN ('approved', 'denied')` AND `createdAt < now - 90 days` |
| `PendingDiscordLink` | `resolvedAt IS NOT NULL` AND `resolvedAt < now - 90 days` |
| `Invitation` | `usedAt IS NULL` AND `expiresAt < now - 30 days` |

Pending access requests, unresolved Discord links, and used invitations are **never deleted** — they remain auditable forever.

### How throttling works

Two layers:

1. **DB-side, 24h:** a single-row `Housekeeping` model holds `lastRunAt`. If the marker is younger than 24h, the function returns immediately.
2. **Process-side, in-flight dedup:** a module-level `inFlight: Promise | null` ensures concurrent calls in the same Node process share one execution.

Net effect: cleanup runs roughly once per day across the deployment regardless of traffic.

### Where it fires

Three low-frequency call sites; the throttle handles dedup:

| Call site | When it fires |
|---|---|
| `src/lib/auth.ts` — `jwt` callback when a `user` is present | Once per successful login (~once per 8h session) |
| `src/actions/orders.ts` — top of `listOpenOrders` | Each home-dashboard load |
| `src/actions/invitations.ts` — `createInvitation` | Each time an admin mints an invite |

This is the same pattern the original code used inline in `createInvitation`. The housekeeping helper just generalizes it and adds throttling so it can ride along on more call sites without thrash.

## Tunables

All TTLs are constants at the top of `src/lib/housekeeping.ts`:

```ts
const THROTTLE_MS = 24 * 60 * 60 * 1000
const ACTIVITY_LOG_MAX_AGE_DAYS = 365
const ACCESS_REQUEST_MAX_AGE_DAYS = 90
const PENDING_LINK_MAX_AGE_DAYS = 90
const INVITATION_MAX_AGE_DAYS = 30
```

Lower them if storage starts to climb; raise them if you need a longer audit trail.

## Why no Vercel Cron?

The project runs on the Vercel Hobby tier, which doesn't include scheduled functions for our needs. Opportunistic cleanup riding on normal request traffic costs nothing and works as long as the app is opened roughly daily — a safe bet for a tool the office uses for lunch.

If usage ever drops to "less than once a week" and storage starts piling up, the fallback is a free external pinger (e.g. cron-job.org) hitting an auth-protected `/api/housekeeping` endpoint. Not built today.

## Manually forcing a run (sandbox)

To verify or test:

```bash
npx prisma studio  # then open the Housekeeping table
```

Edit `lastRunAt` to 25 hours in the past, reload the home page in the app, and the next request will trigger a real cleanup. Check the table again to confirm `lastRunAt` updated.

## When to extend this

Add a new TTL if you introduce a table that:

- Logs events or audit data without natural expiry
- Stores user-submitted content that goes stale (drafts, pending-review items)
- Holds Discord/external integration scratch state that becomes irrelevant after resolution

Do **not** add a TTL for:

- Domain data (`Order`, `OrderItem`, `User`, `Restaurant`, etc.) — losing those silently would be a bug, not a feature
- Anything the user might want to look back at via `/stats`

## Files

| Concern | File |
|---|---|
| Helper + TTL constants | `src/lib/housekeeping.ts` |
| Schema marker model | `prisma/schema.prisma` (`Housekeeping`) |
| Login call site | `src/lib/auth.ts` |
| Dashboard call site | `src/actions/orders.ts` (`listOpenOrders`) |
| Invitation call site | `src/actions/invitations.ts` (`createInvitation`) |

## Related docs

- [Architecture](./architecture.md) — full data model
- [Auth & access](./features/auth-and-access.md) — invitation + access-request lifecycle
- [Discord integration](./features/discord-integration.md) — pending-link lifecycle
