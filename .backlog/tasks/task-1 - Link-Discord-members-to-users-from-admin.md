---
id: TASK-1
title: Link Discord members to users from admin
status: To Do
assignee: []
created_date: '2026-07-27 11:21'
updated_date: '2026-07-27 11:28'
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
- [ ] #1 Admin sees every user without a discordId and can link a chosen Discord member to them, and the row disappears once linked
- [ ] #2 Missing DISCORD_GUILD_ID, a disabled privileged intent and an unconfigured bot each render an actionable message instead of a raw error, and the missing-guild case lists the guild IDs the bot is in
- [ ] #3 Bots are excluded from the member list and the fetch pages through servers with more than 1000 members
- [ ] #4 The member dropdown lists every not-yet-linked guild member, sorted case- and diacritics-insensitively, labeled with server nickname, global name and @username so a person can be recognized by any of them
- [ ] #5 Not-yet-linked members are also shown in a collapsed list with their Discord IDs and a copy-as-text button, and that list shrinks as pairs are made
- [ ] #6 Unit tests cover member fetch pagination and bot filtering, plus the dropdown label and sort helper
<!-- AC:END -->
