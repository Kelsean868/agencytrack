# Night-Queue Brief — Game Plan loop: design-conformance polish (4 PRs)

**Authored:** 2026-06-20 · dispatcher
**Baseline:** origin/main `b116fe3` (audit baseline; all path:line anchors below are against it)
**Mode:** Autonomous night-queue. CC builds each item **to PR-open and HOLDs**. No merges, no deploys.
**Merge floor (non-negotiable):** All four items touch **agent-facing surfaces → human-merge (Rule 19)**. No green-channel auto-merge on any item, regardless of how small. CC never self-promotes.

---

## Why this brief

A design-sheet-vs-code conformance audit (CD build sheets vs live `GamePlanV2`) returned **31/35 assertions matching**; Surface 4 (Review & Commit — the money path) is fully conformant. This queue closes the divergences that have pilot value. Deferred by dispatcher ruling: **3.3** (Monthly per-line drill — no signal on a Life-only tenant) and **2.6** (`ahSide` license param — single correct value for the pilot). Dropped: **3.4** (likely an over-read; future months are correctly editable).

## Orchestration

- **Four items, file-disjoint → merge-independent.** Build order is irrelevant; recommended 4 → 1 → 2 → 3 (simplest first). Each opens its own PR off `origin/main`.
- **Disjoint-file proof.** Item 1 = `MoneyNeedsPanel.jsx`. Item 2 = `YearPlanModal.jsx` + `AwardProjectionStrip.jsx`. Item 3 = `MonthlyPlanModal.jsx` + `MonthChart.jsx`. Item 4 = `GamePlanV2/index.jsx` + delete `CommitPreviewCard.jsx`. **Only Item 4 touches `index.jsx`** — Phase 0 of Items 1–3 must each confirm no `index.jsx` edit is required (changes are component-internal).
- **Shared rails (every item):**
  1. Branch off `origin/main`. One item = one branch = one PR.
  2. Both-theme **preview** smoke (light + dark render + the item's state assertion). Production smoke is post-merge (human-gated) — not run in this window.
  3. **Gemini poll 15 min + disposition every comment** before reporting PR-ready (Rule 21). DISAGREE dispositions cite source.
  4. **Phase 4** (CONTEXT.md / FOLLOW_UPS placeholders) and **Phase 5** (commit/push/PR) are explicit per item.
  5. **HOLD at PR-open** — report and stop. No merge (Rule 19).
  6. Hex-grep on any new visual code; no inline styles; Tailwind + CSS vars only; ≥44px touch targets preserved (Nexus).
- **No deploy in this window.** All four are frontend-only **unless** Item 2's Phase 0 finds the award ruleset needs a `firestore.rules` read arm (it shouldn't — `awardsRuleset` is read elsewhere). If a rules change surfaces, **split that portion out, flag it, and HOLD it separately** for human merge + manual deploy.
- **Self-critique gate (Rule 22):** each PR-ready report names ≥1 known gap. **Falsification (Rule 23):** state what would overturn each Phase-0 gate verdict.

---

## Item 1 — Money Needs polish (`MoneyNeedsPanel.jsx`)

**Closes:** 1.8 (worksheet-level filled counter), 1.7 (per-line renewal sub-chips — **GATED**).

**Phase 0 — source-verify**
- Confirm the per-group filled-count source at `MoneyNeedsPanel.jsx:181` and the renewal-income render at `:275–276`.
- **GATE 1.7:** grep `moneyNeedsService.js` for a per-line renewal breakdown (Life / Health / Group sub-components feeding `estimatedRenewalIncome`). If only a `.total` exists → **do NOT invent**: drop 1.7, note in the report and FOLLOW_UPS as a data-add candidate. Build 1.8 regardless.
- Confirm no `index.jsx` edit needed.

**Phase 1 — build**
- **1.8:** add a worksheet-level `FILLED N/34` counter (sum of per-group filled / total). Place it in the worksheet header near the helper banner; derive from the same per-group counts already computed at `:181` — no new state, pure derivation.
- **1.7 (if gated-in):** render the renewal deduction line with per-line sub-chips (Life / Health / Group) from the verified service fields. Display-only; no math change. TTD + `parseFloat` preserved.

**Phase 2/3 — tests + smoke**
- Unit: `N/34` counter computes correctly for a representative filled/empty fixture (and the empty first-run = `0/34`).
- Preview smoke both themes: worksheet renders, counter shows, (if built) sub-chips show; axe 0 new serious/critical.

**Phase 4/5/6:** CONTEXT placeholder fill on src change; commit `feat(gameplan): money-needs filled counter + renewal sub-chips`; open PR; Gemini-disposition; **HOLD**.

---

## Item 2 — Year Plan polish (`YearPlanModal.jsx`, `AwardProjectionStrip.jsx`)

**Closes:** 2.4 (blended-rate honesty tooltip), 2.5 (award numeric gaps + "top tier reached" copy; ruleset from Firestore — **data half GATED**).

