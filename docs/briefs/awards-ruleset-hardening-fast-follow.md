# Fast-Follow Brief — harden `getAwardsRuleset` (deep-merge at the read boundary)

**Authored:** 2026-06-20 · dispatcher
**Baseline:** origin/main **after #705–708 are merged** (specifically #707 / `b67032c`)
**Mode:** Build to PR-open, then HOLD.
**Merge class:** **Human-merge (Rule 19)** — touches a shared service consumed by live **agent and manager** surfaces. No green-channel.

---

## Why

Gemini's HIGH on #707 was real: a partial/malformed `awardsRuleset_{year}` Firestore doc (exists but missing keys) would destructure-crash the modal. CC fixed it **locally inside `YearPlanModal`** with a `deepMergeRuleset` helper. But the same `getAwardsRuleset` is consumed raw by **`AgentDashboard`** and **`ManagerAwardsPanel`**, which still carry the identical latent crash. A missing doc falls back cleanly to `DEFAULT_RULESET_2026`; only a *partial* doc is dangerous — edge, but it crashes live agent + manager surfaces.

Fix it once, at the read boundary: deep-merge inside `getAwardsRuleset` so every consumer receives a complete ruleset. Then remove the now-redundant local merge from `YearPlanModal`, and add the partial-ruleset tests #707 lacked. This closes the `getAwardsRuleset shared hardening` follow-up CC banked.

## Scope (one PR)

- Move the deep-merge from `YearPlanModal` into `awardsRulesetService.getAwardsRuleset`.
- Remove the local `deepMergeRuleset` + its call site in `YearPlanModal.jsx`.
- Add partial-ruleset unit tests on the service (the crash-prevention proof).

**Files:** `src/services/awardsRulesetService.js` · `src/components/.../YearPlanModal.jsx` · `awardsRulesetService.test.js` (new/extend) · `YearPlanModal.test.jsx` (confirm still green).

---

## Phase 0 — source-verify (post-#707 state)

1. **Assert #707 is merged.** Grep `deepMergeRuleset` in `YearPlanModal.jsx`. **Present → proceed.** **Absent → STOP and report** — #707 isn't on main yet; this brief is strictly post-#707.
2. Confirm `getAwardsRuleset(tenantId, year)` in `awardsRulesetService.js`: reads `config/awardsRuleset_${year}`, returns `DEFAULT_RULESET_2026` on missing doc. Capture the exact load + fallback lines.
3. Read CC's existing `deepMergeRuleset` (added in `b67032c`). Confirm its merge direction is **doc-wins / default-fills-gaps** (Firestore values take precedence; DEFAULT only backfills absent keys), and whether it recurses into nested award/tier objects. The service version ports this **exactly** — do not reinvent.
4. **Falsification check (Rule 23):** grep the consumers — `AgentDashboard.jsx`, `ManagerAwardsPanel.jsx`, `yearPlanProjection.js` — for any logic that **branches on a ruleset key being ABSENT** (`=== undefined`, presence guards, optional-key fallbacks). If any consumer relies on a key being missing, deep-merge would change its behavior → **FLAG and HOLD for a dispatcher ruling**, do not proceed silently. (Expected: none — they read keys assuming presence, which is exactly why a partial doc crashes them.)

## Phase 1 — build

1. Add `deepMergeRuleset(loaded, fallback)` to `awardsRulesetService.js`, ported from the YearPlanModal version (doc values win; DEFAULT fills missing keys; recurse into nested award/tier objects). **Export it** for direct unit testing (a `.js` service has no react-refresh export constraint — contrast Item 1).
2. In `getAwardsRuleset`, return `deepMergeRuleset(docData, DEFAULT_RULESET_2026)` for the present-doc case. The missing-doc path is `deepMergeRuleset({}, DEFAULT)` ≡ `DEFAULT`, so it can unify on the same call — confirm the empty/missing case still yields DEFAULT unchanged.
3. Remove the local `deepMergeRuleset` definition and its invocation in `YearPlanModal.jsx`; the modal now consumes the already-complete ruleset straight from the service.

**No-regression reasoning (state it in the report):** for a *complete* doc the merge is a no-op (identical output); for a *missing* doc the output is DEFAULT (unchanged). The only behavioral change is the *partial*-doc case: previously a raw partial (crash-prone), now a complete object (safe). So agent/manager surfaces are strictly hardened, not altered, for the normal and missing cases.

## Phase 2 — tests (load-bearing)

`awardsRulesetService.test.js` (mock `getDoc`):
1. **Missing doc → DEFAULT** (existing behavior preserved).
2. **Complete custom doc → custom values intact** — assert a non-default threshold from the doc **survives** (defaults must NOT clobber present values; proves merge direction).
3. **Partial doc** (exists, missing keys / an award missing `apiThreshold`) → returns a **complete** ruleset: gaps backfilled from DEFAULT, present values preserved. *This is the crash-prevention proof #707 lacked.*
4. **Nested-partial** (award object present but missing a sub-field) → sub-field backfilled (proves the recurse).

Confirm `YearPlanModal.test.jsx` stays green after the local-merge removal.

## Phase 3 — smoke

Both-theme render smoke confirming **no regression** across the three consumers with the real (complete) doc: Year Plan award strip, AgentDashboard awards, ManagerAwardsPanel all render normally. **Coverage boundary (Rule 22):** the partial-doc crash path is proven by unit tests, not the live smoke — malformed data can't be injected against the live account. Say so.

## Phase 4 / 5 / 6

- **Phase 4:** CONTEXT.md fill; in FOLLOW_UPS, mark `getAwardsRuleset shared hardening` **resolved** (this PR).
- **Phase 5:** commit `fix(awards): deep-merge ruleset at service read boundary; harden all consumers`; push; open PR.
- **Phase 6:** Gemini poll 15 min + disposition; **HOLD for human merge**. Report: Phase-0 falsification result (any consumer branching on absence?), the no-regression reasoning, test results (esp. the partial-doc case), smoke (both themes), ≥1 named gap.

---

## Report back

PR number + URL; Phase-0 verdict (#707 merged? consumers safe?); confirmation the missing/complete cases are unchanged and the partial case is now safe; test + smoke results; the one named gap; and confirmation it's **HELD for human merge**.
