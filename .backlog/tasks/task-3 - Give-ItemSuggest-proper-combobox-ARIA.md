---
id: TASK-3
title: Give ItemSuggest proper combobox ARIA
status: To Do
assignee: []
created_date: '2026-07-27 13:43'
labels: []
dependencies: []
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ItemSuggest behaves as a combobox - a ul/li dropdown with ArrowUp/Down navigation and an active-option highlight - but carries no role=combobox, aria-expanded, aria-controls or aria-activedescendant, and its only accessible name is the 'Item name' placeholder. This is pre-existing, but the add-person focus change (TASK-2) made it a programmatic focus target, so a screen-reader user is now dropped into an unannounced widget rather than tabbing into one. Raised by the code review on TASK-2 and deliberately kept out of that scope. Note the focus move is user-initiated, so WCAG 3.2.1/3.2.2 are not implicated - this is about announcing the widget, not about unexpected context change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ItemSuggest input exposes role=combobox with aria-expanded reflecting the dropdown state
- [ ] #2 The dropdown is associated via aria-controls and the highlighted option via aria-activedescendant
- [ ] #3 The input has an accessible name that does not rely on the placeholder alone
- [ ] #4 Keyboard behavior (ArrowUp/Down, Enter, Tab, Escape) is unchanged
<!-- AC:END -->
