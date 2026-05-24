# Track D — Awards Ruleset Editor, Array/Tier groups (D2b, Phase-1-FIRST kickoff)

**Track:** D, P-b. Follows D2a (#287, `77814ed`) which shipped the scalar editor: `AwardsRulesetPanel.jsx` (12 scalar accordion sections) + `setAwardsRuleset` (completeness guard over all 16 groups, recursive numeric validation that SKIPS arrays, plain `setDoc` no-merge) + the 4 array groups rendered READ-ONLY with a "coming in follow-up" note.
**Type:** Feature (extends the existing panel). **Size:** M-L. **Risk:** Medium — array add/remove/edit + must keep the complete-ruleset-write invariant intact.
**Goal of the eventual PR:** make the 4 array groups editable — clubAward.tiers, managerMonthlyBonus.tiers, recruitingAwards, activityAwards — replacing D2a's read-only rendering with row editors, while still writing the COMPLETE ruleset.

**PHASE-1-FIRST.** Source-verify, report, STOP — no code. The dispatcher locks Phase 2-5 (row-editor UX, per-row validation, service array-validation extension, tests) before you resume.

---

## Phase 0 — clean main
git checkout main
git fetch origin
git pull --ff-only origin main
git status
Untracked scripts/verification/ + scripts/seed/ expected — ignore. Do NOT create the branch during Phase 1 (read-only).
Hard stops (Rule 12): not on main, dirty tree beyond known untracked, pull conflict -> `STOP and wait for dispatcher`.

---

## Phase 1 — source-verify, then HARD-STOP

Report each with file:line + short quotes. Pair grep with `git ls-files`. Then emit `STOP and wait for dispatcher`.

1. **The 4 array shapes (the row-editor field maps).** From `src/config/awardsRuleset/2026.js`, enumerate the ELEMENT object shape of each: `clubAward.tiers[]`, `managerMonthlyBonus.tiers[]`, `recruitingAwards[]`, `activityAwards[]`. For each: the per-element fields, their types (currency/count/percent/string/bool), and how many elements ship by default. Note any element `id`/`name`/`label` identity fields and whether order is meaningful (tiers usually are).

2. **D2a panel array handling.** In `AwardsRulesetPanel.jsx`, quote: the ARRAY_GROUPS config; how the 4 groups render read-only today; `buildPayload` (confirm it deep-clones `loadedRuleset` so arrays survive — D2b's row edits must flow INTO this same complete-object path); the `getAt`/`setAt` dot-notation helpers (do they handle array indices like `clubAward.tiers.0.apiThreshold`, or only object keys?); the form-state shape (flat string map) and how it would extend to array rows.

3. **Service numeric validation vs arrays.** In `awardsRulesetService.js`, quote `validateNumericFields` and confirm D2a's note that it SKIPS arrays. D2b must extend it to validate array-element numeric fields (finite, non-negative). Confirm the completeness guard still passes when arrays are edited (it checks the 16 top-level keys exist — editing array CONTENTS shouldn't trip it).

4. **Existing array-editing UI precedent.** Search the codebase for any add/remove-row editor pattern (lists where the user adds/removes/edits rows). If one exists, quote its add/remove/validate/reorder pattern — mirror it. If none exists, flag that the row-editor UX is net-new and recommend a minimal pattern.

5. **Validation + design constraints.** parseFloat-both-layers; the Nexus tokens used in D2a (h-11, bg-surface-raised, btn-primary, rounded-2xl, border-border); 44px touch targets for add/remove buttons; loading/error/empty states. Note how D2a's single "Save ruleset" bar + isDirty (JSON.stringify) would cover array edits too.

---

## Phase 1 Recommendations (report, do not implement)
- **Row-editor UX** per array group: add row / remove row / edit fields / reorder (y/n — recommend based on whether order is meaningful). Inline within the existing accordion section.
- **setAt for array indices** — does it need extending to traverse array paths, or a separate array-mutation handler operating on the loaded-ruleset deep-clone? Recommend.
- **Service array-validation extension** — exact rule (every numeric element field finite + non-negative; required identity fields present; non-empty arrays?).
- **Completeness invariant** — confirm array edits still produce a COMPLETE 16-group write (same buildPayload path).
- **Tests**: extend `setAwardsRuleset` tests for array-element validation (reject NaN/negative inside an array element; accept valid edited array); panel add/remove-row test. Pre-merge browser smoke: edit a club tier value + add/remove a row -> Save -> reload -> persists -> agent-side club award reflects it.
- **Split?** Is editing all 4 array groups one PR, or split (e.g. the 2 `.tiers` groups first, the 2 top-level arrays second)? Recommend based on shape divergence found in item 1.

**STOP and wait for dispatcher.**
