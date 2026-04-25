# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proactive Skill Usage

Invoke these installed skills automatically when the context matches — don't wait for the user to ask:

- **`frontend-design`** — When building new UI components, pages, or visual features (styled-components work, new layouts, redesigns)
- **`feature-dev`** — When developing a new feature end-to-end (guided architecture + implementation)
- **`simplify`** — After completing code changes, review for reuse, quality, and simplification
- **`code-review`** — When reviewing a pull request or when asked to review code
- **`context7`** — When needing current docs for any library/framework (React, Next.js, mongoose, styled-components, etc.) — prefer this over guessing from training data
- **`claude-md-management:revise-claude-md`** — At end of sessions where significant learnings emerged
- **`figma:figma-implement-design`** — When the user provides a Figma URL to implement
- **`playwright-cli`** — When automating browser testing beyond simple Playwright MCP calls

These are in addition to the superpowers skills (brainstorming, debugging, writing-plans, etc.) which are already part of the workflow.

## Coding Standards

- **TypeScript**: Never use `any` — always use proper types
- **Styling**: styled-components with theme from `~/features/ui/theme/` (`colors`, `fontSizes`, `font`, `typography`)
- **Forms**: react-hook-form + zod (`zodResolver`)
- **Toasts**: `import { toast } from 'react-toastify'`
- **Naming**: camelCase for variables/functions, PascalCase for components/types, UPPER_SNAKE_CASE for enum values
- **Effects**: Follow React's "You Might Not Need an Effect" guidelines
- **DRY**: Reuse existing components/functions before creating new ones
- **Problem solving**: Create at least 3 solutions, analyze and rate them 1-5, then recommend one

## Local Environment Notes

The user runs a main project concurrently that occupies `localhost:3000`, `localhost:3001`, and a MongoDB Docker container. For this project use non-colliding ports:

- **Next.js dev server: `3100`** (see `dev` script in `package.json`)
- **Postgres (sandbox): `5433`** (see `docker-compose.yml`)

Never suggest `-p 3000`, `-p 3001`, or the default Postgres `:5432` — they will collide with the user's other work.

## Sandbox Environment

Safe local testing setup that avoids live Neon data and real Discord sends:

- `npm run dev` — one-shot: guards DATABASE_URL, starts Postgres, pushes schema, seeds admin (idempotent), runs Next on `:3100`. Use this every time.
- `npm run dev:clean` — wipes the DB and reseeds rich fixtures (6 test users with password `heslo`, 4 restaurants, 9 closed orders over ~3 weeks with varied participants / discounts / fees / payment states). Then run `npm run dev`.
- `npm run sandbox:up` / `sandbox:down` — start/stop the Postgres container without touching Next.
- `npm run sandbox:guard` — DATABASE_URL safety check (called internally by `dev` and `dev:clean`).
- Set `DISCORD_DRY_RUN=1` in `.env.local` — `src/lib/discord.ts` short-circuits all outbound API calls and logs payloads instead. Belt-and-suspenders in addition to leaving `DISCORD_BOT_TOKEN` blank.

**Important:**
- This project uses `prisma db push`, NOT `prisma migrate` — there is no `prisma/migrations/` folder. Never suggest `prisma migrate deploy`.
- `prisma.config.ts` loads `.env` then `.env.local` with override — so the sandbox `DATABASE_URL` in `.env.local` is respected by Prisma CLI. The `sandbox-guard` script refuses to run destructive commands unless `DATABASE_URL` resolves to localhost.
- Rich fixtures live in `prisma/seed.dev.ts` (dev-only). The default `prisma db seed` still runs `prisma/seed.ts` (admin only) so prod-style Vercel deploys stay minimal.
