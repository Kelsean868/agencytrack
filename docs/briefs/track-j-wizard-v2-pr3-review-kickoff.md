# Track J — Wizard v2, PR3: Review Step + Jump-Backs + Celebration

**Type:** REDESIGN (final slice of the 3-PR arc).
**Merge:** Human-merge + dispatcher pre-review. NOT auto-merge.
**Arc:** PR3 of 3. PR1 (shell) + PR2 (compute layer) shipped. This completes the v2 wizard.

**Source mockup:** `design_handoff_v2_app/mockups/wizard-v2-screens.jsx` — the Step 12 "Review & submit" content and the celebration are drawn in full there. Read them for the visual implementation; this brief supplies the mechanics + decisions.

---

## Locked decisions feeding this PR

- **Compute reuse** — the Review's displayed totals use the SAME `computeWizardLive` lib + canonical functions from PR2 (`computeTotalProductionCredit`, `computeTotalNewNames`, etc.). The Review and the Week-So-Far panel must show identical numbers. No re-derivation.
- **Submit path preserved** — moving the submit trigger from step 11 (PR1's interim terminal) to the new step 12 must NOT change the submitted payload or the `submitReport` signature. Shape-identical to PR1/PR2.
- **Celebration = messaging only** — the "now visible on the team leaderboard" copy reflects the EXISTING submit→aggregate-CF→leaderboard path. No new leaderboard wiring; just confirm submit still triggers the existing aggregation.
- **Goals are displayed, not seeded** — the Review shows the next-week goals the agent entered in step 11 as-is. Goal-seeding stays the deferred decision-A FU; do not seed defaults.
- **Fold in the orphaned testid** (LOW FU from #418): add `data-testid={`${testid}-value`}` to the `<p>` holding `{value}` in `WeekSoFarPanel.jsx`'s `Scorecard`, and optionally simplify `readPanelLive` in the smoke. This is the only PR2-area edit; everything else is the Review/celebration.

---

## Phase 1 — source-verify FIRST

1. Read the Step 12 Review + celebration in the mockup. Confirm the section layout, the per-section "Edit · Step N" jump-back targets, and the celebration content/trigger.
2. Confirm the **section→step mapping** for the Edit jump-backs (which review section jumps to which of the 12 steps), and that PR1's visited-step navigation supports the jump.
3. Confirm the current submit invocation (post-PR1, step 11 calls `submitReport`). The plan: step 11 becomes a normal step, step 12 (Review) carries the submit. Verify the move does NOT alter the payload or signature.
4. Confirm the submit→leaderboard coupling is **existing** (the aggregate CF picks up the new submission). If the celebration's leaderboard claim would require NEW wiring → **STOP and wait for dispatcher** (that's a cross-surface change, not a port).

**Surprise-stop:** submit-move would change the persisted shape; OR the celebration needs new leaderboard wiring. Otherwise proceed (no mandatory mid-build checkpoint — the arc's compute + nav are proven).

---

## Phase 2/3 — build

1. **Review step (step 12)** — discrete terminal step in the v2 pagination. Renders: per-section summaries of the entered values (grouped by phase), the computed totals via the PR2 compute lib (Production API, total apps, conversion, est. commission — reusing the canonical functions), and the entered next-week goals. Mockup-faithful layout.
2. **Edit · Step-N jump-backs** — each section header carries a jump affordance to its source step, using PR1's visited-step navigation. Returning to Review after an edit preserves state + autosave.
3. **Move submit to step 12** — step 11 becomes a normal Next; the Review step's submit button calls the existing `submitReport` (unchanged signature/payload). Footer: Next → "Submit report" on step 12 (mobile + desktop).
4. **Celebration** — on successful submit, render the celebration (confetti + "visible on the team leaderboard" messaging) per the mockup. No new data wiring.
5. **Mobile** — hide the live strip on the Review step (`showLiveStrip={false}`); Next becomes "Submit report".
6. **Fold in the value testid** per the decision above.

Nexus tokens, 44px targets, motion-reduce safe (confetti must respect `prefers-reduced-motion`), no new hardcoded hex.

---

## Phase 3f — verification

1. **Payload-identity regression:** the submission produced through the step-12 Review submit is identical (shape + values) to PR1/PR2's. Moving the trigger must not change a stored field.
2. **Review↔panel parity:** the Review's computed totals equal the Week-So-Far panel's for the same inputs (same compute lib — assert it).
3. **Component tests:** Review renders section summaries + totals + goals; each Edit·Step-N pill navigates to the correct step and back; submit button calls `submitReport`; celebration renders on success and respects reduced-motion; mobile live-strip hidden on Review.
4. Lint + full vitest + build green.
5. **Smoke (write-read-verify, both themes):** fill a full WAR through all 12 steps → reach Review → assert the Review shows correct computed totals + section summaries → submit from Review → reload → assert persisted (shape unchanged) + celebration shown. Use an unsubmitted week, cleanup to 0, re-delete the service-account-key (Rule 4).

---

## Phase 4 — docs with placeholders

- `docs/CONTEXT.md`: recently-shipped row (`#TBD/{TBD}`); Next-track = post-wizard pickups (legacy-step retirement becomes actionable; the deferred FUs). Check/clean double-Next-track-row.
- `docs/track-j-port-ledger.md`: Wizard row → **FULLY PORTED** (PR1 shell + PR2 compute + PR3 review/celebration complete); advance the headline count.
- `docs/FOLLOW_UPS.md`: fill PR3 placeholder; mark the **value-testid** LOW FU resolved (folded in); note the **post-PR3 legacy-step retirement** FU is now actionable (the v2 wizard is the complete flow; legacy single-file-move steps + the duplicate-id can be addressed in the retirement pass).

## Phase 5 — commit / push / PR

Open PR, STOP, do not merge (Rule 19). **Per Rule 20: the ready-report names the feature-branch HEAD SHA.** Report for pre-review.

---

## Out of scope

SUGGESTED atom + goal-seeding (decision-A FU) · mobile expand-to-sheet (FU) · social-channel inclusion in canonical aggregations (FU) · the Step4 duplicate-id fix (separate decision/FU — its protected legacy file is addressed in the retirement pass, not here) · legacy-step retirement itself (separate post-PR3 pass) · any change to the persisted submission shape.
