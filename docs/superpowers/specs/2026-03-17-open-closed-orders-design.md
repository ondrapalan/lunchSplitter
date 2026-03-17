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
- Existing orders get `OPEN` via Prisma default (no data migration — user will close manually)

## Authorization Rules

| Action | Creator (open) | Creator (closed) | Participant (open) | Participant (closed) | Non-participant (open) |
|---|---|---|---|---|---|
| View order | Yes | Yes | Yes | Yes | Yes (read-only) |
| Edit any items/fees/discounts | Yes | No | No | No | No |
| Edit own items | Yes | No | Yes | No | No |
| Add themselves | N/A | N/A | N/A | N/A | Yes |
| Close order | Yes | N/A | No | No | No |
| Reopen order | N/A | Yes | N/A | No | No |
| Delete order | Yes | Yes | No | No | No |

Key rules:
- **Creator** has full edit power on open orders, can close/reopen/delete
- **Participants** can only edit their own person's items while order is open
- **Non-participants** can view open orders and add themselves (becoming a participant)
- **Closed orders** are fully read-only — only creator can reopen or delete

## Orders List Page

Two sections on the same page (no tabs):

### Open Orders (top)
- Shows ALL orders with `status: OPEN` from any user
- Each card: restaurant name, creator name, date, people count, green "Open" badge
- Participant sees "View" action
- Non-participant sees "Join" action
- Creator sees "Close" button

### My Orders (below)
- Shows `CLOSED` orders where user is creator or participant
- Each card: restaurant name, creator name, date, people count, neutral "Closed" badge
- Creator sees "Reopen" and "Delete" buttons
- Non-creators see "View" only

## Order Detail Page

Behavior adapts based on order status and user role:

### Open order — Creator
- Full edit mode available (current behavior)
- "Close Order" button in header area
- Can edit all people, items, fees, discounts

### Open order — Participant
- Read-only by default
- Own person card has "Edit My Items" button for inline editing (add/remove/edit items, prices)
- Cannot touch other people's items, fees, or global discount

### Open order — Non-participant
- Fully read-only view
- Prominent "Join This Order" button
- Clicking adds them as new person (display name + userId), then enters edit mode for their items

### Closed order — Anyone
- Fully read-only summary
- Creator sees "Reopen Order" button
- No edit controls for anyone else

## Server Actions

### New Actions
- `closeOrder(orderId)` — sets status to `CLOSED`, creator-only
- `reopenOrder(orderId)` — sets status to `OPEN`, creator-only
- `joinOrder(orderId)` — adds current user as `OrderPerson` with displayName and userId; requires order `OPEN` and user not already a participant
- `listOpenOrders()` — returns all orders with `status: OPEN`

### Modified Actions
- `listOrders()` — filtered to `CLOSED` orders where user is creator or participant
- `saveOrder(orderId, lunchSession)` — authorization: if not creator, verify order is `OPEN` and only allow changes to the person entry matching user's userId
- `getOrder(orderId)` — return additional fields: `status`, `isParticipant`, `currentUserPersonId`

### Authorization
All enforcement at server action level, not just UI.

## Component Changes

### OrdersPage (`/orders/page.tsx`)
- Calls `listOpenOrders()` and `listOrders()`
- Two sections with `SectionTitle`: "Open Orders" and "My Orders"
- Status badges on order cards (green open, neutral closed)
- Action buttons per role (Close/Join/Reopen/Delete)

### OrderDetailPage (`/orders/[orderId]/page.tsx`)
- Conditional rendering based on role + status
- Close/Reopen button for creator
- Join button for non-participants on open orders

### PersonCard
- New `editable: boolean` prop controlling item editability
- Participant's own card: `editable={true}`
- Creator edit mode: all cards `editable={true}`

### PeopleSection
- Respects per-card editability
- Hides "Add Person" for non-creators

No new components — props and conditionals on existing ones.

## Error Handling & Edge Cases

### Race conditions
- Join a just-closed order → server checks status, toast: "This order has been closed"
- Save items on a just-closed order → same check, toast: "Order was closed while you were editing"
- Close an already-closed order → idempotent, no error

### Edge cases
- Creator is already on the order — no duplicate person entry
- Order with no people gets closed → allowed, creator can reopen
- Participant removes all items but stays → allowed, zero total
- Creator deletes a registered participant → that user loses access to closed order
