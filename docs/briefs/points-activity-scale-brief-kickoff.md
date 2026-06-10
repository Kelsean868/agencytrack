# Brief — Full activity-points scale (PR 1.5: expand weights + rescale levels)

**Suggested branch:** `feat/points-activity-scale`
**Size:** M
**Type:** Cloud Function + config change. Human-merged (Rule 19). **Requires `firebase deploy --only functions`.**
**PREREQUISITE:** PR #556 (points single-source + f2f) merged AND deployed. This PR edits the config/computePoints that #556 created. Verify #556's squash commit is on origin/main before Phase 0.

---

## Context

The points scale has been redesigned to reward the full activity lifecycle — prospecting, advancing, closing, and servicing — so a full-effort no-sale week still scores visibly (~115–125 pts). Design is funnel-anchored (Granum 10-3-1), effort-weighted, with a referral premium and servicing rewarded for persistency/referral-loop value. **Head of sales has signed off on this exact scale.** Convention preserved: attempts score, success-rate fields (telContacts, f2fSuccessful, serviceContacts) stay unscored as KPI material.

Existing accumulated points are negligible (canary agent only), so the threshold rescale needs no migration — this must land pre-pilot.

---

## Target state

### POINTS_WEIGHTS — final scale (both config copies)

Unchanged: dials (4 call types) 1 · ffiConducted 5 · ciConducted 10 · applicationsSold 25 · apiPerThousand 1 · f2fAttempts 2 (**raise from 1**).

New entries:

| Config key (recon confirms field names) | Pts | Notes |
|---|---|---|
| prospectingLettersSent | 1 | **capped at 20/week** — Math.min in computePoints |
| referralsObtained | 3 | referral premium |
| otherNewNames | 1 | non-referral new names — Phase 1 maps which namesFrom* channels compose this |
| seminarsConducted | 10 | |
| tradeshowsAttended | 5 | |
| appointmentsSet | 3 | Phase 1 confirms exact field key |
| serviceCalls | 1 | the attempt, consistent with dial convention; serviceContacts NOT scored |
| policiesDelivered | 3 | |
| premiumCollectionMeetings | 3 | |
| reviewsExisting | 5 | annual reviews, existing clients |
| reviewsOrphan | 5 | |
| orphansAdopted | 8 | |
| reinstatedApps | 10 | |
| reinstatedApiPerThousand | 1 | mirrors apiPerThousand, Math.floor |
| policyChanges | 1 | |

**Deliberately unscored (document in config comment/excluded list):** withdrawalsLoans, surrenders (processing an exit is not incentivized), telContacts / f2fSuccessful / serviceContacts (success ratios, not attempts), namesFromSeminarsConducted / namesFromTradeshowsAttended IF Phase 1 maps otherNewNames to exclude them — see Phase 1 item 2.

### LEVEL_THRESHOLDS — rescale (both copies)

Rookie 0 · Associate 500 · Pro 1,500 · Elite 3,500 · Legend 7,000. Titles unchanged. Mark in docs as provisional — tune against real pilot data after 4–6 weeks.

### Badges — unchanged this PR.

---

## Phase 1 — recon (HARD STOP — paste findings back before Phase 2)

1. **Field-key inventory.** For every newly scored activity, the exact submission field key as written by the wizard (step component + extractFields + INITIAL_DATA + submissionService). Flag any that don't exist or differ from the table's assumed names — especially appointmentsSet, serviceCalls, and the Step 6 service-work keys.
2. **otherNewNames composition.** Enumerate the names channels (referralsObtained, namesFromColdCanvass, namesFromOther, namesFromSeminarsConducted, namesFromTradeshowsAttended). Propose the mapping: referralsObtained scores at 3; which remaining channels sum into otherNewNames at 1? Watch double-pay: seminar/tradeshow EVENTS score 10/5 — their names CAN also score 1 as names (a name is a name), but state the choice explicitly for ruling.
3. **Nested vs flat schema.** Confirm computePoints reads fields the same way for both schema arms (the wizard's nested steps vs flat), and where the after.X reads resolve for Step 6 conditional service-work fields when the toggle is No (absent vs 0).
4. **Cap mechanics.** Confirm computePoints is per-submission (it is, per #556) — so the letters cap is per-submission, which for weekly reports = per week. If daily/multiple submissions per week are possible, flag it: the cap basis changes.
5. **Tests baseline.** Confirm the #556 regression fixture's expected totals and which tests must be updated for the new scale and thresholds.

---

## Phase 2 — implement

1. Update POINTS_WEIGHTS + LEVEL_THRESHOLDS in **both** config copies (functions/lib + src/lib) — cross-check test keeps them honest.
2. Extend computePoints: new weighted terms (Math.floor pattern), letters cap via Math.min(value, 20), reinstated-API floor-division term. Every term reads the config — no inline literals.
3. Add the excluded-fields documentation to the config (so PR2's panel can render "not scored" honestly if we choose).

## Phase 3 — verify

1. Update the regression fixture to the new expected totals (it now guards THIS scale).
2. New tests: one per category group minimum; the letters cap (25 letters → 20 pts); reinstated API floor; threshold boundaries (499→Rookie? no—Associate at 500: test 499/500); zero-valued and absent service-work fields (toggle No) contribute 0 without NaN.
3. Lint + Vitest + functions Jest + build green. Cross-check test passes with the new values.

## Phase 4 — docs (placeholders)

1. Record the head-of-sales sign-off on the scale (date, scope) — board-safe provenance, same pattern as the career levels.
2. Mark thresholds provisional, tune at pilot week 4–6.
3. Bank: weekly points summary surface ("You earned N points this week" on submission) — the pride moment is weekly; decide at PR2 whether it folds into the panel PR or follows.

## Phase 5 — commit / push / PR

Standard: human-merge (CF change), HEAD SHA in report (Rule 20), Gemini dispositions (Rule 21).

## Deploy + smoke (post-merge-and-deploy)

`firebase deploy --only functions`, gate on "Deploy complete!". Smoke via setupBypassSession: submit a report exercising at least one field from each category group (a dial, f2f, letters>20 to prove the cap, a referral, an appointment, FFI, a delivery, a service-work field with toggle Yes) → read leaderboard/{uid} → assert exact expected total against the config, and assert level resolves correctly against the NEW thresholds.

## Boundary

- No badge changes, no reset-model change, no UI — PR2 renders this scale.
- If Phase 1 finds a scored field that doesn't exist in submissions, STOP and report — we adjust the scale to reality, not the reverse.
