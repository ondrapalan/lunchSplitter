---
id: TASK-1
title: Link Discord members to users from admin
status: To Do
assignee: []
created_date: '2026-07-27 11:21'
labels: []
dependencies: []
documentation:
  - docs/superpowers/specs/2026-07-27-discord-member-linking-design.md
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Admins can read the company Discord server member list through the bot and pair those members with app users that have no discordId, so colleagues who never linked their account still get payment QR DMs. Guild members with no app account are listed read-only. Needs the GUILD_MEMBERS privileged intent (already enabled in the Developer Portal) and a new DISCORD_GUILD_ID env var. No action is required from the Discord server administrator.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Admin sees every user without a discordId and can link a chosen Discord member to them, and the row disappears once linked
- [ ] #2 Unambiguous name matches are pre-selected in the dropdown, including diacritics, punctuation and User.aliases; ambiguous matches are left unselected
- [ ] #3 Guild members with no app account are listed as display name, @username and Discord ID with a copy-as-text button
- [ ] #4 Missing DISCORD_GUILD_ID, a disabled privileged intent and an unconfigured bot each render an actionable message instead of a raw error, and the missing-guild case lists the guild IDs the bot is in
- [ ] #5 Bots are excluded from the member list and the fetch pages through servers with more than 1000 members
- [ ] #6 Unit tests cover name normalization, alias matching, ambiguity and the pagination loop
<!-- AC:END -->
