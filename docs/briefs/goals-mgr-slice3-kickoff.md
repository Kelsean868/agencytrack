# Goals Manager Slice 3 — Kickoff Brief

**Date:** 2026-06-14
**Status:** RECON COMPLETE — product calls needed before Phase 2
**Recon spec:** `docs/goals-mgr-slice3-recon.md`

---

## Decisions locked

None yet. Three open questions require dispatcher calls (see § Open questions).

---

## Recon summary

### What shipped in Slice 1 + Slice 2

- **Slice 1 (PR #615):** recommend-vs-lock model, `gamePlanCommitted` flag, agent
  cascade floor, `meta?.locked` guard in `commitPlanService`.
- **Slice 2 (PR #618):** `RecommendLockDrawer` bottom-sheet, manager target setting per
  agent row in `GoalsPanel`, `BelowLockedTargetError` + locked-floor enforcement in
  `commitPlanService`.

### Three candidate slices for v3

| # | Slice | Category | Gate |
|---|-------|----------|------|
| 2a | `LockToggle` DRY extraction — shared primitive from `GoalsPanel.jsx:158-185` | Mechanical | AUTO-MERGE eligible once green |
| 2b | `LockedBadge` undefined→default behavior | Product decision | HOLD — dispatcher call |
| 2c | Manager `goals.suggest.api` nudge — propose personalAnnualAPI to agent via `NUDGE_CONFIG` extension | Feature / BUILD-AND-HOLD | Dispatcher calls on 4 open Qs |

---

## Open questions (product calls required)

1. **LockedBadge default**: when `targetLocked` is absent (legacy targets pre-Slice-2),
   should the badge render as "Suggested" (`false`) or nothing (`null`)? Currently `null`.

2. **Nudge entry point**: GoalsPanel agent row only, or also from any other manager surface
   (e.g. GapAnalysisPanel manager overlay, Commission AnchorStrip manager view)?

3. **Pre-fill on notification click**: when the agent taps the `goals.suggest.api` bell
   notification, should the link carry `suggestedAPI` as a URL param to pre-fill the
   GoalDecompositionTab input? Or inform-only (agent manually enters the value)?

4. **Cooldown window**: 24-hour (same as compliance nudges) or different for goal suggestions?

**Dispatcher STOP required** on questions 2–4 before Phase 2 work on slice 2c begins.
Slice 2a (DRY extraction) can proceed independently without any of these answers.

---

## Phase 1 source-verify commands (before Phase 2 on any slice)

```powershell
# 2a — confirm LockToggle is inline-only (not already shared)
git grep -n "LockToggle" -- src/

# 2a — confirm RecommendLockDrawer does NOT import LockToggle
Select-String "LockToggle" src\components\goals\RecommendLockDrawer.jsx

# 2c — confirm nudgeService function names
Get-Content src\services\nudgeService.js | Select-String "export"

# 2c — confirm rules nudges block does NOT filter by type
Select-String "goals\.suggest\|type.*nudge" firestore.rules

# 2c — confirm GoalDecompositionTab CTA can accept pre-fill
Select-String "setApi\|suggestedAPI\|initialApi" src\components\goals\CommissionPlayground\tabs\GoalDecompositionTab.jsx
```

---

## Phase 2 scope (2a only — pending dispatcher on 2b/2c)

**`src/components/goals/LockToggle.jsx`** — new shared primitive:
```jsx
// Recommend/Lock toggle used in GoalsPanel + RecommendLockDrawer
export default function LockToggle({ locked, onChange }) { ... }
export function LockedBadge({ locked }) { ... }
```

**`GoalsPanel.jsx`** — delete inline `LockToggle` + `LockedBadge` functions (lines 138–185);
import from shared file.

**`RecommendLockDrawer.jsx`** — replace inline toggle with `<LockToggle locked={!locked} onChange={...} />`.
The drawer's recommend/lock styling is currently fully inline — must align className contract
with the shared primitive.

---

## Files affected (2a only)

```
src/components/goals/LockToggle.jsx           NEW
src/components/goals/RecommendLockDrawer.jsx  EDIT — remove inline toggle, import shared
src/components/manager/GoalsPanel.jsx         EDIT — remove inline functions, import shared
src/components/goals/__tests__/LockToggle.test.jsx  NEW — RTL coverage for shared primitive
```

---

## Files affected (2c — pending dispatcher)

```
functions/compliance/sendComplianceNudge.js          EDIT — NUDGE_CONFIG new entry
functions/compliance/sendComplianceNudge.test.js     EDIT — new type test cases
functions/email-templates/goals-suggest-api.txt      NEW
functions/email-templates/goals-suggest-api.html     NEW
src/components/manager/GoalsPanel.jsx                EDIT — "Suggest API" row action
src/services/nudgeService.js                         EDIT — optional convenience wrapper
```

---

## Acceptance criteria (2a only)

- [ ] `LockToggle` + `LockedBadge` render identically before/after extraction (visual parity).
- [ ] `GoalsPanel` unit + RTL tests remain green (no behavior change).
- [ ] `RecommendLockDrawer` tests remain green.
- [ ] New `LockToggle.test.jsx` covers: recommend active / lock active / toggle direction / disabled states.
- [ ] `npm run lint && npm test && npm run build` clean.
- [ ] Smoke: GoalsPanel toggle + drawer toggle both function after extraction.

---

## Self-critique (Rule 22)

- RecommendLockDrawer's toggle className contract was not fully diffed against GoalsPanel's
  `LockToggle` — Phase 1 must compare both before unifying.
- `LockedBadge` is used only in GoalsPanel currently; co-locating it in the same shared file
  as `LockToggle` is the proposed shape but could be a separate file — Phase 1 judge.
