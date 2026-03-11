# Lunch Splitter

A single-page React app for splitting lunch bills among office colleagues. Handles discounts, shared items, per-item discount overrides, and fee/coupon adjustments.

## Features

- **People & items** — Add people, add their food items with prices
- **Global discount** — Apply a percentage discount to all items
- **Per-item discount override** — Click the discount badge on any item to set a custom discount
- **Shared items** — Share an item across multiple people with equal or custom splits
- **Fees & adjustments** — Add delivery fees, service charges, and coupons (positive or negative amounts), split equally
- **Item suggestions** — Autocomplete dropdown suggests previously entered item names and prices
- **Summary table** — Live-updating breakdown: Subtotal → After Discount → With Fees
- **Copy to clipboard** — One-click copy of the full text summary

## Tech Stack

- **Vite** + **React 18** + **TypeScript** (strict)
- **styled-components** for theming and styling
- **react-hook-form** + **zod** for form validation
- **Vitest** for unit testing

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |

## Project Structure

```
src/
├── features/
│   ├── lunch/
│   │   ├── types.ts              # Data types
│   │   ├── hooks/
│   │   │   ├── useLunchSession.ts  # State management (CRUD)
│   │   │   └── useCalculation.ts   # Derived calculations
│   │   ├── utils/
│   │   │   ├── calculations.ts     # Pure calculation functions
│   │   │   ├── calculations.test.ts
│   │   │   ├── formatters.ts       # Currency & summary formatting
│   │   │   └── formatters.test.ts
│   │   └── components/
│   │       ├── OrderSettings.tsx    # Discount + fees UI
│   │       ├── PeopleSection.tsx    # People list + add person
│   │       ├── PersonCard.tsx       # Person with items
│   │       ├── ItemRow.tsx          # Item with discount/sharing
│   │       ├── ItemSuggest.tsx      # Autocomplete input
│   │       ├── SharedItemRef.tsx    # Linked shared item display
│   │       ├── Summary.tsx          # Summary table
│   │       └── CopySummary.tsx      # Copy button
│   └── ui/
│       ├── theme/
│       │   ├── index.ts            # Theme definition
│       │   └── styled.d.ts         # Type augmentation
│       └── components/
│           ├── Button.tsx
│           ├── Input.tsx
│           ├── Card.tsx
│           └── SectionTitle.tsx
├── GlobalStyles.ts
├── App.tsx
└── main.tsx
```

## Example

Based on `exampleLunch.txt` — 5 people, 40% discount, delivery (39) + coupon (-25) + service (30):

| Name   | Subtotal | After Discount | With Fees |
|--------|----------|----------------|-----------|
| Domča  | 233.00   | 139.80         | 148.60    |
| Bary   | 283.00   | 169.80         | 178.60    |
| Já     | 268.00   | 160.80         | 169.60    |
| Lukáš  | 292.00   | 175.20         | 184.00    |
| Jířa   | 292.00   | 175.20         | 184.00    |
