# Phase 1: Next.js Migration + PostgreSQL + Auth

**Date:** 2026-03-12
**Status:** Approved

## Context

The lunchSplitter app is a Vite + React SPA with no backend, database, or auth. All data is ephemeral (lost on refresh). The goal is to migrate to Next.js on Vercel with PostgreSQL to enable:
- Persistent order history with restaurant tracking
- Item suggestions from past orders at the same restaurant
- Collaborative real-time ordering (Phase 2)
- User accounts with roles (Phase 1 foundation)
- QR Platba payment codes (future)

Phase 1 covers: **Next.js migration + PostgreSQL + Prisma + NextAuth + basic order CRUD + admin user management**.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 App Router |
| ORM | Prisma |
| Database | Vercel Postgres (Neon) |
| Auth | NextAuth.js v5 (Auth.js) with Credentials provider |
| Password hashing | bcryptjs |
| Data fetching | TanStack Query (React Query) |
| Mutations | Next.js Server Actions |
| Styling | styled-components (existing, with SSR registry) |
| Forms | react-hook-form + zod (existing) |
| Testing | Vitest (existing, standalone config) |

## Database Schema

### Restaurant
- `id` (cuid, PK)
- `name` (String, unique, case-insensitive)
- `createdAt` (DateTime)

### User
- `id` (cuid, PK)
- `username` (String, unique)
- `passwordHash` (String)
- `displayName` (String)
- `bankAccountNumber` (String, optional — for future QR Platba)
- `role` (Enum: ADMIN, USER)
- `isFirstLogin` (Boolean, default true)
- `createdAt`, `updatedAt`

### Order
- `id` (cuid, PK)
- `restaurantId` → Restaurant
- `globalDiscountPercent` (Float, default 0)
- `createdById` → User
- `createdAt`, `updatedAt`

### FeeAdjustment
- `id` (cuid, PK)
- `name` (String), `amount` (Float), `sortOrder` (Int)
- `orderId` → Order (cascade delete)

### OrderPerson
- `id` (cuid, PK)
- `name` (String), `sortOrder` (Int)
- `orderId` → Order (cascade delete)

### OrderItem
- `id` (cuid, PK)
- `name` (String), `price` (Float), `discountPercent` (Float, nullable)
- `personId` → OrderPerson (cascade delete)
- `sortOrder` (Int)

### SharedItemLink (join table)
- `id` (cuid, PK)
- `itemId` → OrderItem (cascade delete)
- `personId` → OrderPerson (cascade delete)
- Unique constraint: (itemId, personId)

### CustomShare (join table)
- `id` (cuid, PK)
- `itemId` → OrderItem (cascade delete)
- `personId` → OrderPerson (cascade delete)
- `amount` (Float)
- Unique constraint: (itemId, personId)

### Design Decisions
- `sharedWith` (string array) → normalized `SharedItemLink` join table for referential integrity
- `customShares` (Record) → normalized `CustomShare` table
- `sortOrder` fields preserve display ordering — populated from array indices on save, used for `orderBy` on load
- Client-generated UUIDs used as Prisma IDs to avoid needing server-assigned IDs and post-save ID reconciliation
- Mapper layer (`src/lib/mappers.ts`) converts between Prisma relational shape and flat `LunchSession` interface, keeping pure calculation utils unchanged
- Restaurant table normalizes restaurant names and enables autocomplete + item suggestion queries
- `Float` used for monetary values (`price`, `amount`) — acceptable for Phase 1 since all calculations happen client-side in JavaScript. Consider `Decimal` if server-side calculations are added later.
- `saveOrder` uses "delete all children + recreate" strategy — acceptable for Phase 1 since no external systems reference child entity IDs. Phase 2 (collaborative editing) will require switching to a proper upsert/diff strategy.

## Auth Flow

### Invite-Based Account Creation
1. Admin navigates to `/admin/users`
2. Fills in: username, displayName, role (ADMIN/USER)
3. System generates random temporary password, hashes with bcryptjs
4. Creates User with `isFirstLogin: true`
5. Admin communicates credentials to user out-of-band

