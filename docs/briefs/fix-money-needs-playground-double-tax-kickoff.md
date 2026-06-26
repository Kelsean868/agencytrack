# Bug Fix — Money Needs PAYE: double-tax on Send-to-Playground + display hierarchy — Kickoff Brief

**Type:** Bug fix (S) — money-calculation correctness + a display-hierarchy swap. No engine change, no rules, no Firestore schema, no functions.
**Merge channel:** HUMAN-MERGE (money-affecting agent surface).
**Run model:** **Sonnet.**
**First live dual-review PR** — poll BOTH Gemini and CodeRabbit per Rule 21.
**Trigger:** Audit of Money Needs PAYE handling found the engine (`payeEngine.js grossFromNet`) is CORRECT (43/43, `grossFromNet(840_000)===1_090_000`) and the service path is clean. Two downstream defects remain: (1) the Money Needs "Send to Playground" path feeds an already-gross figure into the Commission Playground, which treats its input as net take-home and grosses-up a second time; (2) MoneyNeedsPanel shows the after-tax need in the headline slot instead of the gross income target.

---

## Inputs (from the audit — source-verify before editing, Rule 17)
- Engine (CORRECT, do not modify): `src/utils/payeEngine.js` — `grossFromNet(net)`.
- Service (CORRECT, do not modify): `src/services/moneyNeedsService.js:52` — `computeWorksheetRollup` calls `grossFromNet(totalAnnualAfterTax)` → `totalAnnualPreTax` is the true gross income target.
- Send-path (BUG 1 source): `src/components/agent/MoneyNeedsPanel.jsx` — `CommissionTargetsPanel` (~:525) computes `required = totalAnnualPreTax − renewalTotal`; `handleSendToPlayground` (~:539) writes `required` to `localStorage[PLAYGROUND_INCOME_GOAL_KEY]`.
- Playground (CORRECT contract — do NOT change its tax math): `src/.../GoalDecompositionTab.jsx` + `src/utils/goalDecomposition.js:85` — `preTaxIncome = incomeGoal / (1 − taxRate/100)`. **Confirmed product contract: the playground's `incomeGoal` input is NET take-home; grossing it up is correct for manually-entered goals.**
- Display (BUG 2 source): `MoneyNeedsPanel.jsx` PAYESummary (~:422–428) — the after-tax need (`totalAnnualAfterTax`) is in the headline; the gross (`totalAnnualPreTax`) is in subordinate `text-sm`.

---

## The bugs (quantified — net need = 840,000, renewals = 0)

**Bug 1 — double-tax via the send-path.** Money Needs sends `totalAnnualPreTax` = **1,090,000** (already gross) into the playground's `incomeGoal`, which is contractually NET. The playground then grosses-up: `1,090,000 / (1 − 0.25) =` **1,453,333** — wrong (inflated 1.333×). The playground is behaving correctly *for a net input*; the send-path is violating the contract by sending gross.

**Bug 2 — display hierarchy.** Agent sees **840,000** (after-tax need) as the headline "annual income it takes to fund it"; the correct **1,090,000** gross target is demoted to small text.

---

## Decisions locked — do not re-litigate
1. **The fix for Bug 1 is on the SEND-PATH, not the playground.** The playground's `incomeGoal`-is-net contract and its `/(1 − taxRate)` gross-up are CORRECT and must remain unchanged (manual playground goals are net take-home). Money Needs must hand the playground a **net** value so the existing gross-up reproduces the correct gross.
   - **Send `totalAnnualAfterTax − (after-tax renewal offset)` — i.e. the NET need — NOT `totalAnnualPreTax`.** Phase 0 must determine the correct net figure to send so that, after the playground's gross-up at the agent's playground `taxRate`, it lands on the gross target. **Critical nuance:** the engine grosses-up via the **bracketed** `grossFromNet`; the playground grosses-up via a **flat** `taxRate`. These will NOT match unless reconciled — see decision #2.
2. **Bracket vs flat reconciliation — Phase 0 resolves, then STOP for ruling if non-trivial.** The engine's `grossFromNet` is bracketed (allowance 90k; 25%/30%); the playground is a single flat `taxRate`. Sending the raw net (840k) into a flat-25% playground yields `840,000/0.75 = 1,120,000`, not `1,090,000` — close but not equal, because the flat rate ignores the 90k allowance and the bracket structure. So a naive "send net" fix trades a 1.333× error for a smaller ~2.75% error. **Phase 0 must surface this and STOP for a dispatcher ruling on which of these we want:**
   - (a) Send net; accept the playground's flat-rate approximation (small residual error, playground stays self-contained).
   - (b) Send the already-correct **gross** (`totalAnnualPreTax`) AND mark it pre-tax so the playground SKIPS its gross-up for this value (a `preTaxAlreadyApplied` flag on the stored goal / a sentinel that sets the effective gross-up to identity). Exact, but adds a flag to the playground contract.
   - Do NOT pick unilaterally — this is a money-correctness/architecture call. Present both with the resulting numbers for net=840k.
