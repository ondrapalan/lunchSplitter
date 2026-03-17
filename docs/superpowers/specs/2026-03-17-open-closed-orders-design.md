# Open/Closed Orders Feature Design

**Date:** 2026-03-17
**Status:** Approved

## Overview

Add an open/closed lifecycle to orders. Open orders are visible to all registered users, who can join and add their own items. The order creator has full control and can close the order when done. Closed orders are read-only and visible only to participants.

## Data Model

Add `OrderStatus` enum and `status` field to the `Order` model:

```prisma
enum OrderStatus {
  OPEN
  CLOSED
}

model Order {
  // ...existing fields...
  status    OrderStatus @default(OPEN)
}
```

- New orders default to `OPEN`
- Only the creator can toggle between `OPEN` and `CLOSED`
- Existing orders get `OPEN` via Prisma default (only 2 exist — user will close manually)

## Authorization Rules

| Action | Creator (open) | Creator (closed) | Participant (open) | Participant (closed) | Non-participant (open) | Non-participant (closed) |
|---|---|---|---|---|---|---|
| View order | Yes | Yes | Yes | Yes | Yes (read-only) | No |
| Edit any items/fees/discounts | Yes | No | No | No | No | No |
| Edit own items | Yes | No | Yes | No | No | No |
| Edit own name | Yes | No | No | No | No | No |
| Remove themselves | N/A | N/A | No | No | No | No |
| Add themselves | N/A | N/A | N/A | N/A | Yes | No |
| Close order | Yes | N/A | No | No | No | No |
| Reopen order | N/A | Yes | N/A | No | No | No |
| Delete order | Yes | Yes | No | No | No | No |

Key rules:
- **Creator** has full edit power on open orders, can close/reopen/delete
- **Participants** can only edit their own person's items while order is open. Cannot edit their name or remove themselves (creator manages people).
- **Non-participants** can view open orders and add themselves (becoming a participant). Cannot access closed orders.
- **Closed orders** are fully read-only — only creator can reopen or delete
- `getOrder` returns 404/unauthorized for non-participants on closed orders

## Orders List Page

Two sections on the same page (no tabs):

### Open Orders (top)
- Shows ALL orders with `status: OPEN` from any user, sorted by `createdAt` descending (newest first)
- Each card: restaurant name, creator name, date, people count, green "Open" badge
- Participant sees "View" action
- Non-participant sees "Join" action
- Creator sees "Close" button

### My Orders (below)
- Shows `CLOSED` orders where user is creator or participant, sorted by `updatedAt` descending
- Each card: restaurant name, creator name, date, people count, neutral "Closed" badge
- Creator sees "Reopen" and "Delete" buttons
- Non-creators see "View" only

## Order Detail Page

Behavior adapts based on order status and user role:

### Open order — Creator
- Full edit mode available (current behavior, using existing `saveOrder` nuke-and-rebuild)
- "Close Order" button in header area
- Can edit all people, items, fees, discounts
- Note: when creator saves via `saveOrder`, it replaces the entire order atomically. This is acceptable because the creator has full control. If a participant was editing simultaneously, the creator's save takes precedence and the participant will see a stale-data error on their next save.

### Open order — Participant
- Order renders in read-only mode by default
- Their own person card (identified by `currentUserPersonId` from `getOrder`) has an "Edit My Items" button
- Clicking it shows an inline edit UI scoped to their card only with a "Save My Items" / "Cancel" button pair on their card
- Can add/remove/edit their own items and prices
- Cannot create shared items (sharing controls hidden for non-creator participants)
- Cannot touch other people's items, fees, global discount, or their own name
- Save calls `saveMyItems(orderId, personId, items)` — a dedicated action that only updates one person's items (see Server Actions)

### Open order — Non-participant
- Fully read-only view of the order
- Prominent "Join This Order" button
- Clicking calls `joinOrder(orderId)`, which adds them as a new person using `User.displayName` for `OrderPerson.name` and `sortOrder = MAX(existing) + 1`
- After joining, enters edit mode for their items (same as participant flow above)

### Closed order — Anyone
- Fully read-only summary
- Creator sees "Reopen Order" button
- No edit controls for anyone else

### New orders
- `createOrder` flow unchanged — creator creates order and edits in full edit mode
- Order is immediately `OPEN` and visible to others. This is acceptable: half-configured orders appearing briefly in the open list is a known trade-off for simplicity.

## Server Actions

