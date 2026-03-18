# Lunch Splitter

A full-stack Next.js app for splitting lunch bills among office colleagues. Handles discounts, shared items, per-item discount overrides, fee/coupon adjustments, multi-user accounts, and Czech QR payment codes.

> **Note:** This is a vibe-coded project — built entirely through AI-assisted development with [Claude Code](https://claude.ai/code).

## Features

- **People & items** — Add people, add their food items with prices
- **Global discount** — Apply a percentage discount to all items
- **Per-item discount override** — Click the discount badge on any item to set a custom discount
- **Shared items** — Share an item across multiple people with equal or custom splits
- **Fees & adjustments** — Add delivery fees, service charges, and coupons (positive or negative amounts), split equally
- **Item & person suggestions** — Autocomplete from previously entered names and prices
- **Restaurant suggestions** — Autocomplete from previously used restaurants
- **Summary table** — Live-updating breakdown: Subtotal → After Discount → With Fees
- **Copy to clipboard** — One-click copy of the full text summary
- **Order lifecycle** — Open orders (editable) and closed orders (read-only with QR codes)
- **Auto-save** — Debounced auto-save with status indicator, warns on unsaved changes before leaving
- **QR Platba** — Czech bank QR payment codes generated per person when an order is closed
- **Multi-user accounts** — User registration, roles (Admin/User), invite system with expiring tokens
- **Admin panel** — User management, temporary password generation
- **User settings** — Display name, password change, bank account number for QR payments
- **Security** — CSRF protection, IDOR prevention, QR/SPD injection sanitization, security headers

## Tech Stack

- **Next.js 15** + **React 19** + **TypeScript** (strict)
- **PostgreSQL** + **Prisma** ORM
- **NextAuth** (v5 beta) — credentials-based authentication
- **styled-components** for theming and styling
- **React Query** for server state management
- **react-hook-form** + **zod** for form validation
- **qrcode** for QR Platba generation
- **Vitest** for unit testing

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables and fill in your values
cp .env.example .env

# Run database migrations
npx prisma migrate deploy

# Seed the admin user (username: admin, password: admin123)
npx prisma db seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable          | Description                            |
| ----------------- | -------------------------------------- |
| `DATABASE_URL`    | PostgreSQL connection string           |
| `NEXTAUTH_SECRET` | Random secret for session encryption   |
| `NEXTAUTH_URL`    | App URL (e.g. `http://localhost:3000`) |

## Scripts

| Command              | Description                                     |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Start development server                        |
| `npm run build`      | Generate Prisma client and build for production |
| `npm run start`      | Start production server                         |
| `npm test`           | Run tests once                                  |
| `npm run test:watch` | Run tests in watch mode                         |

## Project Structure

```
src/
├── actions/                        # Next.js server actions
│   ├── auth.ts                     # Registration, passwords, invitations
│   ├── invitations.ts              # Invite token management
│   ├── orderItems.ts               # Item and person CRUD
│   ├── orders.ts                   # Order lifecycle (create, save, close, reopen)
│   └── users.ts                    # User queries
├── app/                            # Next.js app router
│   ├── (app)/                      # Protected routes (require auth)
│   │   ├── admin/users/            # Admin user management
│   │   ├── invite/                 # Invite management
│   │   ├── orders/                 # Order list, create, detail
│   │   └── settings/               # User settings
│   ├── (auth)/                     # Public auth routes
│   │   ├── login/                  # Login / first admin setup
│   │   └── setup-password/         # First-login password change
│   ├── api/auth/[...nextauth]/     # NextAuth API route
│   └── invite/[token]/             # Public invite registration
├── features/
│   ├── lunch/
│   │   ├── components/             # UI components (PersonCard, ItemRow, Summary, QrPlatba, etc.)
│   │   ├── hooks/                  # useLunchSession, useCalculation, useAutoSave
│   │   ├── types.ts                # Data types
│   │   └── utils/                  # Calculations, formatters, QR Platba (with tests)
│   └── ui/
│       ├── components/             # Shared UI (Button, Input, Card, StatusBadge)
│       ├── theme/                  # Theme definition and types
│       ├── Providers.tsx           # React Query, Toastify providers
│       └── StyledComponentsRegistry.tsx  # SSR registry
├── lib/
│   ├── auth.ts                     # NextAuth setup
│   ├── auth.config.ts              # Auth configuration
│   ├── mappers.ts                  # Prisma ↔ app type converters
│   ├── prisma.ts                   # Prisma singleton
│   └── validations.ts             # Zod schemas
├── types/
│   └── next-auth.d.ts              # Session type extensions
├── middleware.ts                    # Auth redirect middleware
└── GlobalStyles.ts
prisma/
├── schema.prisma                   # Database schema (User, Order, Restaurant, etc.)
└── seed.ts                         # Seeds admin user
```
