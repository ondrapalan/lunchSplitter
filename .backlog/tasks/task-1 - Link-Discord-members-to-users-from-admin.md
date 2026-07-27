---
id: TASK-1
title: Link Discord members to users from admin
status: Done
assignee:
  - '@claude'
created_date: '2026-07-27 11:21'
updated_date: '2026-07-27 11:54'
labels: []
dependencies: []
documentation:
  - docs/superpowers/specs/2026-07-27-discord-member-linking-design.md
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Admins can read the company Discord server member list through the bot and pair those members with app users that have no discordId, so colleagues who never linked their account still get payment QR DMs. Members not linked to anyone are also listed read-only with their IDs. No automatic name matching: real server nicknames (Domca for a Dominik, Bary for cyomi) make exact matching useless and looser matching risky, so the dropdown does the work. Needs the GUILD_MEMBERS privileged intent (enabled) and DISCORD_GUILD_ID=694149319342686248 (guild INDIGO). No action required from the Discord server administrator.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Admin sees every user without a discordId and can link a chosen Discord member to them, and the row disappears once linked
- [x] #2 Missing DISCORD_GUILD_ID, a disabled privileged intent and an unconfigured bot each render an actionable message instead of a raw error, and the missing-guild case lists the guild IDs the bot is in
- [x] #3 Bots are excluded from the member list and the fetch pages through servers with more than 1000 members
- [x] #4 The member dropdown lists every not-yet-linked guild member, sorted case- and diacritics-insensitively, labeled with server nickname, global name and @username so a person can be recognized by any of them
- [x] #5 Not-yet-linked members are also shown in a collapsed list with their Discord IDs and a copy-as-text button, and that list shrinks as pairs are made
- [x] #6 Unit tests cover member fetch pagination and bot filtering, plus the dropdown label and sort helper
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read path in src/lib/discord.ts: discordGet (no dry-run branch), DiscordReadError with status, zod-validated listGuildMembers with after-pagination and bot filtering, listBotGuilds; unit tests; DISCORD_GUILD_ID in .env.example.
2. src/lib/discordMemberDisplay.ts: normalizeName, memberLabel (nick / global name / @username, deduped), sortMembersForDisplay (Czech collation); unit tests. No automatic matching by design.
3. src/actions/discordMembers.ts: listUnlinkedGuildMembers behind requireAdmin, filters out IDs already on a user, maps 403 to a SERVER MEMBERS INTENT instruction and a missing DISCORD_GUILD_ID to the bot's guild list; query key + useUnlinkedDiscordMembers hook; useSetUserDiscordId also invalidates discordLinks.
4. Split /admin/discord-links into UnlinkedUsersSection (new) and PendingLinksSection (moved) under src/features/admin/components with shared styled pieces; collapsed roster with copy-as-text; page becomes a composition.
5. Update docs.

Deviation from the spec, noted deliberately: the action returns only the members. getUsersWithoutDiscordLink already returns the unlinked users, so a combined overview payload would duplicate that query and create a second source of truth.

Full plan: docs/superpowers/plans/2026-07-27-discord-member-linking.md
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deviation from the spec: the action returns only the guild members. getUsersWithoutDiscordLink already returns users without a discordId, so a combined overview payload would have duplicated that query.

Sort key uses localeCompare(label, 'cs') rather than the spec's diacritics-stripping normalizeName. Verified live: Jirka Cizek < Jirlok < Jiri H. N., because r is a distinct Czech letter sorted after r. Stripping diacritics would have gotten that wrong. normalizeName survives only to deduplicate a nickname that repeats the global name.

useSetUserDiscordId now invalidates qk.discordLinks.all as well as qk.users.all. It only invalidated users before, which left the Discord-link lists stale after /admin/users set an ID — a pre-existing gap this feature would have made visible.

Added a try/catch around navigator.clipboard.writeText: a denied clipboard permission previously produced an unhandled rejection and no feedback.

Live verification found that an empty DISCORD_GUILD_ID= line in .env.local silently shadows the real value in .env, because the dev script runs dotenv -e .env.local -e .env and dotenv never overrides an already-set key. An empty line behaves differently from a missing line.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Admins can now pair app users with Discord server members from /admin/discord-links without anyone copying IDs. Added a paginated, zod-validated read path to src/lib/discord.ts (reads deliberately skip the DISCORD_DRY_RUN guard and raise DiscordReadError with the HTTP status), a listUnlinkedGuildMembers action that subtracts already-linked IDs and translates 403 into a SERVER MEMBERS INTENT instruction, and a new UnlinkedUsersSection alongside the moved PendingLinksSection. No automatic name matching by design.

Verified live against the INDIGO guild in the sandbox: 27 members returned, 2 bots filtered out, 25 offered in the dropdown; linking one member moved the header 7 to 6, removed the row and shrank the roster 25 to 24; Copy as text produced a clipboard toast. The missing-DISCORD_GUILD_ID path was exercised by accident and printed the guild ID to copy. The remaining error paths (no bot token, 403 intent) plus pagination, bot filtering, labels and Czech collation are covered by 19 unit tests. npm test 109/109 and npx tsc --noEmit both clean.

Requires DISCORD_GUILD_ID=694149319342686248 on Vercel before the section works in production.
<!-- SECTION:FINAL_SUMMARY:END -->
