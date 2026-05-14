# Mobile FU#2 — non-core agent tap-target pass — kickoff brief

**Scope:** three P1 items from `docs/FOLLOW_UPS.md:911-916` "Mobile audit — deferred items" → "Mobile follow-up #2 — Non-core agent surface P1s". Two resolve with code changes; one resolves with a structural finding (already-resolved, documented in PR description).
**Size:** ~10 LOC source + ~3 RTL tests + smoke walk. Single PR, three files touched.
**Severity:** mobile a11y / WCAG 2.5.5 target size compliance. Low impact (non-core surfaces) but easy to close.

---

## Goal

Close all three P1 items from Mobile FU#2:

- **P1-1** — `CareerPortal` editing-mode button trio (Edit / Cancel / Save) all bump to 44px tap target. **DECISION LOCKED: extend the fix to Cancel/Save siblings**, not just the named Edit button — same class, same surface, fixing only Edit creates a worse pattern when Cancel/Save are revealed.
- **P1-2** — `History` row eye/preview button. **DECISION LOCKED: close as already-resolved-structurally** — the entire row IS the `<button>` with `card` class (`p-6` ≈ 78px hit area); the Eye icon is decorative inside. No code change for this item. PR description documents the structural finding so future audits don't re-flag it.
- **P1-3** — `CommissionPlayground` accordion toggle. Add `min-h-[44px]` to the button. **DECISION LOCKED: minimal-diff approach** (do not restructure card padding).

### Out of scope (explicitly banked or deferred)