3. **Bug 2 fix is a pure display swap:** `totalAnnualPreTax` (gross) becomes the headline figure under "the annual income it takes to fund it"; `totalAnnualAfterTax` (net) becomes the supporting subtext (clearly labelled "after-tax take-home" or similar). No number changes — only which occupies the headline. Keep both visible; relabel so each is unambiguous.
4. **Engine and service are untouched.** No edits to `payeEngine.js` or `moneyNeedsService.js`. If the fix appears to require an engine change, STOP — that means the diagnosis moved.
5. **Two commits, one PR:** commit A = Bug 1 (send-path), commit B = Bug 2 (display). Keep them separate so review can reason about money-correctness independently of cosmetics.

---

## Phase 0 — audit + the reconciliation STOP
1. Rule 9 gate; fresh branch `fix/money-needs-playground-double-tax`; `git branch --show-current` before any commit.
2. Source-verify the exact lines: the `required` computation + `handleSendToPlayground` write in MoneyNeedsPanel; the `PLAYGROUND_INCOME_GOAL_KEY` read + `DEFAULT_DECOMPOSITION_INPUTS.taxRate` default in GoalDecompositionTab/goalDecomposition; the PAYESummary headline/subtext block.
3. Confirm the playground's manual-entry path (the field where a user types a goal) so the fix does NOT alter manual-goal behavior — only the Money-Needs send-path value.
4. **Compute the resulting agent-visible number for net=840k under BOTH options in decision #2** (option a: flat-rate playground on net; option b: send gross + skip-gross-up). **STOP and present both with numbers for a dispatcher ruling.** Do not implement Bug 1 until ruled. (Bug 2 has no such ambiguity — may proceed if you want, but hold the PR until Bug 1 is ruled.)

## Phase 1 — implement (after ruling)
- Bug 1 (commit A): per the ruling — either send the net figure, or send gross + a skip-gross-up marker the playground honors. Keep the playground's manual-goal gross-up intact for manually-typed goals.
- Bug 2 (commit B): swap headline/subtext in PAYESummary; relabel both figures unambiguously (gross = "income you must earn"; net = "after-tax take-home").

## Phase 2 — verify (money-math class — vectors are the proof)
- `npm run lint`, `npm run build`, `npm test` green. `payeEngine` tests must stay 43/43 (untouched, but prove no regression).
- **Add/extend a unit test asserting the end-to-end value:** for net need = 840,000, renewals = 0, the value the agent ultimately sees as their playground income goal equals the gross target per the ruling (option a → 1,120,000 flat-approx; option b → 1,090,000 exact) — and explicitly is NOT 1,453,333 (the double-tax bug). Assert the goal saved from the playground is correct. This vector is the falsification anchor.
- A test (or assertion) that the MoneyNeedsPanel headline renders `totalAnnualPreTax`, not `totalAnnualAfterTax`.

## Phase 3 — smoke (real interaction; preview + prod post-merge; committed harness, no SKIP)
- As test agent: open Money Needs, drive a worksheet to net need ≈ 840,000 (or read the rendered values), assert the headline shows the GROSS figure (~1,090,000), the after-tax (840,000) is the subtext.
- Click "Send to Playground" → open Commission Playground → assert the income goal resolves to the correct gross per the ruling (NOT 1,453,333). Save a goal → assert the saved value is correct.
- Value-level assertions (not presence-only); recall History/format abbreviation (≥1000 → "K") when asserting.

## Phase 4 — docs + PR
- `docs/CONTEXT.md` active-track + `docs/FOLLOW_UPS.md` (note the bracket-vs-flat reconciliation decision taken). Rule 16 caps.
- Open PR (base main). Body: the quantified before/after (840k → 1,453,333 wrong → correct gross), the ruling taken, the end-to-end vector result, Rule 22 self-critique, Rule 23 falsification ("overturned if the saved playground goal for net=840k is not the gross target / is 1,453,333").
- **Rule 21 — poll BOTH reviewers:** Gemini (`.reviews[]`/`gemini-code-assist`) AND CodeRabbit (`.reviews[]` + `.comments[]`/`coderabbitai`). Disposition every finding from each. Rule 20 HEAD SHA. **Rule 19 — HOLD at PR-open.**

---

## Out of scope
- Any change to `payeEngine.js` or `moneyNeedsService.js` (both correct).
- The playground's manual-goal gross-up math (correct — net→gross for typed goals).
- Changing the playground's flat `taxRate` model to brackets (that's a larger reconciliation; if the ruling exposes appetite for it, bank as FU — do not build here).

## Standing rule reminders
- Fresh branch; `git branch --show-current` before every commit; Rule 17 source-verify.
- Rule 12 STOP phrasing for the Phase 0 reconciliation STOP; Rules 15/19/20/22/23; Rule 21 DUAL-REVIEWER (Gemini + CodeRabbit).
- Money-math class: the end-to-end value vector is the merge proof; no untracked smoke; no unconditional SKIP.

## Acceptance checklist
- [ ] Send-path no longer causes double-tax; saved playground goal for net=840k is the gross target per ruling (NOT 1,453,333).
- [ ] Playground manual-goal behavior unchanged (still net→gross for typed goals).
- [ ] MoneyNeedsPanel headline = gross income target; after-tax = clearly-labelled subtext.
- [ ] `payeEngine` 43/43 intact; new end-to-end vector green; lint/build/test green.
- [ ] Smoke proves headline value + corrected playground goal (preview + prod); harness committed.
- [ ] Both reviewers polled and dispositioned (Gemini + CodeRabbit).
