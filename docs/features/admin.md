# Admin panel

Everything at `/admin/*` requires `role === 'ADMIN'`. The middleware blocks non-admins at the edge; every server action double-checks with `session.user.role !== 'ADMIN' → throw`.

## Pages

### `/admin/users` — Users

`src/app/(app)/admin/users/page.tsx`. Lists every user with `username`, `displayName`, role, bank-account + Discord link status, and alias tags.

**Actions:**

| Action | Server function | Notes |
|---|---|---|
| Create user | `createUser({ username, displayName, discordId?, role })` (`src/actions/auth.ts`) | Generates a temp password, sets `isFirstLogin: true`. Validates Discord ID (17–20 digits) and rejects duplicates. Displays the temp password to copy. |
| Reset password | `resetUserPassword(userId)` | Generates a new temp password and re-flags `isFirstLogin: true`. |
| Delete user | `deleteUser(userId)` (`src/actions/users.ts`) | Unlinks from `OrderPerson.userId` (sets it to `null`) so orders aren't broken, then deletes the user. Refuses self-delete. |
| Update aliases | `updateUserAliases(userId, aliases[])` | For fuzzy-matching historical free-text names against registered users. |
| Set Discord ID | `setUserDiscordId(userId, discordId \| null)` | Same validation as self-serve `linkDiscord`. |

### `/admin/guests` — Guests

`src/app/(app)/admin/guests/page.tsx`. Lists every `Guest` with stats from `listGuestsWithStats()` — visit count + last-visit date joined from `OrderPerson`.

**Actions:**

| Action | Server function | Notes |
|---|---|---|
| Create guest | `createGuest({ name, defaultHostUserId, aliases? })` (`src/actions/guests.ts`) | Any user can call this; it's re-used from the inline "add guest" flow during order editing. |
| Update guest | `updateGuest(id, { name?, defaultHostUserId?, aliases? })` | Admin only. |
| Delete guest | `deleteGuest(id)` | Admin only. **Refuses if the guest has any `OrderPerson` rows** — remove them from orders first. |

A link at the bottom of the page routes to **legacy backfill**.

### `/admin/guests/backfill` — Legacy guest backfill

`src/app/(app)/admin/guests/backfill/page.tsx`. Migrates pre-account free-text names in `OrderPerson` (rows with both `userId` and `guestId` null) into real `Guest` records.

Flow:
1. `listLegacyGuestNames()` groups those rows by `name`, returning `{ name, count, lastSeen }[]`.
2. Admin picks a row, picks an existing `Guest` to bind it to, and picks a host.
3. `backfillLegacyGuest({ legacyName, guestId, hostUserId })` runs an `updateMany` on every `OrderPerson` with no user, no guest, and matching `name`. Returns the number of updated rows.

After the migration, those rows behave exactly like regular guest rows — stats credit moves to the host, Visitors lists them, etc. See [Guests & hosts](./guests-and-hosts.md).

### `/admin/items` — Item history

`src/app/(app)/admin/items/page.tsx`. Read-only view of all order items across the system — useful for auditing price drift across restaurants or finding duplicate item names for alias cleanup.

### `/admin/discord-links` — Unresolved Discord users

`src/app/(app)/admin/discord-links/page.tsx`. Shows every `PendingDiscordLink` with `resolvedAt IS NULL` — Discord users who've interacted with the bot (usually via a Sekačka Join button) but have no matching `User.discordId`.

**Actions** (all in `src/actions/discord.ts`):

| Action | Effect |
|---|---|
| `resolvePendingDiscordLinkToUser(linkId, userId)` | Write the `discordId` onto an existing user; mark the link resolved. |
| `resolvePendingDiscordLinkCreateUser(linkId, { username, displayName, role })` | Create a new user with the Discord ID already bound and a temp password. Mark link resolved. |
| `dismissPendingDiscordLink(linkId)` | Delete the link row — for spam or clicks from people outside the team. |

The page surfaces the Discord identity hints (username / global name / nick), which Sekačka order triggered the click, and a helper action `getUsersWithoutDiscordLink()` so the admin can pick an existing user to bind to without memorizing Discord IDs.

## Why server actions are still authoritative

Every admin mutation authenticates and checks `role` server-side, **not** relying on the route guard. The middleware is a UX redirect, not a security boundary — a user who crafts a direct server-action call still gets `Unauthorized` at the action level.

## Cache invalidation

All admin mutations hit `revalidateTag` for the relevant scope:

- User changes → `users:registered`, `users:all`
- Guest changes → `guests:list` (and closed orders, since guest names appear in stats)
- Backfill → `guests:list` + closed-orders tags

So returning to `/stats` or any user-facing page right after an admin change shows fresh data without a hard reload.

## Related docs

- [Auth & access](./auth-and-access.md) — how the admin role gets assigned
- [Guests & hosts](./guests-and-hosts.md) — guest semantics
- [Discord integration](./discord-integration.md) — pending-link flow
- [Caching & loading](../caching-and-loading.md) — tag registry
