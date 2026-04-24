# Sekačka

**Sekačka** is a Czech tradition where one person brings a batch of sekaná (meatloaf) sandwiches to the office and everyone pays their share. It's a group order with a different rhythm than a normal lunch — the creator makes the buying decisions, and colleagues opt in via a Discord message rather than the web UI.

## How it differs from a normal order

| | Normal | Sekačka |
|---|---|---|
| `Order.type` | `NORMAL` | `SEKACKA` |
| Who adds items | Creator + each participant adds their own | **Creator only** — participants never touch items |
| How participants join | `/orders` → Join button, or added by the creator | Click **Join** on the Discord message |
| Item model | Full (`discountPercent`, `isPackaging`, `sharedWith`, `customShares`) | Just `name` + `price` |
| Splitting | Per-item, per-person | **All items split equally** among all participants |
| Fees/discounts | Supported | Not used |
| Detail page UI | `OrderContent` | `SekackaOrderDetail` |

The creator is themselves a participant. Everyone — creator included — owes `orderTotal / participantCount`.

## Core flow

Code lives in `src/lib/sekackaCore.ts`. The critical functions:

| Function | What it does |
|---|---|
| `publishSekackaToDiscordCore(orderId)` | Sends the initial message to `DISCORD_OBEDY_CHANNEL_ID` with join/leave buttons, stores `discordAnnounceChannelId` + `discordAnnounceMessageId` on the order, writes `PUBLISHED_TO_DISCORD` to `OrderActivityLog`. |
| `refreshSekackaDiscordMessage(orderId)` | Re-reads the order and edits the stored Discord message so the participant list, item list, and per-person cost stay in sync. Called after every join/leave/save/close/reopen. |
| `addSekackaParticipant(orderId, userId, { source })` | Creates an `OrderPerson` for the user, auto-creates a `SharedItemLink` to **every** creator-owned item (this is how equal splitting is expressed in the shared data model), writes activity log (`JOINED` if `source === 'DISCORD'`, else `MANUAL_ADDED`), and refreshes the Discord message. |
| `removeSekackaParticipant(orderId, userId, { source })` | Deletes the person row (cascade handles the shared links). Refuses if the caller is the creator. Logs `LEFT` / `MANUAL_REMOVED` and refreshes. |
| `buildSekackaMessage(order)` | Pure function that returns `{ embeds, components }` for the Discord message — embed lists items + participant table, buttons are `sekacka-join:<orderId>` and `sekacka-leave:<orderId>`. |

## Equal-split via `sharedWith`

There's **no special-case code path** for Sekačka in the math. When a participant joins, `addSekackaParticipant` adds their ID to every existing item's `sharedWith`, which makes the standard `calculatePersonSummaries` split each item across all participants equally. That's why every item is always owned by the creator — it's the simplest row that can carry the shared-with fan-out.

The consequence: if the creator adds a new item **after** someone joined, they must save it — `saveOrder` will then rewrite everything and include the new participants in the item's shared list.

## Discord join/leave flow

1. A colleague clicks the **Join** button on the message.
2. Discord sends a signed `MESSAGE_COMPONENT` interaction to `src/app/api/discord/interactions/route.ts`.
3. The route verifies the Ed25519 signature, parses the `custom_id` `sekacka-join:<orderId>`, and pulls the Discord identity (id, username, global name, nick).
4. Lookup:
   - **User with this `discordId` exists** → `addSekackaParticipant(orderId, user.id, { source: 'DISCORD' })`. Edits the message in place.
   - **No match** → `recordPendingDiscordLink(orderId, identity)` creates or updates a `PendingDiscordLink` row, logs `PENDING_LINK_CREATED`, and DMs all admins the first time (so a stranger clicking 20 times only pings once). Response is an **ephemeral** "admin has been notified" so only the clicker sees it.
5. Leave works the same way with `sekacka-leave:<orderId>`. Creator-leave attempts return an ephemeral error.

After either branch, `refreshSekackaDiscordMessage` re-renders the embed so the participant count/total per head are up to date.

## Web UI

- **Create**: `/orders/new/sekacka` → dedicated form in `src/app/(app)/orders/new/sekacka/page.tsx`. Creates the order with `type: SEKACKA` and publishes to Discord in one step.
- **Detail**: `/orders/[orderId]` detects `orderData.type === 'SEKACKA'` and renders `SekackaOrderDetail` instead of the normal `OrderContent`. This component shows the simpler item list, the participant count, the per-head cost, and creator-only controls.
- **Stats**: the `SekackaStats` card on `/stats` aggregates participants, items, and per-portion cost. See [Stats](./stats.md).

## Files to touch

| Change | File |
|---|---|
| Core logic (join/leave/refresh/publish) | `src/lib/sekackaCore.ts` |
| Discord button handlers | `src/app/api/discord/interactions/route.ts` |
| Detail page layout | `src/features/lunch/components/SekackaOrderDetail.tsx` |
| Create page | `src/app/(app)/orders/new/sekacka/page.tsx` |
| Stats aggregation | `src/actions/stats.ts → getSekackaStats` |
| Discord message template | `buildSekackaMessage` in `src/lib/sekackaCore.ts` |

## Related docs

- [Discord integration](./discord-integration.md) — the interactions endpoint, signature verification, pending links
- [Orders & splitting](./orders-and-splitting.md) — the underlying data model Sekačka re-uses
- [Stats](./stats.md) — Sekačka card
