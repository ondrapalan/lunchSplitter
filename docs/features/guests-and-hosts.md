# Guests & hosts

A **guest** is someone who eats but doesn't have (or need) a login — usually visitors, contractors, or kids of team members. A **host** is the registered user who pays for a guest.

This model lets stats stay accurate without forcing every mouth-at-the-table to have an account.

## Data model

Two tables in `prisma/schema.prisma`:

```
Guest {
  id, name, aliases[]
  defaultHostUserId → User   // fallback host if not specified per order
}

OrderPerson {
  id, orderId, name, sortOrder
  userId    → User  |  null   // one of these is set
  guestId   → Guest |  null   // (never both)
  hostUserId → User |  null   // set iff guestId is set
}
```

A row with `guestId` set is a "guest row" — it appears in the order's people list but:
- Its `withFees` rolls up onto the host (see `calculateChargeableAmount`).
- It's excluded from every per-user leaderboard in `/stats` (the host gets credit in Hospitality instead).

## Creating a guest

Two paths:

### Inline during order editing
The creator picks "Add guest" on the order detail page. If they type a new name, the client submits `newGuest: { name, defaultHostUserId }` inside `saveOrder`, which — server-side — creates the `Guest` row in the same transaction and then inserts the `OrderPerson` referencing it. See the `resolvedPeople` loop in `src/actions/orders.ts → saveOrder`.

### Admin page
`/admin/guests` → `createGuest({ name, defaultHostUserId, aliases? })` in `src/actions/guests.ts`. Admin can also edit name/host/aliases and delete (only if the guest has zero order appearances).

## Host semantics

- `Guest.defaultHostUserId` is a **default**, not a constraint. The actual host per order is `OrderPerson.hostUserId`, so the same guest can have different hosts in different orders.
- The creator of an order picks the host via the guest-picker UI when they add the guest (defaults to the guest's default host).
- A guest must always have a host — `saveOrder` throws if `hostUserId` is missing on a guest row.

## Aliases

Both `User` and `Guest` carry an `aliases: string[]` column. Aliases are additional display/name variants the system uses for fuzzy-matching when historical data contains the person's name as plain text (e.g. legacy pre-account orders). Admins edit them on the respective admin pages.

## Legacy backfill

Orders imported from the pre-account era have `OrderPerson` rows with `userId = null` **and** `guestId = null` — just a free-text `name`. The backfill page cleans these up.

### `/admin/guests/backfill`

Server actions in `src/actions/guests.ts`:

| Function | What it does |
|---|---|
| `listLegacyGuestNames()` | Groups all `OrderPerson` rows with no user and no guest by their `name` string, returning `{ name, count, lastSeen }[]` sorted by count desc. These are the rows to backfill. |
| `backfillLegacyGuest({ legacyName, guestId, hostUserId })` | Bulk `updateMany` that sets `guestId` + `hostUserId` on every `OrderPerson` matching `name === legacyName` with nulls. Returns the updated count. Admin only. |

The UI is "pick a legacy name → pick an existing guest → pick a host → run backfill". After the update, those legacy rows behave like any other guest row: stats credit moves to the host, they appear under Hospitality, the guest shows up in Visitors.

## How guests surface in stats

- **Spending / Order Frequency / Fun Stats**: guest rows are **skipped** via `isGuestRow(person)` helper in `src/actions/stats.ts`. The host already pays for them.
- **Your Stats**: a user's `allTimeSpent` includes any guest's `withFees` where `hostUserId === user.id`. See `getPersonalStats`.
- **Hospitable Hosts**: one row per user, counting how many guest-lunches they've covered and total Kč. Uses `hostUserId`.
- **Visitors**: one row per `Guest`, with `visitCount` = closed-order appearances and `lastVisit`. Data comes from `Guest.orderPersons`, not the closed-orders cache.

## Invalidation

Any guest mutation calls `revalidateTag('guests:list')` and any user-visible order mutation also invalidates closed-order tags, so Visitors and Hospitality update without a manual refresh.

## Files

| Change | File |
|---|---|
| Guest CRUD | `src/actions/guests.ts` |
| Legacy backfill | `src/actions/guests.ts` + `src/app/(app)/admin/guests/backfill/page.tsx` |
| Admin list | `src/app/(app)/admin/guests/page.tsx` |
| Guest picker in order UI | `src/features/lunch/components/PeopleSection.tsx` and its pickers |
| Guest-row detection in stats | `isGuestRow()` in `src/actions/stats.ts` |
| Host rollup math | `calculateChargeableAmount` in `src/features/lunch/utils/calculations.ts` |

## Related docs

- [Orders & splitting](./orders-and-splitting.md) — full math + access
- [Stats](./stats.md) — how hosts/guests show up
- [Admin panel](./admin.md) — guest admin screens