### First Login
1. User enters username + temporary password at `/login`
2. NextAuth verifies, creates session
3. Middleware detects `isFirstLogin: true` → redirects to `/setup-password`
4. User sets new password → `isFirstLogin = false`
5. Redirected to `/orders`

### Route Protection (Middleware)
- `/orders/*`, `/admin/*` → require authenticated session
- `/admin/*` → requires ADMIN role
- `isFirstLogin` users → forced to `/setup-password`
- Unauthenticated → redirected to `/login`
- Auth config split: `auth.config.ts` (edge-safe) + `auth.ts` (Node.js with Prisma)

### Seed
- `prisma/seed.ts` creates initial admin account

## Page Structure

```
src/app/
├── layout.tsx                    ← Root (Server Component): renders StyledComponentsRegistry → Providers → children
├── page.tsx                      ← Redirect to /orders
├── (auth)/
│   ├── layout.tsx                ← Centered, minimal layout
│   ├── login/page.tsx            ← Username + password form
│   └── setup-password/page.tsx   ← Set password on first login
└── (app)/
    ├── layout.tsx                ← Nav bar: New Order, History, user menu, logout
    ├── orders/
    │   ├── page.tsx              ← Order history list (restaurant, date, people count)
    │   ├── new/page.tsx          ← Restaurant picker + calculator UI + save button
    │   └── [orderId]/
    │       ├── page.tsx          ← Load & edit existing order
    │       └── loading.tsx       ← Skeleton
    └── admin/
        └── users/page.tsx        ← Create users, list users
```

### Provider Nesting (Root Layout)

```
layout.tsx (Server Component)
└── StyledComponentsRegistry (Client Component — SSR style collection via useServerInsertedHTML)
    └── Providers (Client Component)
        ├── SessionProvider (NextAuth)
        ├── QueryClientProvider (TanStack Query)
        ├── ThemeProvider (styled-components)
        ├── GlobalStyles
        ├── ToastContainer (react-toastify — newly integrated, was unused in the SPA)
        └── {children}
```

## Data Architecture

**Hybrid local + server state:**
- `useLunchSession(initialSession?)` — existing hook, gains optional initial parameter for loading saved orders
- Active editing stays in client-side `useState` (preserving the snappy UX)
- "Save" button triggers Server Action to persist to database
- `useOrderPersistence` — new TanStack Query wrapper for save/load/status
- Order history fetched server-side on `/orders` page

**Mapper layer** (`src/lib/mappers.ts`):
- `prismaOrderToLunchSession()` — converts nested Prisma include result to flat `LunchSession` (reconstructs `sharedWith: string[]` from `SharedItemLink[]`, `customShares: Record<string, number> | null` from `CustomShare[]`, orders children by `sortOrder`)
- `lunchSessionToPrismaInput()` — converts flat `LunchSession` to Prisma nested create input (synthesizes `sortOrder` from array indices, maps `sharedWith[]` to `SharedItemLink` creates, maps `customShares` record to `CustomShare` creates)

**Server Actions** (`src/actions/orders.ts`):
- `createOrder(restaurantName)` → creates Order + Restaurant (if new, case-insensitive match)
- `saveOrder(orderId, session)` → deletes all children, recreates from current client state
- `deleteOrder(orderId)` → cascade delete
- `getOrder(orderId)` → full order with all relations, mapped to LunchSession via mappers
- `listOrders()` → history list items

**Server Actions** (`src/actions/auth.ts`):
- `createUser(username, displayName, role)` → admin-only
- `setupPassword(password)` → first-login password setup

## Item Suggestions Note

The existing `ItemSuggest.tsx` component already implements client-side autocomplete for item names within the current session. Phase 1 preserves this existing in-session behavior unchanged. Phase 3 will extend `ItemSuggest` to also query the database for past items from the same restaurant, feeding database-sourced suggestions into the same component interface.

