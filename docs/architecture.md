# Architecture

High-level map of the app — tech choices, directory layout, and data model. Start here if you're new to the codebase.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 15** App Router on Vercel |
| UI | **React 19**, **TypeScript** strict, **styled-components** with light/dark theme |
| Data layer | **Prisma** ORM → Neon **PostgreSQL** (free tier) |
| Auth | **NextAuth v5 (beta)** — credentials provider, JWT session |
| Forms | **react-hook-form** + **zod** (`zodResolver`) |
| Client cache | **TanStack React Query** (hooks under `src/lib/queries/`) |
| Server cache | `unstable_cache` from `next/cache` (see [`caching-and-loading.md`](./caching-and-loading.md)) |
| External | **Discord** bot (DMs, slash-like interactions, buttons), **QR Platba** codes (Czech bank SPD) |
| Tests | **Vitest** (pure unit tests for math/validation/mappers) |

## Directory layout

```
src/
  app/
    (auth)/               # login, request-access, setup-password
    (app)/                # logged-in shell: orders, stats, settings, admin/*
      orders/             # list, new, new/sekacka, [orderId]
      stats/              # /stats with 6 card components
      admin/              # users, guests, items, discord-links, guests/backfill
    api/
      auth/[...nextauth]/ # NextAuth route
      discord/interactions/route.ts  # Discord bot webhook
    invite/[token]/       # public invite-redemption page
  actions/                # server actions — every DB mutation lives here
    orders.ts stats.ts users.ts guests.ts discord.ts auth.ts items.ts
  features/
    lunch/                # domain logic: types, calculations, components, hooks
    stats/                # stats card components and types
    ui/                   # Card, Button, Input, Skeleton, theme, Providers
  lib/
    auth.ts               # NextAuth config
    prisma.ts             # Prisma client singleton
    orderAccess.ts        # getOrderAccess(order, user) capability resolver
    sekackaCore.ts        # Sekačka participant + Discord message logic
    mappers.ts            # Prisma ↔ LunchSession mapping
    cache.ts              # unstable_cache wrapper + tag registry
    queries/              # React Query hooks + query-key registry
    discord*.ts           # Discord REST helpers
    validations.ts        # shared zod schemas
  GlobalStyles.ts
  middleware.ts           # route protection
prisma/
  schema.prisma           # source of truth for DB
docs/
  architecture.md                 (this file)
  caching-and-loading.md
  features/*.md
```

## Request lifecycle

1. **Browser → Next.js page (`app/**/page.tsx`)** — almost every page is a client component. Middleware redirects unauthenticated users to `/login`.
2. **Client hook → server action** — every data read/write goes through a React Query hook in `src/lib/queries/`, which calls a server action in `src/actions/`.
3. **Server action** — calls `auth()` for identity, then Prisma. Heavy reads are wrapped in `unstable_cache`. Mutations end with `revalidateTag(...)` on the tags they affect.
4. **Client cache** — React Query stores the result per query key. Default `staleTime: 60s`, `gcTime: 5min`, no window-focus refetch.
5. **Loading UX** — route-level `loading.tsx` for navigation transitions; inline skeletons (`src/features/ui/components/Skeleton.tsx`) for per-component pending states.

See [`caching-and-loading.md`](./caching-and-loading.md) for the full two-layer cache story.

## Data model (Prisma)

Source: `prisma/schema.prisma`.

### Enums
- `Role` → `ADMIN`, `USER`
- `OrderStatus` → `OPEN`, `CLOSED`
- `OrderType` → `NORMAL`, `SEKACKA`
- `OrderActivityAction` → `CREATED`, `PUBLISHED_TO_DISCORD`, `ITEM_ADDED`, `ITEM_EDITED`, `ITEM_REMOVED`, `JOINED`, `LEFT`, `MANUAL_ADDED`, `MANUAL_REMOVED`, `PENDING_LINK_CREATED`, `CLOSED`, `REOPENED`
- `ActivitySource` → `DISCORD`, `WEB`, `ADMIN`

