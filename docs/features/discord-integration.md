# Discord integration

The app integrates with Discord for three things: **announcing Sekačka orders with join/leave buttons**, **DMing payment QRs when an order closes**, and **routing access requests + unknown-user links through admins**. All outbound work lives in `src/actions/discord.ts` and `src/lib/discord*.ts`; all inbound work (button clicks, slash-like interactions) lands at `src/app/api/discord/interactions/route.ts`.

## Configuration

Env vars used by the integration:

- `DISCORD_BOT_TOKEN` — required for any outbound send. `isDiscordConfigured()` is gated solely on this.
- `DISCORD_APPLICATION_ID` — used by the operator setup flow.
- `DISCORD_PUBLIC_KEY` — verifies Ed25519 signatures on incoming interactions; only inbound code reads it.
- `DISCORD_OBEDY_CHANNEL_ID` — the channel where Sekačka orders are published.
- `DISCORD_DRY_RUN=1` — short-circuits all outbound HTTP, logging payloads instead. Use during local dev for safety.
- `DISCORD_DEBUG_USER_ID` — when set, every outbound DM and channel send is rerouted to a DM with this user, prefixed with a `[DEBUG → <label>]` header naming the original target. Lets you exercise the live API on localhost without DMing real colleagues. Requires `DISCORD_DRY_RUN` empty and a real `DISCORD_BOT_TOKEN`. The redirect helpers live in `src/lib/discord.ts` (`resolveDebugTarget`, `sendGuildChannelMessage`, `isDiscordDebugMode`).

If `DISCORD_BOT_TOKEN` is missing, all outbound helpers no-op so the app still works without Discord set up. See [`discord-setup-guide-cz.md`](../discord-setup-guide-cz.md) for the operator's setup walkthrough (in Czech).

## Linking a user to a Discord ID

Each `User` has an optional `discordId` (17–20 digit snowflake). Two ways to set it:

| Path | Action | Where |
|---|---|---|
| Self-serve | `linkDiscord(discordId)` / `unlinkDiscord()` | `/settings` page |
| Admin | `setUserDiscordId(userId, discordId)` | `/admin/users` |

Both validate the format and reject duplicates (two users can't share a Discord ID).

## Outbound: payment DMs on close

`closeOrder` calls `sendOrderQrCodes(orderId)` unless the creator opted out with the "Close silently" button.

For each participant:
1. **Skip** the creator (they collect), guests (covered by host), users with no Discord link, and anyone whose `withFees ≤ 0`. In debug mode (`DISCORD_DEBUG_USER_ID` set) the no-Discord-link skip is bypassed — every non-creator, non-guest participant gets a DM redirected to the debug user, so unlinked test users can be exercised end-to-end.
2. Generate the QR payment data (see [Payments](./payments.md)).
3. `sendPaymentDm(discordId, { restaurantName, amount, qrPngBuffer, orderDate })` — posts an embed with the QR image and a **"Confirm payment"** button.
4. **Upsert a `PaymentConfirmation`** for the `OrderPerson` with `confirmedVia: 'pending'` and store the `discordMessageId`.

Return value is `{ sent, skipped, failed }`, toasted back to the closer. Anyone in `skipped` has no Discord link; that's the creator's cue to nudge them.

## Outbound: access request DMs

When someone submits `/request-access`, `sendAccessRequestDm` DMs every admin with an embed + **Approve** / **Deny** buttons. Custom IDs are `approve-access:<requestId>` and `deny-access:<requestId>`.

## Outbound: pending-link DMs

When an unknown Discord user clicks a Sekačka Join button (see below), `recordPendingDiscordLink` creates or updates a `PendingDiscordLink` row and DMs admins **the first time only** — subsequent clicks by the same `discordId` bump the row but don't spam the DM channel. Admins resolve on `/admin/discord-links`.

## Inbound: the interactions endpoint

`src/app/api/discord/interactions/route.ts` is the single webhook:

1. **Verify** the request with the Ed25519 signature using `discord-interactions`. Reject 401 on failure.
2. Handle **PING** (`type === 1`) — Discord's endpoint verification.
3. Handle **MESSAGE_COMPONENT** (`type === 3`) — button clicks. Route by `custom_id` prefix:

| Prefix | Handler | Effect |
|---|---|---|
| `confirm-payment:<orderPersonId>` | `handlePaymentConfirmation` | Verify the clicker's `discordId` matches the `OrderPerson.user.discordId`, update `PaymentConfirmation` (`confirmedVia: 'discord'`, `confirmedAt: now`), edit the original DM to strike through the text and show a green "Payment confirmed!" embed. |
| `approve-access:<requestId>` | `handleAccessRequest(true)` | Create the `User` from the stored `AccessRequest`, flip status to `approved`, edit the admin's DM. |
| `deny-access:<requestId>` | `handleAccessRequest(false)` | Flip status to `denied`, edit DM. |
| `sekacka-join:<orderId>` | `handleSekackaJoin` | Lookup `User.discordId`. If found → `addSekackaParticipant(orderId, user.id, { source: 'DISCORD' })`; else → `recordPendingDiscordLink(...)` + ephemeral response. After success, `refreshSekackaDiscordMessage` edits the announcement. |
| `sekacka-leave:<orderId>` | `handleSekackaLeave` | Same shape. Creator-leave returns an ephemeral error. |

Sekačka button handlers return **ephemeral** error responses when things fail — the clicker sees the problem but nobody else in the channel does.

## Pending Discord links (unknown users)

When a stranger interacts with the bot:

1. `recordPendingDiscordLink(orderId, { id, username, globalName, nick })` upserts a `PendingDiscordLink` keyed by `discordId`. Writes an `OrderActivityLog` entry (`PENDING_LINK_CREATED`). DMs admins **only** if the row is new or previously resolved.
2. Admin opens `/admin/discord-links`, sees the row with the Discord identity hints and a link to the Sekačka that triggered it.
3. Three resolution paths in `src/actions/discord.ts`:
   - `resolvePendingDiscordLinkToUser(linkId, userId)` — bind the Discord ID to an existing user.
   - `resolvePendingDiscordLinkCreateUser(linkId, { username, displayName, role })` — create a fresh user and bind in one step. Returns the temp password.
   - `dismissPendingDiscordLink(linkId)` — delete without resolving (for spam / accidental clicks).

## Files

| Concern | File |
|---|---|
| Outbound actions (link, DM, confirm) | `src/actions/discord.ts` |
| Inbound webhook (button handlers) | `src/app/api/discord/interactions/route.ts` |
| REST helpers (send DM, edit message) | `src/lib/discord*.ts` |
| Sekačka-specific message build + refresh | `src/lib/sekackaCore.ts` |
| Admin resolution UI | `src/app/(app)/admin/discord-links/page.tsx` |

## Related docs

- [Sekačka](./sekacka.md) — the user-facing half of the join/leave flow
- [Payments](./payments.md) — QR generation, SPD format, payment confirmation lifecycle
- [Auth & access](./auth-and-access.md) — how access requests flow through admins
- [Storage & housekeeping](../storage-and-housekeeping.md) — TTL that prunes resolved `PendingDiscordLink` rows
