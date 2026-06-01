# Track J — Wizard v2, PR2: Live-Compute Layer (Week-So-Far panel + computations)

**Type:** REDESIGN (composition + computation; additive overlay on the PR1 shell).
**Merge:** Human-merge + dispatcher pre-review. NOT auto-merge.
**Arc:** PR2 of 3. PR1 (shell) shipped. PR3 = Review step + celebration. Build PR2 only.

**Source mockup:** `design_handoff_v2_app/mockups/wizard-v2-shared.jsx` (the `WeekSoFarPanel`, `computeWizardLive`, and the `NumField`/`CurrencyField` last-week atoms are drawn in full there). Read it for the panel's visual implementation; this brief supplies the mechanics + locked decisions.

---

## Locked decisions feeding this PR

- **(C) Conversion** = `apps ÷ ciConducted` (closing ratio), guarded to 0 when `ciConducted == 0`. Match the app's existing CI-conversion KPI so the wizard and the rest of the app agree.
- **(D) Production-API roll-up** = **derived, not a new stored field** — and it MUST reuse the canonical API formula the leaderboard/aggregate CF already uses, via a shared lib call, NOT a local re-implementation of `NB + PPP + 0.10×lumpsum`.
- **(E) Rate constants** = read `commissionRate` per-agent (already passed into `saveDraft` — confirmed available in PR1); put the lumpsum `10%`→API and `0.5%` commission rates in a named config module, not hardcoded in the panel.
- **(A) Suggestions** = the ONLY suggestion source in PR2 is **last-week actuals**, shown as passive "LAST WK · n" helper microcopy (the existing `lastWeek` atom). Do NOT wire the `SUGGESTED` atom and do NOT seed goals — both are the deferred decision-A FU.
- **Mobile panel** = build the collapsed live strip only (mockup-faithful). The expand-to-sheet variant is not drawn — bank it as a possible later enhancement, do not build it.

---

## Phase 1 — source-verify FIRST (no code until done)

1. **Locate the canonical API formula** the leaderboard/aggregate CF uses for weekly Production API. Confirm it equals the mockup's `newBusinessAPI + pppAPIInc + 0.10 × lumpsumGross`.
   - **If it matches** → expose/reuse it as a shared lib function the panel calls. Proceed.
   - **If it differs** → **STOP and wait for dispatcher.** The wizard panel and the leaderboard cannot show different Production-API numbers; which formula is canonical is a dispatcher decision. Report the exact divergence.
2. Confirm `commissionRate` is readable at panel render (PR1 found it in the `saveDraft` signature — confirm the v2 shell has it in scope).
3. **6-week sparkline source:** determine whether the agent's trailing 6 weekly Production-API values can be read from the existing weekly aggregates the leaderboard CF produces (reuse), rather than a fresh multi-week fetch. Use the existing source if available; if none exists, report before adding a new read.
4. **CALLS scorecard:** confirm `totalCalls` = sum of the existing Step2Telephone call fields (referral / followUp / cold / seminarTradeshow / service) and that the "Ref · F-up · Cold" sub maps to existing fields.
5. Confirm `lastWeek.*` values (api, apps, ciConv, calls, names) are available/recomputable for the delta chips — and that `lastWeek.ciConv` uses the same (decision-C) direction.

**Surprise-stop:** canonical API formula divergence (step 1) → STOP and wait for dispatcher.

---

## Phase 2/3 — build

1. **`computeWizardLive` lib** (pure functions, unit-tested in isolation):
   - `totalProductionAPI` — via the shared canonical formula (decision D), NOT re-implemented.
   - `totalApps` = `newBusinessApps + pppApps`.
   - `ciConv` = `apps ÷ ciConducted` guarded to 0 (decision C).
   - `estCommission` = `newBusinessAPI × commissionRate% + lumpsumGross × 0.5%` (rates from the config module, decision E).
   - 6-week API series for the sparkline (from the Phase-1 source).
2. **`WeekSoFarPanel`** — desktop right rail + mobile collapsed strip, per the mockup:
   - Hero: Production API + ▲/▼ delta chip (`total − lastWeek.api`, TTD, hidden when Δ=0 or no prior) + 6-bar sparkline (last bar = live in-progress, tinted) + Est. Comm caption.
   - 2×2 scorecards: APPS / CONV / CALLS / NAMES, each with sub-label + delta chip (CONV delta in pp). Deltas hidden when no prior-week value or Δ=0.
   - "Still to enter" hint — **computed** (steps/phases remaining), not the mockup's hardcoded "5".
   - Empty/partial states: faint `value || 0`; `TTD 0` for currency; no delta chips first-week.
   - Recalculates live on input.
3. **Last-week field hints** — wire the existing `lastWeek` atom ("LAST WK · n" / "LAST WK · TTD n") on the fields the mockup shows them on (display-only, not tappable). Decision-A `SUGGESTED` atom stays unwired.
4. **Integrate into the PR1 shell** — mount the panel in the desktop rail on every step; mount the mobile collapsed strip above the bottom nav. Reuse PR1's field components and form state; do not change the persisted shape or the submit path.

Nexus tokens, 44px targets, motion-reduce safe, no new hardcoded hex.

---

## Phase 3f — verification

1. **Compute unit tests:** each formula with known inputs → expected outputs, incl. the `ciConducted == 0` guard. **Canonical-API parity test:** the panel's `totalProductionAPI` equals the canonical CF formula's output for the same inputs (proves decision D reuse, not divergence).
2. **Component tests:** panel renders hero + scorecards + sparkline; delta chips show/hide correctly (prior present vs absent vs Δ=0); empty/partial states; "still to enter" count is computed; mobile strip renders and is hidden where appropriate.
3. Lint + full vitest + build green.
4. **Smoke (live, both themes):** open the v2 wizard → fill the production fields → assert the panel's Production API / APPS / CONV / CALLS / NAMES reflect the entered values live → submit → reload → assert the submission still persists unchanged (PR1's regression guard still holds). Clean up. Re-delete the service-account-key (Rule 4).

---

## Phase 4 — docs with placeholders

- `docs/CONTEXT.md`: recently-shipped row (`#TBD/{TBD}`); Next-track = Wizard v2 PR3. Check/clean double-Next-track-row.
- `docs/track-j-port-ledger.md`: Wizard row remains **PARTIAL** (shell + compute layer ported; Review/celebration pending PR3). Do not flip to fully-ported.
- `docs/FOLLOW_UPS.md`: fill PR2 placeholder; bank **mobile expand-to-sheet** (LOW, deferred) if not building it.

## Phase 5 — commit / push / PR

Open PR, STOP, do not merge (Rule 19). Report for pre-review.

---

## Out of scope

The discrete Review step 12 + Edit·Step-N jump-back + celebration (→ PR3) · the `SUGGESTED` atom + goal-seeding (→ decision-A FU) · the mobile expand-to-sheet (→ LOW FU) · any change to the persisted submission shape or the submit path.
