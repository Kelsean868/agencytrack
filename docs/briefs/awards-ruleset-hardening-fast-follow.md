# Fast-Follow Brief — harden `getAwardsRuleset` (render-only merge accessor) · v2

**Authored:** 2026-06-20 · dispatcher · **v2 supersedes v1** (re-scoped after CC's Phase 0.4 falsification FLAG)
**Baseline:** origin/main **after #705–708 are merged** (specifically #707 / `b67032c`)
**Mode:** Build to PR-open, then HOLD.
**Merge class:** **Human-merge (Rule 19)** — shared service feeding live agent, manager, and admin surfaces. No green-channel.

---

## v2 amendment — why this supersedes v1

v1 assumed `getAwardsRuleset` fed only render surfaces and scoped the falsification grep to three consumers. CC's Phase 0.4 check found a **fourth consumer outside that list**: the admin ruleset editor `src/components/admin/AwardsRulesetPanel.jsx`. It loads the **raw stored doc** via `getAwardsRuleset` (`setRuleset` / `initFormState`), deliberately tolerates missing keys (`?.clubAward?.tiers ?? []` at :183, `?.recruitingAwards ?? []` :211, `?.activityAwards ?? []` :226, `?.managerMonthlyBonus?.tiers ?? []` :199), and **round-trips the doc back into a write** via `setAwardsRuleset`.

Merging inside `getAwardsRuleset` (v1's "fix once at the boundary") would make the editor see a DEFAULT-backfilled view, shift its dirty-baseline, and **on save silently persist DEFAULT values the admin never authored** — a write-path data-integrity hazard. That is exactly the absence-reliance Phase 0.4 says to FLAG.

**Dispatcher ruling — Option A:** put the deep-merge behind a **new render-only accessor**; `getAwardsRuleset` stays raw for the editor. Rationale: of the two-accessor options, A's "future caller forgets the accessor" failure is a **loud crash** (render side, caught by tests); B's is **silent write-path normalization** (worse than today). Loud-over-silent wins.

## Scope (one PR)

1. Add `deepMergeRuleset` (exported) + a new `getMergedAwardsRuleset(tenantId, year)` to `awardsRulesetService.js`. `getAwardsRuleset` is **unchanged** (raw).
2. Switch the **three render consumers** to `getMergedAwardsRuleset`; remove `YearPlanModal`'s local `deepMergeRuleset` (from #707).
3. Leave the **admin editor `AwardsRulesetPanel.jsx` untouched** — it keeps calling raw `getAwardsRuleset`.
4. Add tests, including a **contract-lock** pinning `getAwardsRuleset` to stay raw.

**Files:** `src/services/awardsRulesetService.js` · `YearPlanModal.jsx` · `AgentDashboard.jsx` · `ManagerAwardsPanel.jsx` · `awardsRulesetService.test.js` · (confirm `YearPlanModal.test.jsx` green).
**Explicitly NOT touched:** `AwardsRulesetPanel.jsx` (admin editor — raw fidelity preserved).

---

## Phase 0 — source-verify (post-#707 state)

1. **Assert #707 merged.** Grep `deepMergeRuleset` in `YearPlanModal.jsx`. Present → proceed. Absent → **STOP and report**.
2. Confirm `getAwardsRuleset(tenantId, year)`: reads `config/awardsRuleset_${year}`, returns `DEFAULT_RULESET_2026` on missing doc. Capture load + fallback lines.
3. Port-source: read CC's existing `deepMergeRuleset` (`b67032c`). Confirm merge direction is **doc-wins / default-fills-gaps** and that it recurses into nested award/tier objects. Port it **verbatim**.
4. **Render-only confirmation (the v2 crux).** Confirm the three render consumers are **read-only w.r.t. the ruleset** — they render/compute from it but never write it back. Only `AwardsRulesetPanel.jsx` writes (`setAwardsRuleset`). If any of the three round-trips the ruleset into a write, **STOP and re-flag** — Option A assumes they don't.
5. **awardsEngine mapping.** `awardsEngine.js` (~:152,:300) reads `…excludesBdoDso` with absent→falsy but **crashes when the parent object is absent**. Map its ruleset source: confirm it is fed from a render path that will now use `getMergedAwardsRuleset` (or pass it a merged ruleset explicitly). If any caller feeds awardsEngine a **raw** ruleset, note it — that path stays crash-exposed and needs the merged source too.
6. **Falsification (Rule 23):** the no-regression claim holds only if no render consumer depends on a key being absent. CC already confirmed `yearPlanProjection.js:48-55`, `AgentDashboard`, `ManagerAwardsPanel` assume presence (deep-merge only hardens them). Re-confirm on the merged branch.

## Phase 1 — build

1. Add exported `deepMergeRuleset(loaded, fallback)` to `awardsRulesetService.js` (ported from YearPlanModal; doc values win, DEFAULT backfills absent keys, recurses nested objects).
2. Add `getMergedAwardsRuleset(tenantId, year)` = `deepMergeRuleset(getAwardsRuleset(...), DEFAULT_RULESET_2026)`. The missing-doc case yields DEFAULT unchanged.
3. `getAwardsRuleset` — **no change** (raw doc / DEFAULT-on-missing).
4. Switch render loads to `getMergedAwardsRuleset` in `YearPlanModal`, `AgentDashboard`, `ManagerAwardsPanel`; remove YearPlanModal's local `deepMergeRuleset` + call.
5. `AwardsRulesetPanel.jsx` — **untouched**.

**No-regression reasoning (state in report):** for the three render surfaces, a complete doc → no-op, a missing doc → DEFAULT (both unchanged); only the partial-doc case changes (raw partial → complete, i.e. crash → safe). The editor keeps raw fidelity because its accessor is unchanged.

## Phase 2 — tests

`awardsRulesetService.test.js` (mock `getDoc`):
1. `deepMergeRuleset`: missing/empty → fallback.
2. `deepMergeRuleset`: complete custom doc → custom values intact (defaults do **not** clobber present values).
3. `deepMergeRuleset`: partial doc → gaps backfilled from DEFAULT, present values preserved (**crash-prevention proof**).
4. `deepMergeRuleset`: nested-partial → sub-field backfilled (proves recurse).
5. `getMergedAwardsRuleset`: partial stored doc → returns a complete ruleset.
6. **CONTRACT-LOCK — `getAwardsRuleset` stays RAW:** partial stored doc → returns the partial doc **unchanged** (NOT backfilled). Pins the admin-editor contract against future drift.

Confirm `YearPlanModal.test.jsx` green after the local-merge removal + accessor switch.

## Phase 3 — smoke

Both-theme render no-regression on the three render surfaces (Year Plan award strip, AgentDashboard awards, ManagerAwardsPanel) with the real complete doc. **Coverage boundary (Rule 22):** the partial-doc crash path and the editor's raw-fidelity contract are proven by unit tests (5,6), not the live smoke — malformed data can't be injected against the live account. Say so.

## Phase 4 / 5 / 6

- **Phase 4:** CONTEXT.md fill; mark the `getAwardsRuleset shared hardening` follow-up **resolved**; note the admin-editor exclusion as an intentional design decision (Option A ruling).
- **Phase 5:** commit `fix(awards): render-only merged ruleset accessor; harden render consumers, preserve editor raw fidelity`; PR.
- **Phase 6:** Gemini poll 15 min + disposition; **HOLD for human merge**. Report: Phase-0 render-only + awardsEngine findings, no-regression reasoning, the contract-lock test result, smoke (both themes), ≥1 named gap.

---

## Report back

PR + URL; Phase-0 verdicts (#707 merged? three consumers render-only? awardsEngine source mapped?); confirmation `getAwardsRuleset` is unchanged (contract-lock test green) and the three render surfaces are hardened; test + smoke results; the one named gap; confirmation it's **HELD for human merge**.
