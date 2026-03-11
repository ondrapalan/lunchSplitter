# Lunch Splitter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page React app that splits lunch bills among colleagues, handling discounts, shared items, and fees.

**Architecture:** Vite + React SPA with TypeScript. Pure client-side — all state in React hooks, all calculations in pure functions. styled-components for styling, react-hook-form + zod for form inputs. Vitest for testing.

**Tech Stack:** Vite, React 18, TypeScript (strict), styled-components, react-hook-form, zod, Vitest

**Spec:** `docs/superpowers/specs/2026-03-11-lunch-splitter-design.md`

---

## Chunk 1: Project Setup, Types & Calculation Engine

### Task 1: Initialize Vite + React + TypeScript Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`
- Create: `src/vite-env.d.ts`

- [ ] **Step 1: Scaffold Vite project**

```bash
npm create vite@latest . -- --template react-ts
```

This generates the base project files. Accept overwriting existing files if prompted.

- [ ] **Step 2: Install dependencies**

```bash
npm install styled-components react-hook-form @hookform/resolvers zod react-toastify
npm install -D @types/styled-components vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure Vitest in vite.config.ts**

Replace `vite.config.ts` with:

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
  resolve: {
    alias: {
      '~': '/src',
    },
  },
})
```

- [ ] **Step 4: Create test setup file**

