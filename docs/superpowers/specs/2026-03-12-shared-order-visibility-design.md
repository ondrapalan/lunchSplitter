# Shared Order Visibility & Read-Only Mode

## Overview

Users should see orders they participate in (not just orders they created), and all orders should open in read-only mode by default. Only the creator can edit, and only after explicitly clicking "Edit order details". Editing timestamps are tracked and displayed.

## Goals

- Participants see orders they're linked to via `OrderPerson.userId`
- All orders open in read-only mode by default
- Only the creator can enter edit mode via an explicit action
- Track and display when an order was last edited
- No access control on viewing (anyone with the URL can view)
- Only the creator can edit or delete

## Non-Goals

- Real-time collaborative editing
- Notifications when orders are updated
- Order status (draft/finalized/paid)
- Share-via-link feature (viewing is already open)

## Design

### 1. Data & API Layer

**Schema:** No migration needed. `Order.updatedAt` already exists with Prisma's `@updatedAt` directive, which auto-updates on every save.

**`getOrder(orderId)` changes:**
- Return additional metadata alongside the session:
  - `createdById` — so the frontend knows if the current user is the creator
  - `createdAt` — order creation timestamp
  - `updatedAt` — last edit timestamp
  - `creatorName` — display name of the creator (for participant context)

**`listOrders()` changes:**
- Expand the Prisma `where` clause to include orders where the user is a participant:
  ```
  where: {
    OR: [
      { createdById: userId },
      { people: { some: { userId: userId } } }
    ]
  }
  ```
- Return additional fields per order:
  - `createdById` — to distinguish "my orders" from "shared with me"
  - `updatedAt` — for "last edited" display
  - `creatorName` — display name of the order creator

**`saveOrder()` / `deleteOrder()`:** No changes. Already enforce creator-only access. `updatedAt` auto-updates via Prisma on save.

### 2. Order List Page (`/orders`)

**Unified list** — all orders (created + participated) in one list sorted by `createdAt` desc.

**Per-order row changes:**
- Show a badge/label: creator's orders show normally, participant orders show "by [creator name]"
- Show "Last edited: [date]" in `OrderMeta` when `updatedAt` meaningfully differs from `createdAt` (more than a few seconds, since initial save also triggers `updatedAt`)
- "Delete" button only visible for orders the current user created

### 3. Order Detail Page (`/orders/[orderId]`)

**Default state: read-only for everyone.**

All components render static text instead of inputs:
- `OrderSettings` — discount shown as "10%" text, fees as a static list (no add/remove buttons)
- `PeopleSection` — no "Add person" UI, no remove buttons
- `PersonCard` — no "Add item" button, no remove buttons, name as plain text
- `ItemRow` — name, price, discount as plain text; shared-with as labels (not dropdowns)
- `Summary` and `CopySummary` — unchanged (already read-only)

**Creator-only "Edit order details" button:**
- Displayed in the header area, only for the order creator
- Toggles `isEditing` state on the page

**Edit mode (creator only):**
- Components switch to current editable behavior (inputs, add/remove buttons)
- Save bar appears with "Save Changes" and "Cancel" buttons
- "Cancel" discards unsaved changes and returns to read-only mode (resets to last saved state)
- After saving, page returns to read-only mode and `updatedAt` refreshes

**"Last edited" display:**
- Shown subtly below the restaurant name
- Only visible when `updatedAt` meaningfully differs from `createdAt`

**Component approach — `editable` prop:**
Each component receives an `editable` boolean prop that controls rendering mode. When `false`, inputs render as text, action buttons are hidden. This avoids creating duplicate read-only component trees.

### 4. New Order Flow

**No changes to `/orders/new`.**

When a newly created order is opened (empty session with no people), the page starts in edit mode automatically. This is a simple heuristic — if `session.people.length === 0`, default `isEditing` to `true`.

## Component Change Summary

| Component | Change |
|-----------|--------|
| `OrderSettings` | Add `editable` prop; render text or inputs |
| `PeopleSection` | Add `editable` prop; hide add/remove UI when read-only |
| `PersonCard` | Add `editable` prop; hide item management when read-only |
| `ItemRow` | Add `editable` prop; render text or inputs |
| `EditOrderPage` | Add `isEditing` state, read-only default, edit toggle, cancel logic |
| `OrdersPage` | Update to handle new list data shape, badges, conditional delete |
| `listOrders()` | Expand query with OR clause, return creator info + updatedAt |
| `getOrder()` | Return createdById, timestamps, creator name |

## Edge Cases

- **User is both creator and participant:** Shows as "my order" (creator takes precedence)
- **Order with no people yet (just created):** Opens in edit mode automatically
- **Participant visits order URL directly:** Sees read-only view, no edit button
- **Non-participant visits order URL:** Sees read-only view, no edit button (open access by design)
- **updatedAt equals createdAt:** "Last edited" label is hidden (no meaningful edit has occurred)
