# Lunch Splitter — docs

Technical documentation for the codebase. Intended audience: anyone (human or AI agent) diving into a specific feature.

## Start here

- **[Architecture](./architecture.md)** — tech stack, directory layout, Prisma data model, conventions. Read this first.
- **[Caching & loading](./caching-and-loading.md)** — the two-layer cache story (server `unstable_cache` + client React Query) and how to extend it.

## Features

One doc per domain. Each one cross-links to related topics at the bottom.

| Doc | What it covers |
|---|---|
| [Orders & splitting](./features/orders-and-splitting.md) | Order lifecycle, access rules (`getOrderAccess`), the calculation engine — global + per-item discounts, shared items, custom shares, fee adjustments, host rollup |
| [Stats](./features/stats.md) | What each `/stats` card measures, formulas, the `getStatsBundle` pattern |
| [Sekačka](./features/sekacka.md) | The Czech group-order variant, Discord join/leave buttons, equal split via `sharedWith` |
| [Guests & hosts](./features/guests-and-hosts.md) | Guest vs. host data model, aliases, legacy-name backfill |
| [Auth & access](./features/auth-and-access.md) | NextAuth config, invites, access requests, setup-password flow, roles |
| [Discord integration](./features/discord-integration.md) | Outbound DMs (QRs, access requests), inbound interactions webhook, pending-link resolution |
| [Payments & QR Platba](./features/payments.md) | Czech SPD format, IBAN conversion, variable symbols, payment confirmations |
| [Admin panel](./features/admin.md) | Every page under `/admin/*` and the server actions it drives |

## Operator guides

- [Discord setup (🇨🇿)](./discord-setup-guide-cz.md) — step-by-step for registering the bot, setting env vars, and wiring the interactions endpoint.

## Feature ideas / backlog

- [`ideas/`](./ideas/) — rough proposals that aren't implemented. Nothing here is committed work.

## Superpowers artifacts

- [`superpowers/specs/`](./superpowers/specs/) — design specs from brainstorming sessions.
- [`superpowers/plans/`](./superpowers/plans/) — written implementation plans.

These are historical records of how features were thought through, not active documentation. Point back to the feature docs above for anything authoritative.

## Conventions

When you add a feature doc:

1. Put it in `docs/features/<topic>.md`.
2. Link it from the table above and from the "Related docs" footer of any doc that references it.
3. Scale each section to its complexity — a few sentences for simple, one or two paragraphs for nuanced. Code blocks + file paths > prose.
4. Don't duplicate what's already in a sibling doc. Link out.
5. Every doc should answer: **what does this feature do, which files own it, and how do I extend it?**
