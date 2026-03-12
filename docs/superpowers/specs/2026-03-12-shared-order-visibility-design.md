# Shared Order Visibility & Read-Only Mode

## Overview

Users should see orders they participate in (not just orders they created), and all orders should open in read-only mode by default. Only the creator can edit, and only after explicitly clicking "Edit order details". Editing timestamps are tracked and displayed.

## Goals

- Participants see orders they're linked to via `OrderPerson.userId`
- All orders open in read-only mode by default
- Only the creator can enter edit mode via an explicit action
- Track and display when an order was last edited
- No access control on viewing beyond authentication (any logged-in user with the URL can view any order, but unauthenticated users cannot)
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
- Include the `createdBy` relation: `createdBy: { select: { displayName: true } }`
- Return additional metadata alongside the session:
  - `isCreator` — boolean computed server-side (`order.createdById === session.user.id`), so the frontend doesn't need to compare IDs
  - `createdAt` — order creation timestamp
  - `updatedAt` — last edit timestamp
  - `creatorName` — display name of the creator (from the joined `createdBy` relation)

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
- Show "Last edited: [date]" in `OrderMeta` when `updatedAt` meaningfully differs from `createdAt` (more than 10 seconds apart, to filter out the initial save)
- "Delete" button only visible for orders the current user created

### 3. Order Detail Page (`/orders/[orderId]`)

**Default state: read-only for everyone.**

All components render static text instead of inputs:
- `OrderSettings` — discount shown as "10%" text, fees as a static list (no add/remove buttons)
- `PeopleSection` — no "Add person" UI, no remove buttons
- `PersonCard` — no "Add item" button, no remove buttons, name as plain text (card title not clickable for name editing)
- `ItemRow` — name, price, discount as plain text (discount badge not clickable); shared-with as labels (not dropdowns); "Share" toggle button hidden
- `Summary` and `CopySummary` — unchanged (already read-only)

**Creator-only "Edit order details" button:**
- Displayed in the header area, only for the order creator
- Toggles `isEditing` state on the page

**Edit mode (creator only):**
- Components switch to current editable behavior (inputs, add/remove buttons)
- Save bar appears with "Save Changes" and "Cancel" buttons
- "Cancel" discards unsaved changes and returns to read-only mode. Mechanism: increment a React `key` on the `EditOrderContent` component to force a full re-mount, which re-fetches from the server via the existing `useEffect`. This avoids needing a reset method on `useLunchSession`.
- After saving, the page re-fetches the order from the server (same key-increment approach), returns to read-only mode, and `updatedAt` refreshes

**"Last edited" display:**
- Shown subtly below the restaurant name
- Only visible when `updatedAt` differs from `createdAt` by more than 10 seconds (threshold to filter out the initial save that also sets `updatedAt`)

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
| `PersonCard` | Add `editable` prop; hide item management when read-only; suppress name click-to-edit |
| `ItemRow` | Add `editable` prop; render text or inputs; suppress discount badge click and share toggle |
| `PersonSuggest` | Hidden entirely when `editable` is false (add-person autocomplete) |
| `ItemSuggest` | Hidden entirely when `editable` is false (add-item autocomplete) |
| `SharedItemRef` | Render as static label when `editable` is false |
| `EditOrderPage` | Add `isEditing` state, read-only default, edit toggle, cancel logic |
| `OrdersPage` | Update to handle new list data shape, badges, conditional delete |
| `listOrders()` | Expand query with OR clause, return creator info + updatedAt |
| `getOrder()` | Include `createdBy` relation; return `isCreator`, timestamps, creator name |

## Edge Cases

- **User is both creator and participant:** Shows as "my order" (creator takes precedence)
- **Order with no people yet (just created):** Opens in edit mode automatically
- **All people deleted from existing order then reopened:** Also opens in edit mode (same heuristic — acceptable behavior since an empty order needs editing)
- **Participant visits order URL directly:** Sees read-only view, no edit button
- **Non-participant (logged in) visits order URL:** Sees read-only view, no edit button (open access for authenticated users by design)
- **Unauthenticated user visits order URL:** Redirected to login by existing middleware (no changes needed)
- **updatedAt equals createdAt:** "Last edited" label is hidden (no meaningful edit has occurred)
