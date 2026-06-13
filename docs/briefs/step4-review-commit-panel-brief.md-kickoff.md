# Review & Commit — Commit Panel (Game Plan Step 4, Slice 3 of 4)

## Context
Slices 1–2 shipped the headless commit: the atomic transaction (commitPlanService) that
enforces the tenure-scaled API floor + the flat-42 apps floor at the agent's own average,
throwing three typed errors. This slice is the **UI over it** — the modal the agent opens
from Step 4 to review the whole plan and commit it. The one consequential write in the
loop earns a deliberate confirm and a terminal done state. Gated behind
`VITE_YEAR_PLAN_ENABLED` so it stays dark until the un-gate.

Design source: CD's `Review & Commit Panel — Step 4 Build`, with the field/floor
reconciliations from Slices 1–2 applied. Structural template: `YearPlanModal` /
`MonthlyPlanModal` chrome + the Step-open wiring those used.

## Decisions locked (do not re-litigate — surface ANY deviation before implementing)

**The modal — `ReviewCommitModal.jsx` (new).** Clone the planning-modal chrome (scrim,
panel, header, footer, ≥44px, focus handling consistent with the others — the focus-trap
gap is a tracked un-gate-prep item, don't solve it here). Flow, in order:
`PlanReview` → `CommitConsequence` → `CommitConfirm` → `CommittedDone`.

**`PlanReview` (read-only).** The whole plan in one place, no edits here (each block links
back to its step): the annual hero (committed annual API, **apps at the agent's own
average** now that Slice 2 made that consistent, est. commission, award tier), the per-line
allocation from Year Plan, the 12-month shape from Monthly, the implied activity from the
existing decomposition. Pure read off the loaded `yearPlan` + `monthlyPlan` + `goals` +
`submissions` — no new figures.

**`CommitConsequence`.** Plain words — "This sets your personal annual target to TTD X and
starts tracking you against it" — plus the 5-layer Goals cascade (Company Floor → Sales
Manager → Branch → Unit → **Personal Commitment**, the only layer the agent writes,
highlighted). States plainly that committing needs no manager approval (the
manager-visibility lean).

**`CommitConfirm`.** The deliberate moment — a recap + an explicit "Yes, commit my plan" /
"Not yet." Never a one-tap save. Re-commit (below) routes back through this same confirm.

