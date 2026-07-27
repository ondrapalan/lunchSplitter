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

### `/admin/discord-links` — Discord linking

`src/app/(app)/admin/discord-links/page.tsx` is a thin composition of two sections that live in `src/features/admin/components/`.

#### Missing Discord link (proactive)

[`UnlinkedUsersSection`](../../src/features/admin/components/UnlinkedUsersSection.tsx) lists every user with `discordId IS NULL` and, for each, a dropdown of guild members nobody is linked to yet. Picking one and hitting **Link** calls the existing `setUserDiscordId`. This exists because self-service linking (colleagues copying their own Discord ID into Settings) left several people unlinked indefinitely.

The member list comes from [`listUnlinkedGuildMembers()`](../../src/actions/discordMembers.ts), which reads the guild through the bot and subtracts every `discordId` already stored on a user. The same list doubles as the collapsed "On Discord, not linked yet" roster with a copy-as-text button, so it shrinks as pairs are made.

**There is deliberately no automatic name matching.** Real server nicknames (`Domča` for a *Dominik*, `Bary` for *cyomi*, `Jiří H. N.` with no surname) make exact matching useless, and anything looser risks pairing the wrong two people — which would send one colleague's payment QR to another's DM. Instead the dropdown label shows every name a person might be known by (nickname · global name · @username), built by [`memberLabel`](../../src/lib/discordMemberDisplay.ts) and ordered with Czech collation.

Requires `DISCORD_GUILD_ID` and the **GUILD_MEMBERS privileged intent**; see [Discord integration](./discord-integration.md). A missing variable, a disabled intent, or an unconfigured bot each render an actionable message in place of the list rather than hiding the section.

#### Unlinked Discord accounts (reactive)

[`PendingLinksSection`](../../src/features/admin/components/PendingLinksSection.tsx) shows every `PendingDiscordLink` with `resolvedAt IS NULL` — Discord users who've interacted with the bot (usually via a Sekačka Join button) but have no matching `User.discordId`.

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