### Core tables

| Model | Purpose |
|---|---|
| **User** | Registered account (`username`, `displayName`, `aliases[]`, `bankAccountNumber`, `discordId`, `role`, `isFirstLogin`) |
| **Guest** | Named guest without an account (`name`, `aliases[]`, `defaultHostUserId` → User) |
| **Order** | A lunch order (`restaurantId`, `createdById`, `status`, `type`, `globalDiscountPercent`, `bankAccountNumber`, `discordAnnounceChannelId/MessageId`) |
| **OrderPerson** | Seat at the order (`orderId`, either `userId` or `guestId`, optional `hostUserId`, `name`, `sortOrder`) |
| **OrderItem** | Line item (`name`, `price`, `discountPercent?`, `isPackaging`, `personId`) |
| **SharedItemLink** | Split an item across extra people (unique `(itemId, personId)`) |
| **CustomShare** | Override equal-split with a pre-discount amount per person |
| **FeeAdjustment** | Order-level fee or coupon (`name`, `amount`, `sortOrder`) — negative = coupon |
| **PaymentConfirmation** | Per-participant paid status (`orderPersonId`, `confirmedVia: 'discord' \| 'manual' \| 'pending'`, `discordMessageId`) |
| **Restaurant** | Lookup table (`name` unique) — auto-upserted on order creation |
| **Invitation** | Admin-minted signup token (`token`, `invitedById`, `expiresAt`, `usedAt`/`usedById`) |
| **AccessRequest** | Self-signup request pending admin approval (`status`, `username`, `displayName`, `passwordHash`) |
| **PendingDiscordLink** | Unknown Discord user who clicked something (`discordId`, identity hints, `triggeredByOrderId`, `resolvedAt`) |
| **OrderActivityLog** | Audit trail per order (`action`, `actorUserId`, `targetUserId/GuestId`, `source`, `note`) |

### Key relations

- `Order.people` → `OrderPerson[]`; each links to either a `User` or a `Guest`, not both. Hosts are `OrderPerson.hostUserId → User`.
- `OrderItem.personId` → the owner. `SharedItemLink` and `CustomShare` fan it out to other `OrderPerson`s.
- `PaymentConfirmation` is one-to-one with `OrderPerson`. Absent = not yet invoiced; `confirmedVia='pending'` = QR sent but unconfirmed.
- `Guest.defaultHostUserId` is just a default; the actual host per order is `OrderPerson.hostUserId`.

## Conventions

- **Every DB mutation is in `src/actions/`**, marked `'use server'`, starts with `auth()`, ends with `revalidateTag(...)`.
- **Every DB read consumed by the UI** has a React Query hook in `src/lib/queries/` with a key from `src/lib/queries/keys.ts`.
- **Styling** uses the theme from `src/features/ui/theme/` — `colors`, `spacing`, `fontSizes`, `borderRadius`, `typography`. No raw hex in components.
- **Forms** use `react-hook-form` + a zod schema in `src/lib/validations.ts`.
- **Toasts** via `react-toastify` (`toast.success/error/info/warn`).
- **Access rules** come from a single place: `getOrderAccess()` in `src/lib/orderAccess.ts`. Never re-derive them in components.
- **No `any`** — strict TypeScript.

## Feature docs

Each feature has its own doc in [`features/`](./features/):

- [Orders & splitting math](./features/orders-and-splitting.md)
- [Stats](./features/stats.md)
- [Sekačka](./features/sekacka.md)
- [Guests & hosts](./features/guests-and-hosts.md)
- [Auth & access](./features/auth-and-access.md)
- [Discord integration](./features/discord-integration.md)
- [Payments & QR Platba](./features/payments.md)
- [Admin panel](./features/admin.md)

Plus cross-cutting concerns:
- [Caching & loading](./caching-and-loading.md)