Create `src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Add test script to package.json**

Add to `"scripts"` in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite dev server starts at `http://localhost:5173`, browser shows default React page.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: initialize vite + react + typescript project with dependencies"
```

---

### Task 2: Create Theme & Styled-Components Setup

**Files:**
- Create: `src/features/ui/theme/index.ts`
- Create: `src/features/ui/theme/styled.d.ts`

- [ ] **Step 1: Create theme definition**

Create `src/features/ui/theme/index.ts`:

```typescript
export const theme = {
  colors: {
    background: '#1a1a2e',
    surface: '#16213e',
    surfaceLight: '#1e2d4a',
    primary: '#64ffda',
    primaryDark: '#4ecdc4',
    secondary: '#82aaff',
    text: '#e0e0e0',
    textMuted: '#8892b0',
    textDim: '#546e7a',
    accent: '#c792ea',
    positive: '#c3e88d',
    negative: '#ff5370',
    warning: '#ffcb6b',
    border: '#2a3a5c',
    cardBackground: '#0f1a30',
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.5rem',
    xxl: '2rem',
  },
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  typography: {
    heading: {
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    body: {
      fontWeight: 400,
      lineHeight: 1.6,
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
} as const

export type Theme = typeof theme
```

- [ ] **Step 2: Create styled-components type declaration**

Create `src/features/ui/theme/styled.d.ts`:

```typescript
import 'styled-components'
import type { Theme } from './index'

declare module 'styled-components' {
  export interface DefaultTheme extends Theme {}
}
```

- [ ] **Step 3: Wire theme into App.tsx**

Replace `src/App.tsx` with:

```typescript
import { ThemeProvider } from 'styled-components'
import { theme } from '~/features/ui/theme'

function App() {
  return (
    <ThemeProvider theme={theme}>
      <div>Lunch Splitter</div>
    </ThemeProvider>
  )
}

export default App
```

- [ ] **Step 4: Create global styles**

Create `src/GlobalStyles.ts`:

```typescript
import { createGlobalStyle } from 'styled-components'

export const GlobalStyles = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: ${({ theme }) => theme.font};
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.6;
    min-height: 100vh;
  }

  input, button, select {
    font-family: inherit;
    font-size: inherit;
  }
`
```

Add `<GlobalStyles />` inside the `ThemeProvider` in `App.tsx`:

```typescript
import { ThemeProvider } from 'styled-components'
import { theme } from '~/features/ui/theme'
import { GlobalStyles } from '~/GlobalStyles'

function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <div>Lunch Splitter</div>
    </ThemeProvider>
  )
}

export default App
```

- [ ] **Step 5: Verify theme renders**

```bash
npm run dev
```

Expected: Dark background, light text showing "Lunch Splitter".

- [ ] **Step 6: Commit**

```bash
git add src/features/ui/theme/index.ts src/features/ui/theme/styled.d.ts src/App.tsx src/GlobalStyles.ts
git commit -m "feat: add styled-components theme and global styles"
```

---

### Task 3: Define Data Types

**Files:**
- Create: `src/features/lunch/types.ts`

- [ ] **Step 1: Create type definitions**

Create `src/features/lunch/types.ts`:

```typescript
export interface FeeAdjustment {
  id: string
  name: string
  amount: number // positive = fee, negative = coupon/discount
}

export interface Item {
  id: string
  name: string
  price: number
  discountPercent: number | null // null = use global discount
  sharedWith: string[] // person IDs who also share this item (excludes owner)
  customShares: Record<string, number> | null // null = equal split, or personId -> pre-discount amount
}

export interface Person {
  id: string
  name: string
  items: Item[]
}

export interface LunchSession {
  globalDiscountPercent: number
  feeAdjustments: FeeAdjustment[]
  people: Person[]
}

export interface PersonSummary {
  personId: string
  name: string
  subtotal: number // raw prices, their share
  afterDiscount: number // after applying discounts
  withFees: number // final amount including fee share
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/lunch/types.ts
git commit -m "feat: define lunch session data types"
```

---

### Task 4: Build Calculation Engine (TDD)

**Files:**
- Create: `src/features/lunch/utils/calculations.ts`
- Create: `src/features/lunch/utils/calculations.test.ts`

- [ ] **Step 1: Write failing tests for basic calculation**

Create `src/features/lunch/utils/calculations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculatePersonSummaries, calculateNetFees, calculateFeePerPerson } from './calculations'
import type { LunchSession } from '../types'

describe('calculateNetFees', () => {
  it('sums positive and negative adjustments', () => {
    const fees = [
      { id: '1', name: 'Service', amount: 30 },
      { id: '2', name: 'Delivery', amount: 39 },
      { id: '3', name: 'Coupon', amount: -25 },
    ]
    expect(calculateNetFees(fees)).toBe(44)
  })

  it('returns 0 for empty fees', () => {
    expect(calculateNetFees([])).toBe(0)
  })
})

describe('calculateFeePerPerson', () => {
  it('splits fees equally among people', () => {
    expect(calculateFeePerPerson(44, 5)).toBeCloseTo(8.8)
  })

  it('returns 0 when no people', () => {
    expect(calculateFeePerPerson(44, 0)).toBe(0)
  })
})

describe('calculatePersonSummaries', () => {
  it('calculates the exampleLunch.txt scenario correctly', () => {
    const session: LunchSession = {
      globalDiscountPercent: 40,
      feeAdjustments: [
        { id: '1', name: 'Service Fee', amount: 30 },
        { id: '2', name: 'Delivery Fee', amount: 39 },
        { id: '3', name: 'Delivery Coupon', amount: -25 },
      ],
      people: [
        {
          id: 'domca', name: 'Domča', items: [
            { id: 'i1', name: 'Grilled roastbeef', price: 164, discountPercent: null, sharedWith: [], customShares: null },
            { id: 'i2', name: 'Pařížská rychlovka', price: 69, discountPercent: null, sharedWith: [], customShares: null },
          ],
        },
        {
          id: 'bary', name: 'Bary', items: [
            { id: 'i3', name: 'Sweet chili', price: 129, discountPercent: null, sharedWith: [], customShares: null },
            { id: 'i4', name: 'Caesar', price: 154, discountPercent: null, sharedWith: [], customShares: null },
          ],
        },
        {
          id: 'ja', name: 'Já', items: [
            { id: 'i5', name: 'Sweet chili', price: 129, discountPercent: null, sharedWith: [], customShares: null },
            { id: 'i6', name: 'Pařížská', price: 139, discountPercent: null, sharedWith: [], customShares: null },
          ],
        },
        {
          id: 'lukas', name: 'Lukáš', items: [
            { id: 'i7', name: 'Caesar menu', price: 292, discountPercent: null, sharedWith: [], customShares: null },
          ],
        },
        {
          id: 'jira', name: 'Jířa', items: [
            { id: 'i8', name: 'Caesar menu', price: 292, discountPercent: null, sharedWith: [], customShares: null },
          ],
        },
      ],
    }

    const summaries = calculatePersonSummaries(session)

    expect(summaries).toHaveLength(5)

    const domca = summaries.find(s => s.personId === 'domca')!
    expect(domca.subtotal).toBe(233)
    expect(domca.afterDiscount).toBeCloseTo(139.8)
    expect(domca.withFees).toBeCloseTo(148.6)

    const bary = summaries.find(s => s.personId === 'bary')!
    expect(bary.subtotal).toBe(283)
    expect(bary.afterDiscount).toBeCloseTo(169.8)
    expect(bary.withFees).toBeCloseTo(178.6)

    const ja = summaries.find(s => s.personId === 'ja')!
    expect(ja.subtotal).toBe(268)
    expect(ja.afterDiscount).toBeCloseTo(160.8)
    expect(ja.withFees).toBeCloseTo(169.6)

    const lukas = summaries.find(s => s.personId === 'lukas')!
    expect(lukas.subtotal).toBe(292)
    expect(lukas.afterDiscount).toBeCloseTo(175.2)
    expect(lukas.withFees).toBeCloseTo(184)

    const jira = summaries.find(s => s.personId === 'jira')!
    expect(jira.subtotal).toBe(292)
    expect(jira.afterDiscount).toBeCloseTo(175.2)
    expect(jira.withFees).toBeCloseTo(184)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/lunch/utils/calculations.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement calculation functions**

Create `src/features/lunch/utils/calculations.ts`:

```typescript
import type { FeeAdjustment, LunchSession, PersonSummary } from '../types'

export function calculateNetFees(feeAdjustments: FeeAdjustment[]): number {
  return feeAdjustments.reduce((sum, fee) => sum + fee.amount, 0)
}

export function calculateFeePerPerson(netFees: number, peopleCount: number): number {
  if (peopleCount === 0) return 0
  return netFees / peopleCount
}

function getEffectiveDiscount(itemDiscount: number | null, globalDiscount: number): number {
  return itemDiscount !== null ? itemDiscount : globalDiscount
}

function getSharerCount(item: { sharedWith: string[] }): number {
  // sharedWith excludes the owner, so total sharers = sharedWith.length + 1 (owner)
  return item.sharedWith.length > 0 ? item.sharedWith.length + 1 : 1
}

export function calculatePersonSummaries(session: LunchSession): PersonSummary[] {
  const { globalDiscountPercent, feeAdjustments, people } = session
  const netFees = calculateNetFees(feeAdjustments)
  const feePerPerson = calculateFeePerPerson(netFees, people.length)

  return people.map((person) => {
    let subtotal = 0
    let afterDiscount = 0

    // Own items
    for (const item of person.items) {
      const discount = getEffectiveDiscount(item.discountPercent, globalDiscountPercent)
      const sharerCount = getSharerCount(item)
      const rawShare = item.price / sharerCount

      if (item.customShares?.[person.id] !== undefined) {
        const customAmount = item.customShares[person.id]
        subtotal += customAmount
        afterDiscount += customAmount * (1 - discount / 100)
      } else {
        subtotal += rawShare
        afterDiscount += rawShare * (1 - discount / 100)
      }
    }

    // Items shared from other people
    for (const otherPerson of people) {
      if (otherPerson.id === person.id) continue
      for (const item of otherPerson.items) {
        if (!item.sharedWith.includes(person.id)) continue

        const discount = getEffectiveDiscount(item.discountPercent, globalDiscountPercent)
        const sharerCount = getSharerCount(item)

        if (item.customShares?.[person.id] !== undefined) {
          const customAmount = item.customShares[person.id]
          subtotal += customAmount
          afterDiscount += customAmount * (1 - discount / 100)
        } else {
          const rawShare = item.price / sharerCount
          subtotal += rawShare
          afterDiscount += rawShare * (1 - discount / 100)
        }
      }
    }

    return {
      personId: person.id,
      name: person.name,
      subtotal,
      afterDiscount,
      withFees: afterDiscount + feePerPerson,
    }
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/lunch/utils/calculations.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/lunch/utils/calculations.ts src/features/lunch/utils/calculations.test.ts
git commit -m "feat: implement calculation engine with tests"
```

---

### Task 5: Add Shared Items & Per-Item Discount Tests

**Files:**
- Modify: `src/features/lunch/utils/calculations.test.ts`

- [ ] **Step 1: Write tests for shared items**

Add to `calculations.test.ts` inside the `describe('calculatePersonSummaries')` block:

```typescript
  it('splits shared items equally among sharers', () => {
    const session: LunchSession = {
      globalDiscountPercent: 0,
      feeAdjustments: [],
      people: [
        {
          id: 'a', name: 'Alice', items: [
            { id: 'i1', name: 'Family Menu', price: 300, discountPercent: null, sharedWith: ['b', 'c'], customShares: null },
          ],
        },
        { id: 'b', name: 'Bob', items: [] },
        { id: 'c', name: 'Charlie', items: [] },
      ],
    }

    const summaries = calculatePersonSummaries(session)

    expect(summaries.find(s => s.personId === 'a')!.subtotal).toBe(100)
    expect(summaries.find(s => s.personId === 'b')!.subtotal).toBe(100)
    expect(summaries.find(s => s.personId === 'c')!.subtotal).toBe(100)
  })

  it('applies per-item discount override instead of global', () => {
    const session: LunchSession = {
      globalDiscountPercent: 40,
      feeAdjustments: [],
      people: [
        {
          id: 'a', name: 'Alice', items: [
            { id: 'i1', name: 'Regular', price: 100, discountPercent: null, sharedWith: [], customShares: null },
            { id: 'i2', name: 'Special', price: 100, discountPercent: 20, sharedWith: [], customShares: null },
          ],
        },
      ],
    }

    const summaries = calculatePersonSummaries(session)
    const alice = summaries.find(s => s.personId === 'a')!

    // Regular: 100 * 0.6 = 60, Special: 100 * 0.8 = 80
    expect(alice.afterDiscount).toBeCloseTo(140)
  })

  it('handles custom shares with discount', () => {
    const session: LunchSession = {
      globalDiscountPercent: 50,
      feeAdjustments: [],
      people: [
        {
          id: 'a', name: 'Alice', items: [
            {
              id: 'i1', name: 'Family Menu', price: 400,
              discountPercent: null,
              sharedWith: ['b'],
              customShares: { a: 250, b: 150 },
            },
          ],
        },
        { id: 'b', name: 'Bob', items: [] },
      ],
    }

    const summaries = calculatePersonSummaries(session)

    // Alice: 250 * 0.5 = 125, Bob: 150 * 0.5 = 75
    expect(summaries.find(s => s.personId === 'a')!.subtotal).toBe(250)
    expect(summaries.find(s => s.personId === 'a')!.afterDiscount).toBeCloseTo(125)
    expect(summaries.find(s => s.personId === 'b')!.subtotal).toBe(150)
    expect(summaries.find(s => s.personId === 'b')!.afterDiscount).toBeCloseTo(75)
  })

  it('handles zero discount', () => {
    const session: LunchSession = {
      globalDiscountPercent: 0,
      feeAdjustments: [],
      people: [
        {
          id: 'a', name: 'Alice', items: [
            { id: 'i1', name: 'Lunch', price: 200, discountPercent: null, sharedWith: [], customShares: null },
          ],
        },
      ],
    }

    const summaries = calculatePersonSummaries(session)
    expect(summaries[0].subtotal).toBe(200)
    expect(summaries[0].afterDiscount).toBe(200)
    expect(summaries[0].withFees).toBe(200)
  })
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/features/lunch/utils/calculations.test.ts
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/lunch/utils/calculations.test.ts
git commit -m "test: add shared items and per-item discount tests"
```

---

### Task 6: Create Formatters

**Files:**
- Create: `src/features/lunch/utils/formatters.ts`
- Create: `src/features/lunch/utils/formatters.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/features/lunch/utils/formatters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatCurrency, formatFeeAmount, generateCopySummary } from './formatters'
import type { LunchSession, PersonSummary } from '../types'

describe('formatCurrency', () => {
  it('formats number to 2 decimal places', () => {
    expect(formatCurrency(139.8)).toBe('139.80')
    expect(formatCurrency(184)).toBe('184.00')
    expect(formatCurrency(8.8)).toBe('8.80')
  })
})

describe('formatFeeAmount', () => {
  it('formats positive as + X', () => {
    expect(formatFeeAmount(30)).toBe('+30')
  })

  it('formats negative as -X', () => {
    expect(formatFeeAmount(-25)).toBe('-25')
  })
})

describe('generateCopySummary', () => {
  it('generates text summary matching expected format', () => {
    const session: LunchSession = {
      globalDiscountPercent: 40,
      feeAdjustments: [
        { id: '1', name: 'Service Fee', amount: 30 },
        { id: '2', name: 'Delivery Fee', amount: 39 },
        { id: '3', name: 'Delivery Coupon', amount: -25 },
      ],
      people: [
        {
          id: 'domca', name: 'Domča', items: [
            { id: 'i1', name: 'Grilled roastbeef', price: 164, discountPercent: null, sharedWith: [], customShares: null },
          ],
        },
      ],
    }

    const summaries: PersonSummary[] = [
      { personId: 'domca', name: 'Domča', subtotal: 164, afterDiscount: 98.4, withFees: 107.2 },
    ]

    const text = generateCopySummary(session, summaries)

    expect(text).toContain('Domča:')
    expect(text).toContain('Grilled roastbeef')
    expect(text).toContain('164')
    expect(text).toContain('Subtotal:')
    expect(text).toContain('After discount:')
    expect(text).toContain('With fees:')
    expect(text).toContain('Discount: 40%')
    expect(text).toContain('Service Fee')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/lunch/utils/formatters.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement formatters**

Create `src/features/lunch/utils/formatters.ts`:

```typescript
import type { LunchSession, PersonSummary } from '../types'
import { calculateNetFees, calculateFeePerPerson } from './calculations'

export function formatCurrency(value: number): string {
  return value.toFixed(2)
}

export function formatFeeAmount(amount: number): string {
  return amount >= 0 ? `+${amount}` : `${amount}`
}

export function generateCopySummary(session: LunchSession, summaries: PersonSummary[]): string {
  const lines: string[] = []

  for (const person of session.people) {
    const summary = summaries.find(s => s.personId === person.id)
    if (!summary) continue

    lines.push(`${person.name}:`)
    for (const item of person.items) {
      const sharerCount = item.sharedWith.length > 0 ? item.sharedWith.length + 1 : 1
      const shareNote = sharerCount > 1 ? ` (1/${sharerCount})` : ''
      lines.push(`  ${item.name}${shareNote}    ${item.price}`)
    }
    // Items shared from other people
    for (const otherPerson of session.people) {
      if (otherPerson.id === person.id) continue
      for (const item of otherPerson.items) {
        if (!item.sharedWith.includes(person.id)) continue
        const sharerCount = item.sharedWith.length + 1
        const share = item.customShares?.[person.id] ?? item.price / sharerCount
        lines.push(`  ${item.name} (from ${otherPerson.name})    ${formatCurrency(share)}`)
      }
    }
    lines.push('  ---------------------------')
    lines.push(`  Subtotal:            ${formatCurrency(summary.subtotal)}`)
    lines.push(`  After discount:      ${formatCurrency(summary.afterDiscount)}`)
    lines.push(`  With fees:           ${formatCurrency(summary.withFees)}`)
    lines.push('')
  }

  if (session.globalDiscountPercent > 0) {
    lines.push(`Discount: ${session.globalDiscountPercent}%`)
  }

  if (session.feeAdjustments.length > 0) {
    lines.push('Fees:')
    for (const fee of session.feeAdjustments) {
      lines.push(`  ${fee.name}: ${formatFeeAmount(fee.amount)}`)
    }
    const netFees = calculateNetFees(session.feeAdjustments)
    const perPerson = calculateFeePerPerson(netFees, session.people.length)
    lines.push(`Fee per person: ${formatCurrency(perPerson)}`)
  }

  return lines.join('\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/lunch/utils/formatters.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/lunch/utils/formatters.ts src/features/lunch/utils/formatters.test.ts
git commit -m "feat: add currency formatters and copy summary generator"
```

---

## Chunk 2: State Management & UI Components

### Task 7: Create Base UI Components

**Files:**
- Create: `src/features/ui/components/Button.tsx`
- Create: `src/features/ui/components/Input.tsx`
- Create: `src/features/ui/components/Card.tsx`
- Create: `src/features/ui/components/SectionTitle.tsx`

- [ ] **Step 1: Create Button component**

Create `src/features/ui/components/Button.tsx`:

```typescript
import styled, { css } from 'styled-components'

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

export const Button = styled.button<ButtonProps>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s ease;

  ${({ size = 'md', theme }) =>
    size === 'sm'
      ? css`
          padding: ${theme.spacing.xs} ${theme.spacing.sm};
          font-size: ${theme.fontSizes.sm};
        `
      : css`
          padding: ${theme.spacing.sm} ${theme.spacing.md};
          font-size: ${theme.fontSizes.md};
        `}

  ${({ variant = 'primary', theme }) => {
    switch (variant) {
      case 'primary':
        return css`
          background: ${theme.colors.primary};
          color: ${theme.colors.background};
          &:hover { opacity: 0.9; }
        `
      case 'secondary':
        return css`
          background: transparent;
          border-color: ${theme.colors.border};
          color: ${theme.colors.secondary};
          &:hover { border-color: ${theme.colors.secondary}; }
        `
      case 'danger':
        return css`
          background: transparent;
          color: ${theme.colors.negative};
          &:hover { background: rgba(255, 83, 112, 0.1); }
        `
      case 'ghost':
        return css`
          background: transparent;
          color: ${theme.colors.textMuted};
          &:hover { color: ${theme.colors.text}; }
        `
    }
  }}
`
```

- [ ] **Step 2: Create Input component**

Create `src/features/ui/components/Input.tsx`:

```typescript
import styled from 'styled-components'

export const Input = styled.input`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.text};
  padding: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.md};
  width: 100%;
  transition: border-color 0.15s ease;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textDim};
  }
`

export const NumberInput = styled(Input).attrs({ type: 'number' })`
  width: 80px;
  text-align: right;

  /* Hide spinner arrows */
  -moz-appearance: textfield;
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`
```

- [ ] **Step 3: Create Card component**

Create `src/features/ui/components/Card.tsx`:

```typescript
import styled from 'styled-components'

export const Card = styled.div`
  background: ${({ theme }) => theme.colors.cardBackground};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`

export const CardTitle = styled.h3`
  color: ${({ theme }) => theme.colors.accent};
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: ${({ theme }) => theme.typography.heading.fontWeight};
`
```

- [ ] **Step 4: Create SectionTitle component**

Create `src/features/ui/components/SectionTitle.tsx`:

```typescript
import styled from 'styled-components'

export const SectionTitle = styled.h2`
  color: ${({ theme }) => theme.colors.secondary};
  font-size: ${({ theme }) => theme.fontSizes.lg};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`
```

- [ ] **Step 5: Commit**

```bash
git add src/features/ui/components/
git commit -m "feat: add base UI components (Button, Input, Card)"
```

---

### Task 8: Create useLunchSession Hook

**Files:**
- Create: `src/features/lunch/hooks/useLunchSession.ts`

- [ ] **Step 1: Create the main state hook**

Create `src/features/lunch/hooks/useLunchSession.ts`:

```typescript
import { useState, useCallback } from 'react'
import type { LunchSession, Person, Item, FeeAdjustment } from '../types'

function generateId(): string {
  return crypto.randomUUID()
}

const initialSession: LunchSession = {
  globalDiscountPercent: 0,
  feeAdjustments: [],
  people: [],
}

export function useLunchSession() {
  const [session, setSession] = useState<LunchSession>(initialSession)

  const setGlobalDiscount = useCallback((percent: number) => {
    setSession(prev => ({ ...prev, globalDiscountPercent: percent }))
  }, [])

  const addFeeAdjustment = useCallback((name: string, amount: number) => {
    const fee: FeeAdjustment = { id: generateId(), name, amount }
    setSession(prev => ({
      ...prev,
      feeAdjustments: [...prev.feeAdjustments, fee],
    }))
  }, [])

  const updateFeeAdjustment = useCallback((id: string, updates: Partial<Omit<FeeAdjustment, 'id'>>) => {
    setSession(prev => ({
      ...prev,
      feeAdjustments: prev.feeAdjustments.map(f =>
        f.id === id ? { ...f, ...updates } : f
      ),
    }))
  }, [])

  const removeFeeAdjustment = useCallback((id: string) => {
    setSession(prev => ({
      ...prev,
      feeAdjustments: prev.feeAdjustments.filter(f => f.id !== id),
    }))
  }, [])

  const addPerson = useCallback((name: string) => {
    const person: Person = { id: generateId(), name, items: [] }
    setSession(prev => ({
      ...prev,
      people: [...prev.people, person],
    }))
  }, [])

  const removePerson = useCallback((personId: string) => {
    setSession(prev => ({
      ...prev,
      people: prev.people
        .filter(p => p.id !== personId)
        .map(p => ({
          ...p,
          items: p.items.map(item => ({
            ...item,
            sharedWith: item.sharedWith.filter(id => id !== personId),
            customShares: item.customShares
              ? (() => {
                  const filtered = Object.fromEntries(Object.entries(item.customShares!).filter(([id]) => id !== personId))
                  return Object.keys(filtered).length > 0 ? filtered : null
                })()
              : null,
          })),
        })),
    }))
  }, [])

  const updatePersonName = useCallback((personId: string, name: string) => {
    setSession(prev => ({
      ...prev,
      people: prev.people.map(p =>
        p.id === personId ? { ...p, name } : p
      ),
    }))
  }, [])

  const addItem = useCallback((personId: string, name: string, price: number) => {
    const item: Item = {
      id: generateId(),
      name,
      price,
      discountPercent: null,
      sharedWith: [],
      customShares: null,
    }
    setSession(prev => ({
      ...prev,
      people: prev.people.map(p =>
        p.id === personId ? { ...p, items: [...p.items, item] } : p
      ),
    }))
  }, [])

  const updateItem = useCallback((personId: string, itemId: string, updates: Partial<Omit<Item, 'id'>>) => {
    setSession(prev => ({
      ...prev,
      people: prev.people.map(p =>
        p.id === personId
          ? {
              ...p,
              items: p.items.map(i =>
                i.id === itemId ? { ...i, ...updates } : i
              ),
            }
          : p
      ),
    }))
  }, [])

  const removeItem = useCallback((personId: string, itemId: string) => {
    setSession(prev => ({
      ...prev,
      people: prev.people.map(p =>
        p.id === personId
          ? { ...p, items: p.items.filter(i => i.id !== itemId) }
          : p
      ),
    }))
  }, [])

  return {
    session,
    setGlobalDiscount,
    addFeeAdjustment,
    updateFeeAdjustment,
    removeFeeAdjustment,
    addPerson,
    removePerson,
    updatePersonName,
    addItem,
    updateItem,
    removeItem,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/lunch/hooks/useLunchSession.ts
git commit -m "feat: add useLunchSession state management hook"
```

---

### Task 9: Create useCalculation Hook

**Files:**
- Create: `src/features/lunch/hooks/useCalculation.ts`

- [ ] **Step 1: Create derived calculation hook**

Create `src/features/lunch/hooks/useCalculation.ts`:

```typescript
import { useMemo } from 'react'
import type { LunchSession, PersonSummary } from '../types'
import { calculatePersonSummaries, calculateNetFees, calculateFeePerPerson } from '../utils/calculations'

interface CalculationResult {
  summaries: PersonSummary[]
  netFees: number
  feePerPerson: number
  grandTotal: number
}

export function useCalculation(session: LunchSession): CalculationResult {
  return useMemo(() => {
    const summaries = calculatePersonSummaries(session)
    const netFees = calculateNetFees(session.feeAdjustments)
    const feePerPerson = calculateFeePerPerson(netFees, session.people.length)
    const grandTotal = summaries.reduce((sum, s) => sum + s.withFees, 0)

    return { summaries, netFees, feePerPerson, grandTotal }
  }, [session])
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/lunch/hooks/useCalculation.ts
git commit -m "feat: add useCalculation derived state hook"
```

---

### Task 10: Build OrderSettings Component

**Files:**
- Create: `src/features/lunch/components/OrderSettings.tsx`

- [ ] **Step 1: Create OrderSettings component**

Create `src/features/lunch/components/OrderSettings.tsx`:

```typescript
import { useState } from 'react'
import styled from 'styled-components'
import { Card } from '~/features/ui/components/Card'
import { Input, NumberInput } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { formatCurrency } from '../utils/formatters'
import type { FeeAdjustment } from '../types'

const SettingsRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`

const Label = styled.label`
  color: ${({ theme }) => theme.colors.text};
  min-width: 140px;
`

const FeeRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`

const NetFeesDisplay = styled.div`
  margin-top: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.warning};
  font-weight: 500;
`

const AddFeeRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`

interface OrderSettingsProps {
  globalDiscountPercent: number
  feeAdjustments: FeeAdjustment[]
  netFees: number
  feePerPerson: number
  peopleCount: number
  onSetGlobalDiscount: (percent: number) => void
  onAddFee: (name: string, amount: number) => void
  onUpdateFee: (id: string, updates: Partial<Omit<FeeAdjustment, 'id'>>) => void
  onRemoveFee: (id: string) => void
}

export function OrderSettings({
  globalDiscountPercent,
  feeAdjustments,
  netFees,
  feePerPerson,
  peopleCount,
  onSetGlobalDiscount,
  onAddFee,
  onUpdateFee,
  onRemoveFee,
}: OrderSettingsProps) {
  const [newFeeName, setNewFeeName] = useState('')
  const [newFeeAmount, setNewFeeAmount] = useState('')

  const handleAddFee = () => {
    const amount = parseFloat(newFeeAmount)
    if (newFeeName.trim() && !isNaN(amount)) {
      onAddFee(newFeeName.trim(), amount)
      setNewFeeName('')
      setNewFeeAmount('')
    }
  }

  const handleAddFeeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddFee()
  }

  return (
    <Card>
      <SectionTitle>Order Settings</SectionTitle>

      <SettingsRow>
        <Label>Global Discount</Label>
        <NumberInput
          value={globalDiscountPercent || ''}
          onChange={e => onSetGlobalDiscount(parseFloat(e.target.value) || 0)}
          placeholder="0"
          min={0}
          max={100}
          style={{ width: '60px' }}
        />
        <span>%</span>
      </SettingsRow>

      <SectionTitle style={{ fontSize: '1rem', marginTop: '16px' }}>
        Fees & Adjustments
      </SectionTitle>

      {feeAdjustments.map(fee => (
        <FeeRow key={fee.id}>
          <Input
            value={fee.name}
            onChange={e => onUpdateFee(fee.id, { name: e.target.value })}
            style={{ flex: 1 }}
          />
          <NumberInput
            value={fee.amount || ''}
            onChange={e => onUpdateFee(fee.id, { amount: parseFloat(e.target.value) || 0 })}
            style={{ width: '100px' }}
          />
          <span style={{ minWidth: '32px' }}>CZK</span>
          <Button variant="danger" size="sm" onClick={() => onRemoveFee(fee.id)}>
            ✕
          </Button>
        </FeeRow>
      ))}

      <AddFeeRow>
        <Input
          value={newFeeName}
          onChange={e => setNewFeeName(e.target.value)}
          placeholder="Fee name"
          onKeyDown={handleAddFeeKeyDown}
          style={{ flex: 1 }}
        />
        <NumberInput
          value={newFeeAmount}
          onChange={e => setNewFeeAmount(e.target.value)}
          placeholder="±amount"
          onKeyDown={handleAddFeeKeyDown}
          style={{ width: '100px' }}
        />
        <Button variant="secondary" size="sm" onClick={handleAddFee}>
          + Add
        </Button>
      </AddFeeRow>

      {feeAdjustments.length > 0 && (
        <NetFeesDisplay>
          Net Fees: {formatCurrency(netFees)} CZK
          {peopleCount > 0 && ` (${formatCurrency(feePerPerson)} / person)`}
        </NetFeesDisplay>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/lunch/components/OrderSettings.tsx
git commit -m "feat: add OrderSettings component with dynamic fees"
```

---

### Task 11: Build ItemRow Component

**Files:**
- Create: `src/features/lunch/components/ItemRow.tsx`

- [ ] **Step 1: Create ItemRow component**

Create `src/features/lunch/components/ItemRow.tsx`:

```typescript
import { useState } from 'react'
import styled from 'styled-components'
import { NumberInput } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import type { Item, Person } from '../types'

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:last-of-type {
    border-bottom: none;
  }
`

const ItemName = styled.span`
  flex: 1;
  color: ${({ theme }) => theme.colors.text};
`

const ItemPrice = styled.span`
  color: ${({ theme }) => theme.colors.positive};
  min-width: 70px;
  text-align: right;
`

const DiscountBadge = styled.button<{ $custom: boolean }>`
  background: ${({ $custom, theme }) => $custom ? 'rgba(199, 146, 234, 0.15)' : 'rgba(84, 110, 122, 0.2)'};
  color: ${({ $custom, theme }) => $custom ? theme.colors.accent : theme.colors.textDim};
  border: 1px solid ${({ $custom, theme }) => $custom ? theme.colors.accent : 'transparent'};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: 2px 6px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }
`

const SharedBadge = styled.div`
  color: ${({ theme }) => theme.colors.secondary};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  margin-top: 2px;
`

const ShareSelector = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
`

const ShareOption = styled.button<{ $selected: boolean }>`
  background: ${({ $selected, theme }) => $selected ? theme.colors.secondary : 'transparent'};
  color: ${({ $selected, theme }) => $selected ? theme.colors.background : theme.colors.textMuted};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: 2px 8px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  cursor: pointer;
`

const ItemDetails = styled.div`
  flex: 1;
`

interface ItemRowProps {
  item: Item
  globalDiscountPercent: number
  allPeople: Person[]
  ownerId: string
  onUpdate: (updates: Partial<Omit<Item, 'id'>>) => void
  onRemove: () => void
}

export function ItemRow({ item, globalDiscountPercent, allPeople, ownerId, onUpdate, onRemove }: ItemRowProps) {
  const [editingDiscount, setEditingDiscount] = useState(false)
  const [showShareSelector, setShowShareSelector] = useState(false)

  const effectiveDiscount = item.discountPercent !== null ? item.discountPercent : globalDiscountPercent
  const isCustomDiscount = item.discountPercent !== null
  const otherPeople = allPeople.filter(p => p.id !== ownerId)
  const sharerCount = item.sharedWith.length > 0 ? item.sharedWith.length + 1 : 1
  const shareAmount = item.price / sharerCount

  const handleDiscountClick = () => {
    if (editingDiscount) return
    setEditingDiscount(true)
  }

  const handleDiscountChange = (value: string) => {
    const num = parseFloat(value)
    if (value === '' || value === 'global') {
      onUpdate({ discountPercent: null })
      setEditingDiscount(false)
    } else if (!isNaN(num)) {
      onUpdate({ discountPercent: num })
    }
  }

  const handleDiscountBlur = () => {
    setEditingDiscount(false)
  }

  const toggleShare = (personId: string) => {
    const newSharedWith = item.sharedWith.includes(personId)
      ? item.sharedWith.filter(id => id !== personId)
      : [...item.sharedWith, personId]
    onUpdate({ sharedWith: newSharedWith })
  }

  return (
    <div>
      <Row>
        <ItemDetails>
          <ItemName>{item.name}</ItemName>
          {item.sharedWith.length > 0 && (
            <SharedBadge>
              Shared with: {item.sharedWith.map(id => allPeople.find(p => p.id === id)?.name).filter(Boolean).join(', ')}
              {' '}(your share: {shareAmount.toFixed(2)} CZK)
            </SharedBadge>
          )}
        </ItemDetails>
        <ItemPrice>{item.price} CZK</ItemPrice>
        {editingDiscount ? (
          <NumberInput
            autoFocus
            defaultValue={item.discountPercent ?? ''}
            placeholder="global"
            onBlur={handleDiscountBlur}
            onChange={e => handleDiscountChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleDiscountBlur()
              if (e.key === 'Escape') {
                onUpdate({ discountPercent: null })
                setEditingDiscount(false)
              }
            }}
            style={{ width: '60px' }}
            min={0}
            max={100}
          />
        ) : (
          <DiscountBadge $custom={isCustomDiscount} onClick={handleDiscountClick}>
            {isCustomDiscount ? `${effectiveDiscount}%` : `global ${effectiveDiscount}%`}
          </DiscountBadge>
        )}
        <Button variant="ghost" size="sm" onClick={() => setShowShareSelector(!showShareSelector)}>
          {showShareSelector ? '▲' : '👥'}
        </Button>
        <Button variant="danger" size="sm" onClick={onRemove}>✕</Button>
      </Row>
      {showShareSelector && otherPeople.length > 0 && (
        <ShareSelector>
          {otherPeople.map(p => (
            <ShareOption
              key={p.id}
              $selected={item.sharedWith.includes(p.id)}
              onClick={() => toggleShare(p.id)}
            >
              {p.name}
            </ShareOption>
          ))}
        </ShareSelector>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/lunch/components/ItemRow.tsx
git commit -m "feat: add ItemRow component with discount and sharing controls"
```

---

### Task 12: Build SharedItemRef Component

**Files:**
- Create: `src/features/lunch/components/SharedItemRef.tsx`

- [ ] **Step 1: Create SharedItemRef component**

Create `src/features/lunch/components/SharedItemRef.tsx`:

```typescript
import styled from 'styled-components'
import type { Item, Person } from '../types'

const RefRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} 0;
  opacity: 0.7;
`

const LinkIcon = styled.span`
  color: ${({ theme }) => theme.colors.secondary};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const RefName = styled.span`
  flex: 1;
  color: ${({ theme }) => theme.colors.secondary};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const RefShare = styled.span`
  color: ${({ theme }) => theme.colors.textDim};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

interface SharedItemRefProps {
  item: Item
  owner: Person
  personId: string
}

export function SharedItemRef({ item, owner, personId }: SharedItemRefProps) {
  const sharerCount = item.sharedWith.length + 1
  const share = item.customShares?.[personId] ?? item.price / sharerCount

  return (
    <RefRow>
      <LinkIcon>🔗</LinkIcon>
      <RefName>{item.name} (from {owner.name})</RefName>
      <RefShare>your share: {share.toFixed(2)} CZK</RefShare>
    </RefRow>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/lunch/components/SharedItemRef.tsx
git commit -m "feat: add SharedItemRef component for linked shared items"
```

---

### Task 13: Build PersonCard Component

**Files:**
- Create: `src/features/lunch/components/PersonCard.tsx`

- [ ] **Step 1: Create PersonCard component**

Create `src/features/lunch/components/PersonCard.tsx`:

```typescript
import { useState } from 'react'
import styled from 'styled-components'
import { Card, CardHeader, CardTitle } from '~/features/ui/components/Card'
import { Input, NumberInput } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { ItemRow } from './ItemRow'
import { SharedItemRef } from './SharedItemRef'
import type { Item, Person, PersonSummary } from '../types'
import { formatCurrency } from '../utils/formatters'

const PersonSubtotals = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: 1px dashed ${({ theme }) => theme.colors.border};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const SubtotalItem = styled.span<{ $highlight?: boolean }>`
  color: ${({ $highlight, theme }) => $highlight ? theme.colors.warning : theme.colors.textDim};
`

const AddItemRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`

interface PersonCardProps {
  person: Person
  allPeople: Person[]
  summary: PersonSummary | undefined
  globalDiscountPercent: number
  onRemovePerson: () => void
  onUpdateName: (name: string) => void
  onAddItem: (name: string, price: number) => void
  onUpdateItem: (itemId: string, updates: Partial<Omit<Item, 'id'>>) => void
  onRemoveItem: (itemId: string) => void
}

export function PersonCard({
  person,
  allPeople,
  summary,
  globalDiscountPercent,
  onRemovePerson,
  onUpdateName,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: PersonCardProps) {
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [editingName, setEditingName] = useState(false)

  const handleAddItem = () => {
    const price = parseFloat(newItemPrice)
    if (newItemName.trim() && !isNaN(price) && price > 0) {
      onAddItem(newItemName.trim(), price)
      setNewItemName('')
      setNewItemPrice('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddItem()
  }

  // Find items shared from other people to this person
  const sharedFromOthers = allPeople
    .filter(p => p.id !== person.id)
    .flatMap(p =>
      p.items
        .filter(item => item.sharedWith.includes(person.id))
        .map(item => ({ item, owner: p }))
    )

  return (
    <Card>
      <CardHeader>
        {editingName ? (
          <Input
            autoFocus
            defaultValue={person.name}
            onBlur={e => {
              onUpdateName(e.target.value)
              setEditingName(false)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onUpdateName((e.target as HTMLInputElement).value)
                setEditingName(false)
              }
            }}
            style={{ maxWidth: '200px' }}
          />
        ) : (
          <CardTitle onClick={() => setEditingName(true)} style={{ cursor: 'pointer' }}>
            {person.name}
          </CardTitle>
        )}
        <Button variant="danger" size="sm" onClick={onRemovePerson}>✕</Button>
      </CardHeader>

      {person.items.map(item => (
        <ItemRow
          key={item.id}
          item={item}
          globalDiscountPercent={globalDiscountPercent}
          allPeople={allPeople}
          ownerId={person.id}
          onUpdate={updates => onUpdateItem(item.id, updates)}
          onRemove={() => onRemoveItem(item.id)}
        />
      ))}

      {sharedFromOthers.map(({ item, owner }) => (
        <SharedItemRef
          key={`shared-${item.id}`}
          item={item}
          owner={owner}
          personId={person.id}
        />
      ))}

      <AddItemRow>
        <Input
          value={newItemName}
          onChange={e => setNewItemName(e.target.value)}
          placeholder="Item name"
          onKeyDown={handleKeyDown}
          style={{ flex: 1 }}
        />
        <NumberInput
          value={newItemPrice}
          onChange={e => setNewItemPrice(e.target.value)}
          placeholder="Price"
          onKeyDown={handleKeyDown}
          min={0}
        />
        <Button variant="secondary" size="sm" onClick={handleAddItem}>
          + Add
        </Button>
      </AddItemRow>

      {summary && (
        <PersonSubtotals>
          <SubtotalItem>Subtotal: {formatCurrency(summary.subtotal)}</SubtotalItem>
          <SubtotalItem>After discount: {formatCurrency(summary.afterDiscount)}</SubtotalItem>
          <SubtotalItem $highlight>With fees: {formatCurrency(summary.withFees)}</SubtotalItem>
        </PersonSubtotals>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/lunch/components/PersonCard.tsx
git commit -m "feat: add PersonCard component with items and shared references"
```

---

### Task 14: Build PeopleSection Component

**Files:**
- Create: `src/features/lunch/components/PeopleSection.tsx`

- [ ] **Step 1: Create PeopleSection component**

Create `src/features/lunch/components/PeopleSection.tsx`:

```typescript
import { useState } from 'react'
import styled from 'styled-components'
import { Input } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { PersonCard } from './PersonCard'
import type { Person, Item, PersonSummary } from '../types'

const AddPersonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.md};
`

interface PeopleSectionProps {
  people: Person[]
  summaries: PersonSummary[]
  globalDiscountPercent: number
  onAddPerson: (name: string) => void
  onRemovePerson: (personId: string) => void
  onUpdatePersonName: (personId: string, name: string) => void
  onAddItem: (personId: string, name: string, price: number) => void
  onUpdateItem: (personId: string, itemId: string, updates: Partial<Omit<Item, 'id'>>) => void
  onRemoveItem: (personId: string, itemId: string) => void
}

export function PeopleSection({
  people,
  summaries,
  globalDiscountPercent,
  onAddPerson,
  onRemovePerson,
  onUpdatePersonName,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: PeopleSectionProps) {
  const [newPersonName, setNewPersonName] = useState('')

  const handleAddPerson = () => {
    if (newPersonName.trim()) {
      onAddPerson(newPersonName.trim())
      setNewPersonName('')
    }
  }

  return (
    <div>
      <SectionTitle>People & Orders</SectionTitle>

      {people.map(person => (
        <PersonCard
          key={person.id}
          person={person}
          allPeople={people}
          summary={summaries.find(s => s.personId === person.id)}
          globalDiscountPercent={globalDiscountPercent}
          onRemovePerson={() => onRemovePerson(person.id)}
          onUpdateName={name => onUpdatePersonName(person.id, name)}
          onAddItem={(name, price) => onAddItem(person.id, name, price)}
          onUpdateItem={(itemId, updates) => onUpdateItem(person.id, itemId, updates)}
          onRemoveItem={itemId => onRemoveItem(person.id, itemId)}
        />
      ))}

      <AddPersonRow>
        <Input
          value={newPersonName}
          onChange={e => setNewPersonName(e.target.value)}
          placeholder="Person name"
          onKeyDown={e => {
            if (e.key === 'Enter') handleAddPerson()
          }}
          style={{ flex: 1, maxWidth: '300px' }}
        />
        <Button variant="primary" onClick={handleAddPerson}>
          + Add Person
        </Button>
      </AddPersonRow>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/lunch/components/PeopleSection.tsx
git commit -m "feat: add PeopleSection component"
```

- [ ] **Step 3: Verify all Chunk 2 files compile**

```bash
npx tsc --noEmit
```

Expected: No TypeScript errors. If errors appear, fix imports/types before proceeding.

---

## Chunk 3: Summary, Integration & Verification

### Task 15: Build Summary Component

**Files:**
- Create: `src/features/lunch/components/Summary.tsx`

- [ ] **Step 1: Create Summary component**

Create `src/features/lunch/components/Summary.tsx`:

```typescript
import styled from 'styled-components'
import { Card } from '~/features/ui/components/Card'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { formatCurrency } from '../utils/formatters'
import type { PersonSummary } from '../types'

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`

const Th = styled.th`
  text-align: left;
  padding: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:not(:first-child) {
    text-align: right;
  }
`

const Td = styled.td`
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:not(:first-child) {
    text-align: right;
  }
`

const TotalTd = styled(Td)`
  border-bottom: none;
  border-top: 2px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;
`

const FinalAmount = styled(Td)`
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;
`

interface SummaryProps {
  summaries: PersonSummary[]
  grandTotal: number
}

export function Summary({ summaries, grandTotal }: SummaryProps) {
  if (summaries.length === 0) return null

  return (
    <Card>
      <SectionTitle>Summary</SectionTitle>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Subtotal</Th>
            <Th>After Discount</Th>
            <Th>With Fees</Th>
          </tr>
        </thead>
        <tbody>
          {summaries.map(s => (
            <tr key={s.personId}>
              <Td>{s.name}</Td>
              <Td>{formatCurrency(s.subtotal)}</Td>
              <Td>{formatCurrency(s.afterDiscount)}</Td>
              <FinalAmount>{formatCurrency(s.withFees)}</FinalAmount>
            </tr>
          ))}
          <tr>
            <TotalTd>Total</TotalTd>
            <TotalTd />
            <TotalTd />
            <TotalTd>{formatCurrency(grandTotal)}</TotalTd>
          </tr>
        </tbody>
      </Table>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/lunch/components/Summary.tsx
git commit -m "feat: add Summary table component"
```

---

### Task 16: Build CopySummary Component

**Files:**
- Create: `src/features/lunch/components/CopySummary.tsx`

- [ ] **Step 1: Create CopySummary component**

Create `src/features/lunch/components/CopySummary.tsx`:

```typescript
import { useState } from 'react'
import styled from 'styled-components'
import { Button } from '~/features/ui/components/Button'
import { generateCopySummary } from '../utils/formatters'
import type { LunchSession, PersonSummary } from '../types'

const Wrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${({ theme }) => theme.spacing.md};
`

interface CopySummaryProps {
  session: LunchSession
  summaries: PersonSummary[]
}

export function CopySummary({ session, summaries }: CopySummaryProps) {
  const [copied, setCopied] = useState(false)

  if (summaries.length === 0) return null

  const handleCopy = async () => {
    const text = generateCopySummary(session, summaries)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text in a temporary textarea
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Wrapper>
      <Button variant="primary" onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy Summary'}
      </Button>
    </Wrapper>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/lunch/components/CopySummary.tsx
git commit -m "feat: add CopySummary component with clipboard copy"
```

---

### Task 17: Wire Everything Together in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Integrate all components into App.tsx**

Replace `src/App.tsx` with:

```typescript
import styled, { ThemeProvider } from 'styled-components'
import { theme } from '~/features/ui/theme'
import { GlobalStyles } from '~/GlobalStyles'
import { useLunchSession } from '~/features/lunch/hooks/useLunchSession'
import { useCalculation } from '~/features/lunch/hooks/useCalculation'
import { OrderSettings } from '~/features/lunch/components/OrderSettings'
import { PeopleSection } from '~/features/lunch/components/PeopleSection'
import { Summary } from '~/features/lunch/components/Summary'
import { CopySummary } from '~/features/lunch/components/CopySummary'

const AppContainer = styled.div`
  max-width: 700px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
`

const Header = styled.h1`
  text-align: center;
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.fontSizes.xxl};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  font-weight: ${({ theme }) => theme.typography.heading.fontWeight};
`

function App() {
  const {
    session,
    setGlobalDiscount,
    addFeeAdjustment,
    updateFeeAdjustment,
    removeFeeAdjustment,
    addPerson,
    removePerson,
    updatePersonName,
    addItem,
    updateItem,
    removeItem,
  } = useLunchSession()

  const { summaries, netFees, feePerPerson, grandTotal } = useCalculation(session)

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <AppContainer>
        <Header>Lunch Splitter</Header>

        <OrderSettings
          globalDiscountPercent={session.globalDiscountPercent}
          feeAdjustments={session.feeAdjustments}
          netFees={netFees}
          feePerPerson={feePerPerson}
          peopleCount={session.people.length}
          onSetGlobalDiscount={setGlobalDiscount}
          onAddFee={addFeeAdjustment}
          onUpdateFee={updateFeeAdjustment}
          onRemoveFee={removeFeeAdjustment}
        />

        <PeopleSection
          people={session.people}
          summaries={summaries}
          globalDiscountPercent={session.globalDiscountPercent}
          onAddPerson={addPerson}
          onRemovePerson={removePerson}
          onUpdatePersonName={updatePersonName}
          onAddItem={addItem}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
        />

        <Summary summaries={summaries} grandTotal={grandTotal} />

        <CopySummary session={session} summaries={summaries} />
      </AppContainer>
    </ThemeProvider>
  )
}

export default App
```

- [ ] **Step 2: Verify app renders**

```bash
npm run dev
```

Expected: Full app layout visible with all sections. Can add people, items, fees. Summary updates live.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate all components into App"
```

---

### Task 18: Clean Up Vite Defaults

**Files:**
- Delete: `src/App.css`
- Delete: `src/index.css`
- Delete: `src/assets/react.svg`
- Modify: `src/main.tsx`

- [ ] **Step 1: Remove default CSS files and unused assets**

```bash
rm -f src/App.css src/index.css src/assets/react.svg public/vite.svg
rmdir src/assets 2>/dev/null || true
```

- [ ] **Step 2: Update main.tsx to remove default CSS import**

Update `src/main.tsx` to:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: Verify app still works**

```bash
npm run dev
```

Expected: App works as before, no console errors about missing CSS files.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx
git rm --cached src/App.css src/index.css src/assets/react.svg 2>/dev/null || true
git commit -m "chore: remove vite default CSS files and unused assets"
```

---

### Task 19: End-to-End Verification

**Files:** None (manual testing)

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All calculation and formatter tests pass.

- [ ] **Step 2: Run dev server and verify full flow**

```bash
npm run dev
```

Manual verification checklist:
1. Add 5 people: Domča, Bary, Já, Lukáš, Jířa
2. Add items per the `exampleLunch.txt` data
3. Set global discount to 40%
4. Add fees: Service Fee +30, Delivery Fee +39, Delivery Coupon -25
5. Verify summary shows:
   - Domča: 233.00 → 139.80 → 148.60
   - Bary: 283.00 → 169.80 → 178.60
   - Já: 268.00 → 160.80 → 169.60
   - Lukáš: 292.00 → 175.20 → 184.00
   - Jířa: 292.00 → 175.20 → 184.00
6. Click "Copy Summary" and verify clipboard content
7. Test shared item: reset discount to 0%, add a "Family Menu" at 300 CZK under Domča, share with Bary — verify subtotal shows 150.00 each
8. Test per-item discount: set global discount to 40%, click discount badge on one item, change to 20%, verify that item uses 20% while others use 40%

- [ ] **Step 3: Build for production**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors. Output in `dist/` folder.

- [ ] **Step 4: Commit any fixes if needed**

Only if verification revealed issues.
