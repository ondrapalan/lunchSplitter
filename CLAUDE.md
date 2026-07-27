# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git commit workflow

> **This project overrides the global `prepare commit` workflow** — it is a hobby project, Claude may commit autonomously.

- Conventional commits (`feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`), plain English, imperative mood, no period at the end
- No mention of AI or Claude in commit messages
- Never commit sensitive data (`.env*`, tokens, keys) — if it happens accidentally, alert immediately and propose a fix
- Each `git add` on its own line (the Windows console has trouble with multi-path commands)

## Task Board (Backlog.md)

Work streams live on a git-native Backlog.md board (`.backlog/`, v1.48). Use the `backlog` CLI — never hand-edit task files; quick views: `backlog board` (TUI) / `backlog browser` (web). Run `backlog instructions overview` when picking up board work and follow the Backlog.md guidelines block below for task CLI mechanics.

- When you pick up a card, assign it to yourself: `backlog task edit <n> -a @{your-name}`.
- One card per work stream; statuses To Do → In Progress → Done; flip to `In Progress` when you start a card's plan.
- Branch per card (`task-<n>--<topic>`) for larger streams — isolate via `superpowers:using-git-worktrees`; small fixes may go straight to `main`.
- Keep `auto_commit: false` in `.backlog/config.yml`.

### Anti-drift: Done requires a merge

- A card flips to `Done` only after its commits are on `main` — merge the task branch (local merge, then push `main`) *before* editing the card. Don't push task branches unless asked. Note: pushing `main` triggers the Vercel deploy.
- Verify before flipping: `git branch --merged main` should list the branch, or `git log main --oneline` should show the work.
- Don't leave task branches behind `main`; rebase promptly if one falls behind.

### Board lifecycle

- `Done` cards **stay in `.backlog/tasks/`** — the board is the recent history. When the Done column gets noisy, run `backlog cleanup`: it moves Done cards to `.backlog/completed/`. That is the only way finished work leaves the board — never move board files by hand.
- `backlog cleanup` is a TUI; agents can drive it headless by piping keystrokes, e.g. `{ sleep 1; printf '\r'; sleep 1; printf '\r'; sleep 1; } | backlog cleanup`. Caveats observed on v1.47.x (we run v1.48 — verify): it can move **all** Done cards regardless of the selected cutoff, and it creates its own commit even with `auto_commit: false` — check `git log`/`git status` afterwards. Completed cards drop out of the CLI entirely (no `task view`, no `search`) but stay greppable under `.backlog/completed/`.
- `.backlog/archive/` is for **cancelled/superseded** cards only (`backlog task archive <id>`). Never archive completed work.
- `.backlog/drafts/` holds ideas not yet committed to (`backlog draft ...`); promote a draft when it becomes real work.
- `.backlog/decisions|docs|milestones/` are unused CLI scaffolding — the decision log is `docs/decisions.md`; don't start a parallel one.

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

<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.48.0 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:
- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->
