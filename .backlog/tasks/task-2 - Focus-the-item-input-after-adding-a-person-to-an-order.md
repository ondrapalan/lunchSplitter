---
id: TASK-2
title: Focus the item input after adding a person to an order
status: Done
assignee:
  - '@claude'
created_date: '2026-07-27 12:31'
updated_date: '2026-07-27 13:49'
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
- [x] #1 Adding a registered user moves focus to the new card's item-name input
- [x] #2 Adding a guest moves focus to the new card's item-name input
- [x] #3 Adding a plain typed name moves focus to the new card's item-name input
- [x] #4 Focus is not moved by re-renders, reloads, or any action other than adding a person
- [x] #5 Person picker behavior, the suggestion dropdown, and the guest host-picker step are unchanged
- [x] #6 npm test and npx tsc --noEmit pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
useLunchSession.addPerson/addGuest now return the id of the person they append; the order page's auto-save handlers return theirs. PeopleSection stores it as focusItemsForPersonId and passes autoFocusItemInput to the matching PersonCard, which forwards it to ItemSuggest as autoFocus. Cards are keyed by id and appended, so the new card is always a fresh mount and React's native autoFocus suffices - no ref, no useEffect. PersonSuggest is unchanged; PeopleSection absorbs the =>void / =>string mismatch with wrappers.

Review caught that the original design's 'the flag never needs resetting' claim was false: useOrder sets refetchOnWindowFocus:true, status is read off the query cache, and the contentKey remount belongs to the Sekacka branch - so a background refetch could flip canEditItems and refire autoFocus for a stale person. The flag is now cleared during render whenever the flagged person's item input is not mounted, derived from the same expression that gates the mount (editablePersonId ? id === editablePersonId : canEditItems), using React's adjust-state-during-render pattern.

vitest.config.ts gained esbuild.jsx:'automatic' - the repo had no .tsx tests and every one failed with 'React is not defined'. ItemSuggest.test.tsx and PeopleSection.test.tsx are the repo's first React Testing Library tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Focus now moves to the new person's item-name input for all three add flows, making the add-person then add-items loop keyboard-only. Verified two ways: 121 automated tests pass (including the repo's first RTL component tests, which drive the real PersonSuggest keyboard path and assert document.activeElement), and a manual pass in Chrome on the sandbox at :3100 exercising a registered user, a second user, a guest via the host-picker step, and a plain typed name - plus the full type-item-Tab-price-Enter loop with no mouse. npx tsc --noEmit clean on merged main.
<!-- SECTION:FINAL_SUMMARY:END -->