**Phase 0 — source-verify**
- Confirm the commission column render at `YearPlanModal.jsx:167–207` and the ruleset pass at `:572` (currently `DEFAULT_RULESET_2026`).
- Confirm `AwardProjectionStrip.jsx` renders not-yet/in-contention/on-track pills (`:42–67`, not-yet at `:8`).
- **GATE 2.5-data:** confirm a populated Firestore `awardsRuleset_{year}` (or the canonical config doc) exists and its read path. If present and already read elsewhere with no rules change → wire the strip to it. If absent, or it would require a `firestore.rules` change → **keep `DEFAULT_RULESET_2026` but parameterize the source behind one accessor**, flag the Firestore wiring as a follow-up, and **do not** introduce a rules change in this window.
- Confirm no `index.jsx` edit needed.

**Phase 1 — build**
- **2.4:** add an honest tooltip on the commission column stating it's **one blended rate, not per-line** (the model the sheet pins). No math change.
- **2.5-copy:** award pills show the **numeric gap-to-next** ("+ TTD 200K to Silver") and an explicit **"top tier reached"** cap state at the highest tier (no invented higher award). Below-lowest "not yet" copy already present — keep.
- **2.5-data (if gated-in):** strip reads `awardsRuleset_{year}` via the verified accessor instead of the hardcoded default.

**Phase 2/3 — tests + smoke**
- Unit: gap-to-next math for a mid-field total; "top tier reached" at/above the highest threshold; below-lowest "not yet" unchanged.
- Preview smoke both themes: tooltip present in DOM; pills show gaps; top-tier cap renders; axe 0 new.

**Phase 4/5/6:** CONTEXT fill; commit `feat(gameplan): year-plan blended-rate tooltip + award gaps/top-tier + ruleset source`; PR; Gemini-disposition; **HOLD**. If 2.5-data is split for a rules change, that sub-PR is flagged rules-touching and held separately.

---

## Item 3 — Monthly Plan honest-empty + NOW line (`MonthlyPlanModal.jsx`, `MonthChart.jsx`)

**Closes:** 3.8 (no-submissions empty state + no-Year-Plan copy), 3.2 (NOW line).

**Phase 0 — source-verify**
- Confirm the no-Year-Plan copy at `MonthlyPlanModal.jsx:237–252` ("Set up your Year Plan first") and that actuals currently render as silent zeros when no submissions exist.
- Confirm `MonthChart.jsx` has the pace tick but no NOW line (`~:71`).
- Confirm no `index.jsx` edit needed.

**Phase 1 — build**
- **3.8 functional:** when targets are set but there are no submissions, render a drawn **"Targets set — actuals will fill in"** state instead of a row of zeros (honest-empty doctrine; this is the load-bearing fix in the queue).
- **3.8 copy:** no-Year-Plan empty state reads **"Nothing to split yet → do Year Plan first"** (sheet wording).
- **3.2:** draw a **NOW line** at today (Trinidad time, UTC-4) in `MonthChart`, distinct from the current-month pace tick.

**Phase 2/3 — tests + smoke**
- Unit: no-submissions branch renders the honest-empty state (not zeros); NOW line positions at the correct month index for a fixed TT "today".
- Preview smoke both themes: no-submissions state renders; NOW line draws; chart otherwise unchanged; axe 0 new.

**Phase 4/5/6:** CONTEXT fill; commit `feat(gameplan): monthly honest-empty actuals + NOW line + copy`; PR; Gemini-disposition; **HOLD**.

---

## Item 4 — Remove vestigial CommitPreviewCard (`GamePlanV2/index.jsx`, delete `CommitPreviewCard.jsx`)

**Closes:** dead-UI — the hard-disabled card at `CommitPreviewCard.jsx:31–34` with stale copy ("Available once the Year & Monthly steps ship") still mounted at `index.jsx:335`, sitting beside the now-live Step 4.

**Phase 0 — source-verify**
- Confirm `CommitPreviewCard` has **no importers other than `index.jsx:335`** and no test referencing it (grep `CommitPreviewCard` across `src/` + `__tests__/`). If a test references it, update/remove it in this PR.
- Confirm removing the mount leaves the cascade grid layout intact (no dangling grid cell / gap).

**Phase 1 — build**
- Remove the mount + import at `index.jsx`; delete `src/components/dashboard/GamePlanV2/CommitPreviewCard.jsx`. Adjust the cascade grid so the remaining cards reflow cleanly.

**Phase 2/3 — tests + smoke**
- Update/remove any `CommitPreviewCard` test. Existing GamePlan hub tests stay green.
- Preview smoke both themes: hub renders without the dead card; Step 4 (live `ReviewCommitModal` path) unaffected; axe 0 new.

**Phase 4/5/6:** CONTEXT fill; commit `refactor(gameplan): remove vestigial CommitPreviewCard`; PR; Gemini-disposition; **HOLD**.

---

## Report back (all four)

For each: PR number + URL, files touched, Phase-0 gate verdicts (1.7, 2.5-data) with the evidence that drove each, smoke result (both themes), Gemini disposition summary, and ≥1 named gap (Rule 22). Then a one-line queue summary: which items built fully, which dropped/split a gated portion, and confirmation that **all four are HELD for human merge**.