**`CommittedDone`.** Terminal — a dated seal in Trinidad time ("Committed TTD X · 13 Jun
2026"), the now-live target, the loop reading 4/4 · 100%, and the re-open affordance.

**The commit call + the five states.** The CTA calls `commitPlan` (Slices 1–2). Handle:
- `committing` — in-flight, CTA disabled, no double-commit.
- `incomplete-loop` — Year Plan or Monthly not drafted; the review points to the missing
  step, not a dead CTA.
- `BelowApiFloorError` — "Your plan's TTD X is below your TTD Y floor — raise it in Year
  Plan," linking back.
- `BelowAppsFloorError` — "Your plan works out to N apps, below the 42 minimum — plan
  more (or smaller) policies, or raise your API," linking back to Year Plan.
- `AvgPolicyMissingError` → **the inline average-policy capture (key — this is common,
  per Slice-2 recon).** Don't bounce the agent to the Playground. Show an inline field —
  "Your average policy size: TTD ___" — that on submit writes `goals.playgroundAvgPolicyAPI`
  (via the existing `setGoals` self-write allowlist), then re-resolves apps + re-runs the
  floor checks in place. The agent sets it once, right here, and proceeds.
- `write-failed` — the atomic write rolled back, nothing changed, "Retry" re-attempts the
  whole transaction.

**Re-commit — lean OPEN.** After committing, the plan stays re-openable: `CommittedDone`
shows "Committed TTD X on {date} — re-open to change it," and re-committing routes back
through `CommitConfirm` (a new target is as deliberate as the first), overwriting
`personalAnnualAPI` + a fresh `committedAt`. Implement the **open** path. The locked
variant ("Committed for 2026 · locked," manager-reset to change) is a one-flag swap
(`recommitPolicy: 'open' | 'locked'`) with no layout change — leave the seam, don't build
the locked UI. *(Flag for Kyron: confirm open vs locked.)*

**Manager visibility — lean NONE.** Committing writes the agent's own cascade layer; no
approval gate, not blocked on a manager. The consequence card says so. A manager seeing
the committed number is a separate read surface (deferred). *(Flag for Kyron: confirm.)*

**Open wiring (mirror Year Plan / Monthly).** Add `onOpenReviewCommit` to `StepRail`,
gate Step 4's clickability behind the flag + "active once Monthly is drafted," and mount
`ReviewCommitModal` in `GamePlanV2/index.jsx`, passing the loaded plans + goals +
submissions. (Step 4 *status* token + the Commit rung lighting + completeness → 100% are
**Slice 4** — this slice only opens the modal.)

### Deferred OUT of this slice
- StepRail Step 4 status + Commit rung green/dated-seal + completeness → 100% (un-gate
  trigger) → **Slice 4**.
- The locked re-commit UI; manager acknowledgement/approval; commitment history/audit;
  branch roll-up → deferred per the annotation.
- Whether average policy size belongs in the *required* Money Needs step (so it's always
  set by commit) → a later flow question; the inline capture handles it now.

## Phase 1 — recon (report findings inline, then PROCEED through the build)
**Only stop if a finding contradicts a locked decision.**
1. `YearPlanModal` / `MonthlyPlanModal` chrome + their Step-open wiring (`onOpen*`,
   clickability gate, the GamePlanV2 mount) — to mirror for Step 4.
2. `commitPlanService` (Slices 1–2) — the `commitPlan` signature + the three typed error
   classes to catch and branch on.
3. `setGoals` self-write of `playgroundAvgPolicyAPI` — confirm the agent can write it (the
   allowlist) for the inline capture, and the call signature.
4. The loaded `yearPlan` / `monthlyPlan` / `goals` / `submissions` on GamePlanScreen — all
   present for the review (reuse; no refetch). Confirm the award-tier + est-commission
   sources for the hero (existing decomposition / awardsRuleset).
5. The 5-layer Goals cascade display — is there an existing component/shape for the
   hierarchy (getGoalHierarchy) to reuse in `CommitConsequence`, or is it drawn fresh?

## Phase 2 — modal shell, states, open wiring
- `ReviewCommitModal` + the state machine (committing / incomplete / below-API /
  below-apps / missing-average-with-inline-capture / failed / done); the `commitPlan`
  call + error branching; StepRail `onOpenReviewCommit` + gated clickability + the mount.

## Phase 3 — the four sub-surfaces
- `PlanReview`, `CommitConsequence` (with the cascade), `CommitConfirm`, `CommittedDone`
  (+ the open re-commit affordance). Both themes; tokens only.

### Tests (RTL)
- Incomplete loop → review points to the missing step, CTA not a dead button.
- Below-API and below-apps → the right message + link, no write.
- Missing average → the inline field renders; submitting it writes `playgroundAvgPolicyAPI`
  and re-runs the check (mock `setGoals` + `commitPlan`).
- Happy path → confirm → `commitPlan` called → done state shows the dated seal + 100%.
- Re-commit (open) → done state offers re-open → routes back through confirm.
- Flag OFF → Step 4 not clickable / modal unreachable.

## Phase 4 — docs (with placeholders)
- PR row; cross-reference Slices 1–2 + CD's annotation.
- Bank for Slice 4: Step 4 status + Commit rung + 100%. For un-gate prep: nothing new.
- Confirm-with-Kyron seams noted: `recommitPolicy` (open shipped, locked = flag swap);
  manager visibility (none).
- CONTEXT.md: gated UI — does not advance Current main HEAD per Rule 16(b) (like the other
  panel slices); update the Active track row only.

## Phase 5 — commit / push / PR
- Branch `feat/review-commit-panel`.
- `feat(commit): step 4 slice 3 — review & commit panel`.
- Push; PR; **Rule 21** Gemini; **Rule 20** HEAD SHA.

## Smoke
This is the first UI that triggers a real commit, so it carries the **live write-read
smoke**: flag on in the Vercel preview → open Step 4 → (set average if prompted) → commit
→ assert `goals.personalAnnualAPI` written + both plan statuses `committed` + `committedAt`
set → reload → assert persisted. Run it flag-on in preview (Slices 1–2 are live in code,
no rules change needed). RTL covers the gated paths; this smoke is the end-to-end proof.

## Merge posture
New hub UI — the review, the commit moment, the done state all carry real aesthetic +
product judgment — so **human-merge** per the standing rule, like every other panel slice.
Hold the PR; eyeball the full flow (including the inline average capture and a below-floor
state) in a flag-on preview before merge. No deploy (gated; no rules change).