- P1-2 aria-label gap (button's visible label is "Week of {date}", Eye icon needs SR explanation). **Bank as new FU** — separate concern from tap-target; deserves a comprehensive aria sweep, not a one-off fix.
- The text-link "Show monthly / weekly" toggle in CareerPortal (CC's audit flagged this as likely sub-44px but excluded from P1 scope). Stays out of scope here.
- Any other mobile cosmetics or react-hooks warnings in the LOW queue.
- Any source file beyond `CareerPortal.jsx` + `CommissionPlayground/index.jsx`.

---

## Strike rules

- Two-strike rule applies. Session opens at **0/2**. Project carry-in is **0/2**.
- Strike triggers: token leak in any artifact, source-code change outside the two named files, scope creep into aria-label or text-link toggle, direct push to main on feature branch (Phase 8 docs-direct-to-main exception applies).

---

## Hard stops (STOP and surface)

- Phase 1 confirmation finds CC's audit was wrong about any of the three items → surface with corrected state, await direction
- Implementation requires touching `AgentDashboard.jsx` for P1-2 → STOP (P1-2 should resolve with zero code change per the decision lock)
- Test regression in any suite → STOP and fix
- Lint or build fails → STOP and fix
- Smoke walk reveals any of the three target heights are still < 44px after fix → STOP and surface
- Strike count hits 2 → STOP

---

## Phase 1 — Re-confirm before edits (lightweight)

CC's audit already established the targets. This phase is a quick sanity-check the file state hasn't drifted since the audit:

1. `git log --oneline -5 src/components/profile/CareerPortal.jsx` — confirm no recent changes
2. `git log --oneline -5 src/components/goals/CommissionPlayground/index.jsx` — confirm no recent changes
3. Re-read the target line ranges (CareerPortal:175-200, CommissionPlayground/index.jsx:19-33) to confirm classes are still as audited

Brief Phase 1 confirmation, then proceed to Phase 2 without further surface.

---

## Phase 2 — Implementation

### P1-1 — `src/components/profile/CareerPortal.jsx:175-200`

Update the editing-mode button trio (Edit, Cancel, Save). Currently all three use `h-8 px-3 text-xs`. Change to:

- `h-11 px-4 text-sm` (44px height, slightly more horizontal padding to balance, slightly larger text)

Or equivalent — CC's call on whether to use `h-11` or `min-h-[44px]`. The button currently has explicit `h-8` which collides with `min-h-[44px]` semantically; using `h-11` (44px exact) is cleaner. Keep all other classes (colors, hover states) untouched.

Apply to all three buttons in the editing-mode trio:
- "Edit My Goals" (display mode)
- Cancel (`X` icon, editing mode)
- Save (`Check` icon, editing mode)

### P1-3 — `src/components/goals/CommissionPlayground/index.jsx:19-33`

The accordion toggle `<button>` currently has no explicit height. Add `min-h-[44px]` to its class list. Preserve all other classes (flex, gap, alignment).

**Why `min-h-[44px]` here vs `h-11` for P1-1?** P1-1's buttons have a fixed-height design language (consistent height across the trio matters more than content-driven height). P1-3's accordion toggle contains variable content (text + chevron) and should remain content-driven with a floor — `min-h-[44px]` matches the existing design pattern better.

### Tests to add — `src/components/profile/__tests__/CareerPortal.test.jsx` and `src/components/goals/CommissionPlayground/__tests__/index.test.jsx`

These are CSS class assertions, not behavior tests. RTL can't measure pixel heights, so we assert the className contains the expected utility:

1. **CareerPortal:** assert "Edit My Goals" button has `h-11` in its className
2. **CareerPortal:** simulate clicking Edit, then assert Cancel + Save buttons both have `h-11`
3. **CommissionPlayground:** assert accordion toggle button has `min-h-[44px]` in its className

If either test file doesn't already exist, create it with minimal setup matching the project's test conventions. If they do exist, append the new cases.

Target: +3 test cases. Project total: ~677 + 3 = ~680.

### P1-2 — Zero code change

Document the structural finding in the PR description (template provided in Phase 6 below). Do NOT touch `AgentDashboard.jsx` for this PR.

---

## Phase 3 — Local verification

- `npm run lint` → 0 errors (pre-existing warnings unchanged)
- `npm test -- --run` → all pass (expected ~680)
- `npm run build` → green, no new warnings
- Capture all three output summaries for the PR description

---

## Phase 4 — Docs with placeholders

### `docs/CONTEXT.md`

1. **Top table:** update HEAD SHA + active/next track lines with `<sha>` placeholder + this PR scope
2. **Recently-shipped table:** prepend a new row:
   ```
   #<pr#> | <sha> | fix(mobile): tap-target pass for non-core agent surface (FU#2 P1-1 + P1-3; P1-2 already-resolved)
   ```
3. **Drop the oldest row** from the recently-shipped table (cap is 5)
4. **"Where we left off":** rewrite to describe FU#2 closure, the P1-2 structural finding, and what's next in queue

### `docs/FOLLOW_UPS.md`

1. Locate the **Mobile FU#2** section at lines 911-916
2. Mark all three P1 items resolved:
   ```
   - ✅ **P1-1** — CLOSED by PR #<pr#> (<sha>): CareerPortal Edit/Cancel/Save buttons bumped to 44px
   - ✅ **P1-2** — CLOSED by PR #<pr#> (<sha>): already-resolved structurally (entire History row is the button at p-6 ≈ 78px; Eye icon decorative)
   - ✅ **P1-3** — CLOSED by PR #<pr#> (<sha>): CommissionPlayground accordion toggle gets min-h-[44px]
   ```
3. **Add a new FU entry** under whatever section is appropriate (likely a11y / aria sweep section):
   ```
   - [ ] **History row aria-label** — `AgentDashboard.jsx:722-747` History row button has only "Week of {date}" as visible text; Eye icon is decorative. Add `aria-label="Preview submission from week of {date}"` (or similar) for SR clarity. Surfaced during Mobile FU#2 P1-2 closure audit; defer to a comprehensive aria sweep rather than one-off fix.
   ```

---

## Phase 5 — Commit, push, open PR

1. Feature branch: `fix/mobile-fu2-tap-targets`
2. Commit organization:
   - Source: `fix(mobile): bump non-core agent tap targets to 44px (FU#2 P1-1 + P1-3)`
   - Tests: `test(mobile): class-presence assertions for FU#2 tap-target fixes`
   - Docs: `docs: bank PR-<pr#> placeholders + new aria-label FU`
3. Push the feature branch (NOT main)
4. PR title: `fix(mobile): tap-target pass for non-core agent surface (FU#2)`
5. PR description content (write this verbatim, filling the placeholders):

```markdown
## Summary

Closes Mobile FU#2 P1-1 + P1-3 with code changes. P1-2 closed via structural finding (no code change needed).

### Changes

- **P1-1** — `CareerPortal.jsx:175-200`: editing-mode button trio (Edit / Cancel / Save) bumped from `h-8 px-3 text-xs` to `h-11 px-4 text-sm`. Brief extended scope from "Edit only" to all three siblings — same class, same surface, fixing only Edit would create a worse pattern when Cancel/Save are revealed in edit mode.
- **P1-3** — `CommissionPlayground/index.jsx:19-33`: accordion toggle button gets `min-h-[44px]`. `min-h-*` over `h-11` here preserves the variable-content design pattern.
- **P1-2** — `AgentDashboard.jsx:722-747` History row: **no code change**. Structural finding: the entire row IS the `<button>` with `card` class, which resolves to `p-6` ≈ 78px hit area. The `Eye` icon is decorative inside that hit area. P1-2's tap-target concern was already resolved before this PR existed; the original audit measured the icon size (15px) rather than the actual hit area. Banked as resolved in FOLLOW_UPS.md.

### Out of scope (banked as new FU)

- History row `aria-label` — separate a11y concern surfaced during P1-2 audit. Visible button label is "Week of {date}"; Eye icon needs SR explanation. Banked for comprehensive aria sweep, not addressed in this PR.

### Tests

+3 RTL class-assertion cases (one per fixed button). RTL can't measure pixel heights; smoke walk does that. Project test count: 677 → 680.

### Verification

- `npm run lint`: 0 errors
- `npm test -- --run`: 680/680 passing
- `npm run build`: green, no new warnings

### Smoke

[Filled in Phase 6 below — Playwright walk against Vercel preview measures actual `boundingClientRect()` heights for all three target buttons.]
```

6. Open the PR. Vercel preview deploys.

---

## Phase 6 — Production smoke (default per new CLAUDE.md rule)

Build a smoke script at `scripts/verification/mobile-fu2-tap-targets-smoke.mjs` using `setupBypassSession` from `scripts/verification/lib/walk-helpers.mjs`. Mirror the pattern from existing smoke scripts (`m5-weekly-champions-medals-smoke.mjs` is the most recent reference per memory).

### Smoke scope

Viewport: **mobile (390x844)** — these are mobile a11y fixes, smoke MUST run at mobile viewport to validate the actual user experience.

1. **Bypass + login** as agent (kelsean@gmail.com, password from .env.local — never echoed)
2. **CareerPortal — display mode:**
   - Navigate to profile / career portal surface
   - Locate "Edit My Goals" button
   - Assert `boundingClientRect().height >= 44`
3. **CareerPortal — editing mode:**
   - Click "Edit My Goals"
   - Locate Cancel (X icon) button
   - Assert `boundingClientRect().height >= 44`
   - Locate Save (Check icon) button
   - Assert `boundingClientRect().height >= 44`
4. **History row regression check (P1-2 verification):**
   - Navigate to AgentDashboard History tab
   - Locate first row button
   - Assert `boundingClientRect().height >= 44` (this should pass without changes; if it fails, P1-2's already-resolved finding is wrong)
5. **CommissionPlayground:**
   - Navigate to goals / commission playground surface
   - Locate accordion toggle button
   - Assert `boundingClientRect().height >= 44`
6. **Screenshots:** capture mobile viewport screenshots of each surface (5 screenshots minimum) for the PR description

### Smoke gates

- All five height assertions pass
- No console errors
- All screenshots captured

If any assertion fails:
- A target height < 44 on P1-1 or P1-3 surface: implementation bug, STOP and fix
- A target height < 44 on P1-2 History row: structural finding is wrong, STOP and surface (this may require reopening P1-2 with a real code change)

### Update PR description

Replace the "Smoke" section in the PR description with:
- Smoke results (5/5 passing or actual numbers)
- Screenshot list
- Any noteworthy observations

---

## Phase 7 — STOP

DO NOT MERGE. Kyron reviews, approves, squash-merges via GitHub UI. Once Kyron messages **"PR #<N> merged"**, CC executes Phase 8.

---

## Phase 8 — Post-merge cleanup (wait for Kyron's merge confirmation)

Execute **only after** Kyron confirms the merge:

1. `git checkout main && git fetch origin --prune && git pull origin main`
2. `git log origin/main --oneline -1` — capture squash SHA
3. Fill `docs/CONTEXT.md` SHA + PR# placeholders
4. Fill `docs/FOLLOW_UPS.md` SHA + PR# placeholders for all three P1 items + the new aria-label FU
5. Commit: `docs: fill #<N> squash SHA + PR# placeholders`
6. `git push origin main` (docs-direct-to-main exception applies)
7. Remove worktree if one exists; delete branch `fix/mobile-fu2-tap-targets`
8. Surface in chat: `Phase 8 complete. #<N> placeholders filled at <sha>. Worktree + branch cleaned.`

---

## What success looks like

After this PR merges:

1. CareerPortal editing-mode trio all hit 44px (P1-1)
2. CommissionPlayground accordion toggle hits 44px (P1-3)
3. History row's already-resolved tap-target status is permanently documented (P1-2)
4. Mobile FU#2 section in FOLLOW_UPS.md is fully closed
5. A new aria-label FU is banked for the future comprehensive aria sweep
6. Smoke methodology shifts visibly: this is the first PR run under the new CLAUDE.md default (smoke is CC's default, not Kyron's manual check)
7. Tier 2 refinement queue advances; next up is the remaining LOW items per FOLLOW_UPS.md
