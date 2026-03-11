# Lunch Splitter — Design Spec

## Context

Office colleagues order lunch together 2-3 times per week. Currently, bill splitting is done manually (text notes like `exampleLunch.txt`). This app automates the calculation: adding people, their items, applying discounts, splitting fees, and producing a copyable summary.

## Requirements

- **Single-user data entry** — one person (the user) enters all orders
- **2-15 people** per session, dynamically added/removed
- **Items with prices** — manually entered per person
- **Shared items** — an item can be split among multiple people (equal split by default, custom amounts as override)
- **Global discount** — percentage applied to all items (e.g., 40%)
- **Per-item discount override** — individual items can have a different discount than the global one
- **Dynamic fees/adjustments** — add any number of fees (+) or coupons (-) with labels, all split equally among participants
- **Live summary** — per-person breakdown updates instantly
- **Copy summary** — generate text output for sharing
- **Standalone sessions** — no persistence required now, but architecture should not prevent adding it later
- **English UI** — item names and person names naturally in Czech

## Conventions

- **Currency**: CZK (Czech koruna), single currency only
- **Rounding**: Display values rounded to 2 decimal places (e.g., 139.80, not 139.8)
- **Custom shares**: When using custom share amounts, users enter pre-discount amounts; the discount is then applied to each person's share

## Technology Stack

- **Vite + React** — client-side SPA
- **TypeScript** — strict, no `any`
- **styled-components** — with theme (colors, fontSizes, typography)
- **react-hook-form + zod** — for form validation
- **Capacitor-ready** — pure web app that can be wrapped for iOS/Android later

## Architecture

### Layout

Single-page top-down flow:

1. **Header** — app title
2. **Order Settings** — global discount %, dynamic fees/adjustments list
3. **People & Orders** — expandable person cards with items
4. **Summary** — table with per-person breakdown and totals
5. **Copy Summary** button

### Data Model

```typescript
interface LunchSession {
	globalDiscountPercent: number
	feeAdjustments: FeeAdjustment[]
	people: Person[]
}

interface FeeAdjustment {
	id: string
	name: string
	amount: number // positive = fee, negative = coupon/discount
}

interface Person {
	id: string
	name: string
	items: Item[]
}

interface Item {
	id: string
	name: string
	price: number
	discountPercent: number | null // null = use global discount
	sharedWith: string[] // person IDs who share this item (empty = not shared)
	customShares: Record<string, number> | null // null = equal split, or personId -> amount
}
```

### Calculation Logic

1. **For each person**, gather all items they participate in:
    - Their own items (not shared)
    - Their share of shared items (items they own that are shared + items others shared with them)

2. **For each item**, determine effective discount:
    - Use `item.discountPercent` if set, otherwise `session.globalDiscountPercent`

3. **Calculate item cost share**:
    - If not shared: `price * (1 - effectiveDiscount / 100)`
    - If shared equally: `price * (1 - effectiveDiscount / 100) / numberOfSharers`
    - If custom shares: use the custom amount for this person, then apply discount

4. **Sum per person**: all their item shares = `discountedSubtotal`

5. **Calculate net fees**: `sum(feeAdjustments.map(f => f.amount))`

6. **Per-person fee share**: `netFees / numberOfPeople`

7. **Final per person**: `discountedSubtotal + feeShare`

### Shared Items UX

- Items are always "owned" by one person (the card they were added to)
- An item has an optional "shared with" selector — pick other people from a dropdown
- Shared items appear as a linked reference in other people's cards (read-only, shows their share)
- By default, shared items split equally; user can override with custom amounts

### Per-Item Discount UX

- Each item shows a discount badge (defaults to "global X%")
- Clicking the badge lets you change to a custom percentage for that item
- Setting it back to empty/null reverts to the global discount

### Fees & Adjustments UX

- Dynamic list in Order Settings
- Each row: name (text input) + amount (number input)
- Positive amounts display as `+ X CZK` (fees)
- Negative amounts display as `- X CZK` (coupons/discounts)
- `[+ Add fee/adjustment]` button to add rows
- `✕` button to remove rows
- Live display of net total and per-person split

### Summary Section

Table columns:

- Person name
- Subtotal (raw prices, their share only)
- After discount
- With fees (final amount)
- Total row at bottom

### Copy Summary

Generates a text block similar to `exampleLunch.txt`:

```
Domča:
  Grilled roastbeef    164
  Pařížská rychlovka    69
  ---------------------------
  Subtotal:            233
  After discount:      139.80
  With fees:           148.60

...

Discount: 40%
Fees:
  Service Fee:    +30
  Delivery Fee:   +39
  Delivery Coupon: -25
Fee per person: 8.80
```

## Project Structure

```
src/
  App.tsx                    # Root component
  main.tsx                   # Entry point
  features/
    ui/
      theme/
        index.ts             # Theme definition (colors, fonts, sizes)
        styled.d.ts          # Styled-components theme typing
      components/
        Button.tsx
        Input.tsx
        Card.tsx
    lunch/
      types.ts               # LunchSession, Person, Item, FeeAdjustment
      hooks/
        useLunchSession.ts   # Main state hook (add/remove people, items, etc.)
        useCalculation.ts    # Derived calculation from session state
      components/
        OrderSettings.tsx    # Global discount + fees/adjustments
        PersonCard.tsx       # Single person with their items
        ItemRow.tsx          # Single item row (name, price, discount, sharing)
        SharedItemRef.tsx    # Linked reference to item shared from another person
        PeopleSection.tsx    # List of PersonCards + Add Person
        Summary.tsx          # Summary table
        CopySummary.tsx      # Copy button + text generation
      utils/
        calculations.ts     # Pure calculation functions (testable)
        formatters.ts        # Number/currency formatting
```

## Verification

1. **Dev server**: `npm run dev` — app loads, all sections visible
2. **Add people**: Add 3+ people, verify cards appear
3. **Add items**: Add items to each person with prices
4. **Shared item**: Share an item between 2 people, verify both see it and costs split correctly
5. **Global discount**: Set 40%, verify all items reflect it in summary
6. **Per-item discount**: Override one item's discount, verify it uses custom value
7. **Fees**: Add service fee (+30), delivery (+39), coupon (-25), verify net = 44 and per-person = 44/N
8. **Summary**: Verify totals match manual calculation from `exampleLunch.txt`
9. **Copy**: Click copy, paste into text editor, verify format
10. **Reproduce example**: Enter exact data from `exampleLunch.txt`, verify matching results:
    - Domča: 233 raw → 139.80 discounted → 148.60 with fees
    - Bary: 283 → 169.80 → 178.60
    - Já: 268 → 160.80 → 169.60
    - Lukáš: 292 → 175.20 → 184.00
    - Jířa: 292 → 175.20 → 184.00
