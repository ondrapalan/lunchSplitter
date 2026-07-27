---
id: TASK-2
title: Focus the item input after adding a person to an order
status: To Do
assignee: []
created_date: '2026-07-27 12:31'
labels: []
dependencies: []
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the order creator adds someone to an open order, focus stays in the person picker, so they must click the new card's item-name input before typing. Move focus to that input as soon as the new person's card appears, making the add-person then add-items loop keyboard-only. Requested by the colleague who creates most orders. Applies to all three add flows: registered user, guest, and plain typed name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Adding a registered user moves focus to the new card's item-name input
- [ ] #2 Adding a guest moves focus to the new card's item-name input
- [ ] #3 Adding a plain typed name moves focus to the new card's item-name input
- [ ] #4 Focus is not moved by re-renders, reloads, or any action other than adding a person
- [ ] #5 Person picker behavior, the suggestion dropdown, and the guest host-picker step are unchanged
- [ ] #6 npm test and npx tsc --noEmit pass
<!-- AC:END -->