## Files Unchanged (content unchanged, only add `'use client'` directive)

**Lunch feature components:**
- `src/features/lunch/components/OrderSettings.tsx`
- `src/features/lunch/components/PeopleSection.tsx`
- `src/features/lunch/components/PersonCard.tsx`
- `src/features/lunch/components/ItemRow.tsx`
- `src/features/lunch/components/ItemSuggest.tsx`
- `src/features/lunch/components/SharedItemRef.tsx`
- `src/features/lunch/components/Summary.tsx`
- `src/features/lunch/components/CopySummary.tsx`

**UI components:**
- `src/features/ui/components/Button.tsx`
- `src/features/ui/components/Input.tsx`
- `src/features/ui/components/Card.tsx`
- `src/features/ui/components/SectionTitle.tsx`

**Fully unchanged (no modifications at all):**
- `src/features/lunch/types.ts`
- `src/features/lunch/utils/calculations.ts`
- `src/features/lunch/utils/calculations.test.ts`
- `src/features/lunch/utils/formatters.ts`
- `src/features/lunch/utils/formatters.test.ts`
- `src/features/lunch/hooks/useCalculation.ts`
- `src/features/ui/theme/index.ts`
- `src/features/ui/theme/styled.d.ts`
- `src/GlobalStyles.ts` (note: `.ts` not `.tsx` — uses `createGlobalStyle` tagged template, no JSX)
- `src/test-setup.ts` (kept for standalone vitest config)

## Files Modified
- `src/features/lunch/hooks/useLunchSession.ts` — add optional `initialSession` parameter; move `initialSession` module-level constant into a factory function passed to `useState(() => ...)` to fix SSR hydration mismatch from `crypto.randomUUID()` calls
- `package.json` — remove `vite`, `@vitejs/plugin-react`; add `next`, `prisma`, `@prisma/client`, `next-auth@5`, `bcryptjs`, `@types/bcryptjs`, `@tanstack/react-query`; update scripts; remove `"type": "module"`
- `tsconfig.json` — remove `"types": ["vite/client"]`, add Next.js plugin `"plugins": [{ "name": "next" }]`, add `"include": ["next-env.d.ts", ".next/types/**/*.ts", "src"]`, verify `verbatimModuleSyntax` compatibility with NextAuth session type augmentation
- `src/App.tsx` — retired, content moves to page components

## Files Deleted
- `vite.config.ts`
- `index.html`
- `src/main.tsx`

## Files Created
- `next.config.ts` — styled-components compiler
- `vitest.config.ts` — standalone test config (extracted from vite.config.ts)
- `.env.example` — documents required environment variables
- `prisma/schema.prisma` — database schema
- `prisma/seed.ts` — initial admin user
- `src/lib/prisma.ts` — Prisma client singleton
- `src/lib/auth.ts` + `src/lib/auth.config.ts` — NextAuth config (split for edge/Node.js compatibility)
- `src/lib/mappers.ts` — Prisma ↔ LunchSession converters (sortOrder from array indices, relation flattening)
- `src/lib/validations.ts` — Zod schemas for input validation
- `src/middleware.ts` — route protection
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth API route
- `src/features/ui/StyledComponentsRegistry.tsx` — SSR style collection (useServerInsertedHTML + ServerStyleSheet)
- `src/features/ui/Providers.tsx` — Client component wrapping SessionProvider + QueryClientProvider + ThemeProvider + GlobalStyles + ToastContainer
- `src/features/lunch/hooks/useOrderPersistence.ts` — TanStack Query wrapper for save/load
- All page/layout files listed in Page Structure above

## Environment Variables

Required in `.env.local` (not committed):
```
DATABASE_URL=postgresql://...          # Vercel Postgres connection string
NEXTAUTH_SECRET=...                    # Random secret for JWT signing
NEXTAUTH_URL=http://localhost:3000     # App URL (auto-detected on Vercel)
```

