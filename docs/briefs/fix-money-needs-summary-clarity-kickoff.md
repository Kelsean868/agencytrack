# Money Needs — summary clarity (income-section reorder + label flow) — Kickoff Brief

**Type:** Polish (XS) — presentation only. NO math, NO `payeEngine.js`, NO `moneyNeedsService.js`, NO Firestore writes, NO rules. Reorder + relabel + one conditional note + panel order.
**Merge channel:** HUMAN-MERGE (money-adjacent agent surface — display only, but on the figures agents anchor on).
**Run model:** **Sonnet.**
**Dual-review:** Rule 21 — poll BOTH Gemini and GLM (GLM will likely post `## 🤖 unavailable` until Z.ai is funded; record it, don't treat as no-comment).
**Trigger:** Live worksheet review (Kyron's own) confirmed the Money Needs math is CORRECT (audit post-#734: `grossFromNet(341,951)=425,934.67`, gross-up `83,983.67` bracket-consistent, the three equal figures are correct-by-design when renewals=0). The defect is purely UX: the same number appears three times under three labels and the panels are ordered so the commission target shows BEFORE the income derivation that produces it — making correct math look like double-counting. This PR reorders for logical flow. No value changes.

---

## Inputs (source-verify before editing — Rule 17)
- `src/components/agent/MoneyNeedsPanel.jsx`:
  - `PAYESummary` (the "The income your lifestyle requires" block, ~:415–447): currently `payeGrossUp = Math.max(0, totalAnnualPreTax − totalAnnualAfterTax)`; `firstYearCommissionsRequired = Math.max(0, totalAnnualPreTax − renewals)`. Gross (`totalAnnualPreTax`) is the `text-lg font-bold` headline (from PR #734); after-tax is subtext; gross-up currently rendered as a `−` subtraction.
  - `CommissionTargetsPanel` (the "COMMISSION TARGETS" / "Targets by Product Line" / "Send to Playground" block, ~:525–549): currently rendered ABOVE `PAYESummary` in the panel order.
- The renewals value source (`estimatedRenewalIncome.total` / `renewalTotal`) — confirm the exact field so the conditional note (decision #4) keys off the right zero-check.

---

## Decisions locked — do not re-litigate
1. **Panel order swap.** Render the income-derivation section (`PAYESummary`) FIRST, then `CommissionTargetsPanel` BELOW it. The derivation explains the number; the targets/product-line breakdown + Send-to-Playground come after, reading as "here's how to hit it." (Today they're reversed.)
2. **Income-section line order — build-up, top to bottom:**
   ```
   After-tax take-home        TTD 341,951
   + PAYE                     TTD  83,983.67
   ──────────────────────────────────────────
   = Income you must earn     TTD 425,934.67     ← visually dominant (keep PR #734 headline weight)
   1st-year commissions req.  TTD 425,934.67     (+ renewals note — decision #4)
   ```
3. **Gross-up is ADDITIVE, shown as `+ PAYE`** (not the current `− PAYE` subtraction). Reading top-down: take-home **+** tax **=** gross. The `= Income you must earn` line carries a divider/`=` affordance signalling it's the sum of the two lines above (reuse the existing `border-t` row token — no new hex). The VALUE is unchanged (`Math.max(0, totalAnnualPreTax − totalAnnualAfterTax)` = same `83,983.67`); only the sign/label/position flips to read as an addition.
4. **`Income you must earn` stays the visually-dominant line** (the `text-lg font-bold` headline weight from PR #734 — do NOT regress the headline back to after-tax). It now sits as the `=` summation line, third in the build-up, but remains the biggest number.
5. **Renewals note on the commissions line (option a — always-show + explain):**
   - When **renewals = 0**: show `1st-year commissions required  TTD 425,934.67` with an inline explanatory note, e.g. *"all of it — no renewal income yet"*. (Kills the "why is this number here twice" reaction.)
   - When **renewals > 0**: show the commissions line with the renewal offset made clear (e.g. the gross minus a labelled renewal-income line), so it visibly DIFFERS from "Income you must earn." This closes the banked Gemini #734 G1 renewals-clarity FU — handle the renewals display in the same pass.
6. **No value changes anywhere.** Every number rendered must equal what renders today (the audit fixed the math; this is presentation). If any displayed figure would change, STOP — the diagnosis moved.
7. **Grand-total line (Option A) — a budget-sum row closing the category block.** Add a `Total annual budget   TTD 341,951` line directly BELOW the five category rows (Fixed/Living/Business/Savings/Misc) and ABOVE the `PAYESummary` income section, giving the budget block a visible sum.
   - **Single source of truth (hard requirement):** this line MUST render the live `worksheet.totalAnnualAfterTax` — the EXACT value the build-up's "After-tax take-home" line consumes — NOT a separately re-summed figure. The grand total and the build-up base are the same number by definition; they must read from the same field so they can never diverge (a re-sum could mismatch on rounding/filtering). If `totalAnnualAfterTax` is not directly available at that render site, thread it — do NOT recompute.
   - **Labels carry the continuity** (so the intentional repeat of 341,951 reads as logic, not a glitch): the budget line is the *sum of your spending plan*; the build-up's "After-tax take-home" is *that same total, now the base we gross up from*. Keep both labels distinct and self-explaining; if helpful, the build-up's first line may read "After-tax take-home (= your annual budget)" to make the link explicit.
   - Optionally surface the fill progress (the existing "26/34 filled" datum) on the total line if it's cleanly available — nice-to-have, not required; do not invent it if not at hand.

---

## Phase 0 — audit (no edits)
1. Rule 9 gate; fresh branch `fix/money-needs-summary-clarity`; `git branch --show-current` before any commit.
2. Source-verify the exact `PAYESummary` JSX lines (the four figures + the gross-up sign + the headline weight) and the `CommissionTargetsPanel` render-order site. Confirm the renewals field name for the decision #4 zero-check.
3. Confirm reordering the two panels doesn't break any prop/state dependency (e.g. `CommissionTargetsPanel` reading a value computed in `PAYESummary`, or shared local state). If there's a dependency that reordering breaks, STOP and surface.

## Phase 1 — implement
- Swap the render order: `PAYESummary` above `CommissionTargetsPanel` (decision #1).
- Reorder the four lines in `PAYESummary` per decision #2; flip gross-up to `+ PAYE` with the `=` summation affordance on the gross line (decision #3); preserve gross's headline weight (decision #4).
- Add the renewals conditional note (decision #5), handling both renewals=0 and renewals>0.

## Phase 2 — verify
- `npm run lint`, `npm run build`, `npm test` green.
- **RTL is the proof surface** (preview has no seeded worksheet, per #734): extend `MoneyNeedsPanel.test.jsx` to assert, for a worksheet with after-tax=341,951 / gross=425,934.67 / renewals=0:
  - the `Total annual budget` line renders 341,951 and reads from the SAME `totalAnnualAfterTax` source as the build-up's take-home line (assert both show the identical value; ideally assert they derive from one prop, not two);
  - line order in `PAYESummary` is take-home → PAYE → gross → commissions;
  - gross-up renders as additive (`+`) and the gross line is the summation;
  - gross (`Income you must earn`) is the headline-weight element (not after-tax);
  - the renewals=0 explanatory note is present on the commissions line;
  - **AND a renewals>0 case** asserting the commissions line differs from gross and the renewal offset is shown;
  - the rendered VALUES are unchanged vs the pre-PR assertions (no number moved).
  - `CommissionTargetsPanel` renders AFTER `PAYESummary` in the DOM order.
- `payeEngine` stays 43/43 (untouched — prove no regression).

## Phase 3 — smoke (committed harness; no unconditional SKIP)
- Reuse/extend `smoke-money-needs-double-tax-fix.mjs` pattern. The display legs will SKIP in preview (no seeded worksheet) exactly as #734 — that's acceptable, RTL covers them; the skip must be conditional/explained, not unconditional. Assert the page renders without crash and (if the A11Y agent ever has a seeded worksheet) the new order. Keep the L1b playground value leg green (unchanged — proves the #734 fix didn't regress).

## Phase 4 — docs + PR
- `docs/CONTEXT.md` active-track + `docs/FOLLOW_UPS.md`: mark the Gemini #734 G1 renewals-clarity FU RESOLVED (folded in here). Rule 16 caps.
- Open PR (base main). Body: before/after of the income-section order, screenshot-described rationale (correct math made to read correctly), confirmation NO value changed, Rule 22 self-critique, Rule 23 falsification ("overturned if any displayed figure differs from pre-PR, or if after-tax is the headline").
- Rule 21 — BOTH reviewers (Gemini + GLM `## 🤖`). Rule 20 HEAD SHA. **Rule 19 — HOLD at PR-open.**

---

## Out of scope
- `payeEngine.js`, `moneyNeedsService.js`, any Firestore write, any rules (all untouched — math is correct).
- Changing the commission-required FORMULA (`gross − renewals`) — it's correct; only its presentation changes.
- The `goalDecomposition` hardcoded-key dedup + taxConnector-label FUs (#734) — separate, banked, not this PR.

## Standing rule reminders
- Fresh branch; `git branch --show-current` before every commit; Rule 17 source-verify.
- Rule 12 STOP phrasing; Rules 15/19/20/22/23; Rule 21 dual-reviewer.
- No untracked smoke; no unconditional SKIP for a load-bearing assertion.

## Acceptance checklist
- [ ] `Total annual budget` line renders below the categories, reading the live `totalAnnualAfterTax` (same source as take-home — never a re-sum); value = 341,951.
- [ ] `PAYESummary` renders ABOVE `CommissionTargetsPanel`.
- [ ] Income section order: After-tax take-home → `+ PAYE` → `= Income you must earn` (headline weight) → 1st-year commissions required.
- [ ] Gross-up shown additively; gross line is the visual summation; gross is the dominant figure (not after-tax).
- [ ] Renewals=0 → explanatory note on commissions line; renewals>0 → offset shown, line differs from gross (closes G1).
- [ ] NO displayed value changed vs pre-PR; `payeEngine` 43/43; lint+build+test green.
- [ ] RTL asserts order/labels/headline/note + a renewals>0 case; smoke renders clean + L1b value unregressed.
- [ ] Both reviewers polled and dispositioned.
