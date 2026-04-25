# Orders & splitting math

An **order** is the core unit: one lunch at one restaurant with a set of participants and their items. This doc covers the lifecycle (open → closed) and the math that turns items into per-person totals.

## Lifecycle

```
          /orders/new
             │
             ▼
     ┌───────────────┐     closeOrder     ┌───────────────┐
     │     OPEN      │───────────────────▶│    CLOSED     │
     │ (editable)    │◀───────────────────│ (read-only +  │
     └───────────────┘     reopenOrder    │  payment QRs) │
             │                            └───────────────┘
       deleteOrder (creator while empty, or admin)
```

All mutations live in `src/actions/orders.ts` and invalidate the relevant tags on success.

### Roles on an order

| Role | Definition |
|---|---|
| **Creator** | `order.createdById === user.id` — the person who opened the order |
| **Participant** | Joined via `joinOrder` or was added by the creator — `OrderPerson.userId === user.id` |
| **Host** | A participant who is covering a guest — `OrderPerson.hostUserId === user.id` on the guest's row |
| **Admin** | `user.role === 'ADMIN'` — can view, close, reopen, and delete any order |

### Access model

Single source of truth: **`getOrderAccess(order, user)`** in `src/lib/orderAccess.ts`. Returns boolean capabilities the UI uses to show/hide every action:

| Capability | Rule |
|---|---|
| `canView` | creator · participant · admin · any user when `status === 'OPEN'` (open orders are public to the team) |
| `canEdit` | (creator · admin) **and** `status === 'OPEN'` |
| `canEditMyItems` | participant (not creator) **and** `status === 'OPEN'` |
| `canJoin` | not creator · not participant **and** `status === 'OPEN'` |
| `canLeave` | participant (not creator) **and** `status === 'OPEN'` |
| `canClose` | creator · admin **and** `status === 'OPEN'` |
| `canReopen` | creator · admin (any status) |
| `canDelete` | (creator and order is empty) · admin |
| `isCreator`, `isParticipant`, `isAdminView` | identity flags |
| `currentUserPersonId` | the user's `OrderPerson.id` or `null` — populated inside `getOrder` |

Never re-derive these in components — import and call `getOrderAccess`.

## Open-order editing

Two edit modes live side-by-side:

1. **Full edit (creator/admin)** — implicit while `status = OPEN`. Can change bank account, add/remove people, add/remove items, set shares, set discount, add fees, set custom shares. Items + person mutations auto-save per-action; fees, discount, and bank account live as a client-side draft until close.
2. **My-items edit (participant)** — toggle via "Edit my items". Can only add/edit/remove items on their own `OrderPerson`; cannot touch shares or custom splits (server enforces this in `saveMyItems`).

### Auto-save and the unsaved-draft guard

See `src/features/lunch/hooks/useAutoSave.ts`. Items debounce (5s) per-update; adds/removes hit the server immediately. Tracks `order.updatedAt` for optimistic-lock checks — both `closeOrderWithDraft` and `saveMyItems` reject when the server has a newer version, surfacing a click-to-reload toast.

Fees, the global discount, and the bank account number are *not* auto-saved. They sit in the client's `useLunchSession` state and only land in the DB when the creator clicks "Close Order" (which calls `closeOrderWithDraft`). `NavigationGuardProvider` (`src/features/lunch/components/NavigationGuard.tsx`) registers a `beforeunload` listener and intercepts `popstate` + nav-link clicks while the draft is dirty, prompting "Discard unsaved changes?" before navigation.

### Closing

`closeOrderWithDraft(orderId, draft, options)` (creator path):
1. Optimistic-lock check against `expectedUpdatedAt`.
2. Transaction: delete + recreate `FeeAdjustment` rows from the draft, write `globalDiscountPercent` + `bankAccountNumber`, set `status = CLOSED`, append an `OrderActivityLog` entry.
3. If `options.sendDiscord !== false`, call `sendOrderQrCodes(orderId)` → see [Discord integration](./discord-integration.md).

`closeOrder(orderId, { sendDiscord })` is the simpler variant still used by the orders list and Sekačka detail; it only flips status + logs and does not commit a draft.
3. If the order is Sekačka, call `refreshSekackaDiscordMessage` → see [Sekačka](./sekacka.md).
4. `revalidateTag` the order + list tags.

After closing, creator/admin can still reopen (`reopenOrder`) which reverts status to `OPEN` and logs `REOPENED`.

## Splitting math

All calculations are pure: **`calculatePersonSummaries(session)`** in `src/features/lunch/utils/calculations.ts`. The shape it consumes is `LunchSession` from `src/features/lunch/types.ts`.

```ts
LunchSession {
  globalDiscountPercent: number
  feeAdjustments: { id, name, amount }[]   // positive = fee, negative = coupon
  people: Person[]
}
Person {
  id, name
  userId?   // OR guestId (mutually exclusive)
  guestId?
  hostUserId?   // set when this person is a guest
  items: Item[]
}
Item {
  id, name, price
  discountPercent: number | null   // null → fall back to globalDiscountPercent
  isPackaging: boolean              // excluded from some stats aggregations
  sharedWith: string[]              // OrderPerson IDs the cost is also split with (owner implicit)
  customShares: Record<personId, amount> | null   // override equal split (pre-discount)
}
```

### Per-person summary

For each person, the calculator produces:

```ts
PersonSummary {
  personId, name
  subtotal       // raw price share before any discount
  afterDiscount  // subtotal minus item-level discounts
  withFees       // afterDiscount plus this person's fee share
}
```

### Algorithm

1. **Fees** — `netFees = sum(feeAdjustments[].amount)`. Can be negative.
2. **Fee share per person** — `netFees / people.length`, split equally. Fees are not subject to item discount.
3. **For each person P, for each item they participate in** (own item or appears in another person's `sharedWith`/`customShares`):
   - If `item.customShares` is set and has an entry for P, that's P's raw share (pre-discount).
   - Else the split is equal over `sharedWith.length + 1` people: `share = price / (sharedWith.length + 1)`.
   - **Effective discount** = `item.discountPercent ?? globalDiscountPercent`.
   - `afterDiscount += share * (1 - effectiveDiscount/100)`.
4. `withFees = afterDiscount + feeShare`.

### Who actually pays

Guests never owe their own total — the host does. `calculateChargeableAmount(personId, session)` rolls up:
- **Guest** → `0` (covered by host).
- **User** → `personSummary.withFees + sum(hostedGuests.map(g => g.withFees))`.

This is what the `/orders` page shows as the user's own amount and what QR codes encode.

## Files to touch when extending orders

| Change | File(s) |
|---|---|
| Add a new server mutation | `src/actions/orders.ts` (add `revalidateTag` at the end) |
| Expose it as a hook | `src/lib/queries/orders.ts` + key in `src/lib/queries/keys.ts` |
| Change access rules | `src/lib/orderAccess.ts` + its test `src/lib/orderAccess.test.ts` |
| Change math | `src/features/lunch/utils/calculations.ts` + test |
| Change the edit UI | `src/app/(app)/orders/[orderId]/page.tsx` and children under `src/features/lunch/components/` |
| Change the mapper | `src/lib/mappers.ts` + test |

## Related docs

- [Stats](./stats.md) — how aggregations consume `PersonSummary`
- [Sekačka](./sekacka.md) — the special order type with Discord join/leave
- [Guests & hosts](./guests-and-hosts.md) — guest semantics
- [Payments](./payments.md) — what happens after close