### New Actions
- `closeOrder(orderId)` — sets status to `CLOSED`, creator-only. Idempotent (closing an already-closed order is a no-op).
- `reopenOrder(orderId)` — sets status to `OPEN`, creator-only. Idempotent (reopening an already-open order is a no-op).
- `joinOrder(orderId)` — adds current user as `OrderPerson` with `name = User.displayName`, `userId = session.user.id`, `sortOrder = MAX(existing sortOrder) + 1`. Requires order `OPEN`, user not already a participant, and user is not the order creator (creator manages their own person entry via `saveOrder`). Returns the new `personId`.
- `listOpenOrders()` — returns all orders with `status: OPEN`, sorted by `createdAt` descending
- `saveMyItems(orderId, personId, items: Item[])` — dedicated action for participant-scoped saves:
  - Verifies order is `OPEN`
  - Verifies `personId` belongs to the calling user (matches `userId`)
  - Verifies no items have `sharedWith` entries and no items have `customShares` entries (participants cannot create shared items)
  - Within a transaction: deletes all existing `OrderItem` records for that person, creates the new items, and bumps `Order.updatedAt` (so other clients detect the change)
  - Only touches one person's items — does NOT affect other people, fees, or order-level settings
  - Uses `updatedAt` optimistic lock: client sends the `updatedAt` it loaded, server rejects if order `updatedAt` has changed since then (returns error "Order was modified — please reload"). After reload, `getOrder` returns the updated `currentUserPersonId` so the participant seamlessly continues with their (potentially new) person ID.

### Modified Actions
- `listOrders()` — filtered to `CLOSED` orders where user is creator or participant
- `saveOrder(orderId, lunchSession)` — caller must be the creator. Non-creators must use `saveMyItems` instead. Uses existing nuke-and-rebuild strategy. Also uses `updatedAt` optimistic lock: if the order was modified since the creator loaded it (e.g., a participant joined or saved items), the save is rejected with "Order was modified — please reload." This prevents the creator from accidentally deleting participants who joined after they loaded the page.
- `getOrder(orderId)` — return additional fields: `status`, `isParticipant`, `currentUserPersonId` (the `OrderPerson.id` matching the calling user's `userId`, or `null`). Returns 404 for non-participants on closed orders.

### Authorization
All enforcement at server action level, not just UI.

## Shared Items & Participant Edits

Participants **cannot** create shared items. The sharing UI (sharedWith controls) is hidden for non-creator participants. Only the creator can set up item sharing across people.

If a creator has set up shared items referencing a participant's person, and the participant edits their own items via `saveMyItems`, the shared item links from other people pointing TO the participant's person are unaffected (they live on the other person's `OrderItem` records, not the participant's). However, `SharedItemLink` records where `itemId` belongs to the saving participant will be cascade-deleted when their items are deleted. The participant's new items are created without sharing. The creator would need to re-share if needed. This is acceptable because the creator has full control and can fix it.

## Component Changes

### OrdersPage (`/orders/page.tsx`)
- Calls `listOpenOrders()` and `listOrders()`
- Two sections with `SectionTitle`: "Open Orders" and "My Orders"
- Status badges on order cards (green open, neutral closed)
- Action buttons per role (Close/Join/Reopen/Delete)
- Empty states: "No open orders" if Open Orders section is empty, "No closed orders" if My Orders section is empty. Show "No orders yet. Create your first order!" only if both sections are empty. Hide a section entirely if empty is also acceptable.

### OrderDetailPage (`/orders/[orderId]/page.tsx`)
- Uses `status`, `isParticipant`, `currentUserPersonId` from `getOrder()`
- Conditional rendering based on role + status
- Close/Reopen button for creator
- Join button for non-participants on open orders
- Creator: existing full-edit flow with `useLunchSession` and `saveOrder`
- Participant: read-only page with scoped edit on their own card

### PersonCard
- New props: `canEditItems: boolean`, `canEditName: boolean`, `canRemove: boolean`
- Replaces single `editable` prop for more granular control
- Creator edit mode: all three `true` on all cards
- Participant edit mode: `canEditItems={true}` only on their own card, all else `false`
- Read-only mode: all `false`

### PeopleSection
- Respects per-card permissions
- Hides "Add Person" for non-creators

No new components — props and conditionals on existing ones.

## Error Handling & Edge Cases

### Race conditions
- Join a just-closed order → server checks status, toast: "This order has been closed"
- Save items on a just-closed order → same check, toast: "Order was closed while you were editing"
- Close an already-closed order → idempotent, no error
- Reopen an already-open order → idempotent, no error
- Concurrent participant saves → `saveMyItems` only touches one person's items, so two different participants saving simultaneously is safe (no conflict). Same participant saving twice: last write wins (both only affect their own items).
- Creator saves while participant is editing → creator's `saveOrder` replaces everything. Participant's next `saveMyItems` fails the `updatedAt` check, shows "Order was modified — please reload."

### Edge cases
- Creator is already on the order — no duplicate person entry
- Order with no people gets closed → allowed, creator can reopen
- Participant removes all items but stays → allowed, zero total
- Creator deletes a registered participant → that user loses access to closed order
- Non-participant tries to access closed order by direct URL → 404/unauthorized
- Participants cannot edit their own name (prevents confusion; creator can rename if needed) and cannot remove themselves from an order (creator manages people)
