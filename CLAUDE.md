# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git commit workflow

> **This project overrides the global `prepare commit` workflow** — it is a hobby project, Claude may commit autonomously.

- Conventional commits (`feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`), plain English, imperative mood, no period at the end
- No mention of AI or Claude in commit messages
- Never commit sensitive data (`.env*`, tokens, keys) — if it happens accidentally, alert immediately and propose a fix
- Each `git add` on its own line (the Windows console has trouble with multi-path commands)

## Project-specific styling

Theme imports: `~/features/ui/theme/` (`colors`, `fontSizes`, `font`, `typography`). Universal coding standards, stack defaults, and proactive skill usage live in global `~/.claude/CLAUDE.md`.

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
- Set `DISCORD_DEBUG_USER_ID=<your-discord-id>` in `.env.local` to redirect every outbound Discord message (DMs + Sekačka channel + edits) to a DM with you. Each message is tagged with a `[DEBUG → <label>]` header naming the original target. Requires `DISCORD_DRY_RUN=` empty and a real `DISCORD_BOT_TOKEN`. Use this when you need to *see* live Discord output during local testing.

**Important:**
- This project uses `prisma db push`, NOT `prisma migrate` — there is no `prisma/migrations/` folder. Never suggest `prisma migrate deploy`.
- `prisma.config.ts` loads `.env` then `.env.local` with override — so the sandbox `DATABASE_URL` in `.env.local` is respected by Prisma CLI. The `sandbox-guard` script refuses to run destructive commands unless `DATABASE_URL` resolves to localhost.
- Rich fixtures live in `prisma/seed.dev.ts` (dev-only). The default `prisma db seed` still runs `prisma/seed.ts` (admin only) so prod-style Vercel deploys stay minimal.