A `.env.example` file will be committed with placeholder values for documentation.

## Build Sequence

### Step 1: Scaffolding
- Install Next.js 15, remove Vite + `@vitejs/plugin-react`
- Delete: `vite.config.ts`, `index.html`, `src/main.tsx`
- Create: `next.config.ts` (with `compiler: { styledComponents: true }`), standalone `vitest.config.ts`
- Create: `StyledComponentsRegistry.tsx`, `Providers.tsx`, root `layout.tsx`
- Temp `page.tsx` rendering current App content
- Add `'use client'` to all component files
- Fix `crypto.randomUUID()` hydration: change `initialSession` module-level constant → inline factory function in `useState(() => ...)`
- **Checkpoint:** `npm run dev` works, app looks identical, `npm test` passes

### Step 2: Database
- Install Prisma + `@prisma/client`
- Create `prisma/schema.prisma`
- Create `src/lib/prisma.ts`, `src/lib/mappers.ts`, `src/lib/validations.ts`
- Create `.env.example`
- Run `npx prisma generate` + `npx prisma db push`
- **Checkpoint:** Prisma generates types, schema valid

### Step 3: Auth
- Install `next-auth@5`, `bcryptjs`, `@types/bcryptjs`
- Create `src/lib/auth.config.ts` (edge-safe) + `src/lib/auth.ts` (Node.js with Prisma)
- Create `src/app/api/auth/[...nextauth]/route.ts`
- Create `src/middleware.ts`
- Create login + setup-password pages
- Create `src/actions/auth.ts`
- Seed initial admin via `prisma/seed.ts`
- **Checkpoint:** Login works, session persists, middleware redirects work

### Step 4: Pages
- Create `(app)/layout.tsx` with navigation
- Create order history page, new order page (current UI + restaurant picker + save button), edit order page
- Redirect root to `/orders`
- **Checkpoint:** Navigation works, new order page renders current UI

### Step 5: Persistence
- Create `src/actions/orders.ts` (CRUD Server Actions)
- Create `useOrderPersistence` hook
- Wire save/load/delete into pages
- **Checkpoint:** Full create → save → load → edit → delete cycle works end-to-end

### Step 6: Admin
- Create `/admin/users` page with create-user form
- Wire to `createUser` Server Action
- **Checkpoint:** Admin creates users, users set password on first login

### Step 7: Polish
- Loading skeletons (`loading.tsx`)
- Error boundaries (`error.tsx`)
- Toast notifications for save/delete success/failure
- Delete confirmation dialogs
- Verify all existing tests pass, add mapper/validation tests
- **Checkpoint:** Polished, no regressions

## Known Gotchas
1. **styled-components hydration:** `compiler: { styledComponents: true }` in next.config.ts ensures deterministic class names. `StyledComponentsRegistry` collects styles during SSR streaming.
2. **crypto.randomUUID() at module scope:** The `initialSession` constant in `useLunchSession.ts` (lines 8-16) calls `crypto.randomUUID()` at module scope, producing different IDs on server vs client. Fix: replace the module-level constant with an inline factory function passed to `useState(() => ({ ... }))`.
3. **Middleware edge runtime:** Can't use bcryptjs or Prisma in middleware. Split: `auth.config.ts` (edge-safe, no Prisma import) + `auth.ts` (Node.js with Prisma). Middleware uses only edge-safe config.
4. **tsconfig `verbatimModuleSyntax`:** May conflict with NextAuth's module augmentation for session types. Test during Step 3 and disable if needed.

## Future Phases
- **Phase 2:** Collaborative real-time ordering (WebSockets/SSE, order status lifecycle, share links, upsert/diff save strategy)
- **Phase 3:** Item suggestions from past orders at same restaurant (extend `ItemSuggest.tsx` with database-backed suggestions)
- **Phase 4:** QR Platba payment codes (research Air Bank specifics)
- **Phase 5:** User profile management (bank account number, display name)
