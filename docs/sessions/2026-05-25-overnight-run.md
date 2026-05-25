# Overnight Run — 2026-05-25

**Duration:** ~5h autonomous (operator asleep)
**Operator:** Kyron Marchan
**Focus:** Agent-facing PRs — merge queue 0-6

---

## Queue Summary

| Queue | Task | PR | Squash SHA | Status |
|-------|------|----|------------|--------|
| 0 | PR #305 pre-merge smoke → merge → prod smoke | #305 | 97a8493 | ✅ DONE (pre-compaction) |
| 1 | Agent-facing audit | — | — | ✅ DONE (pre-compaction) |
| 2 | H1.2 history timeline | #306 | b5c07d5 | ✅ DONE (pre-compaction) |
| 3 | Track E DailyFAB | #307 | f128deb | ✅ DONE |
| 4 | Audit-driven nav testId standardisation | #308 | 09b920f | ✅ DONE |
| 5 | Test backfill — agent untested paths | #309 | b4718fe | ✅ DONE |
| 6 | Track G money-needs evaluation | — | — | ⏳ REPORTED BELOW |

**Current main HEAD:** `1edccf3` (post-merge stamp for #309)

---

## Queue 3 — DailyFAB (PR #307)

**PR:** [feat(daily): Track E — DailyFAB floating action button for daily log entry](https://github.com/Kelsean868/agencytrack/pull/307)
**Squash SHA:** `f128deb`

- CI green before session started
- Smoke written: `scripts/verification/daily-fab-smoke.mjs` (6 steps)
- Initial login selector (`agent-tab-policy-ledger` within 25s) timed out; fixed with `waitForFunction` checking any agent tab or FAB element (40s timeout)
- 6/6 smoke passed on preview (`feat-track-e-daily-fab` preview URL)
- Merged squash; post-merge fill done

---

## Queue 4 — Nav testId standardisation (PR #308)

**PR:** [chore(agent-nav): add agent-tab-* data-testid to all 10 NAV_ITEMS](https://github.com/Kelsean868/agencytrack/pull/308)
**Squash SHA:** `09b920f`

- Audit (Queue 1) found 3/10 NAV_ITEMS had explicit `testId`; Sidebar already had `nav-{id}` fallback but names were inconsistent
- Changed all 10 items to `agent-tab-{id}` pattern for consistent smoke targeting
- CI flaky: `KioskModeTab.toast.test.jsx` "Generate fires a success toast on auto-copy success" failed on first run (pre-existing flakiness, unrelated to nav testId change); `gh run rerun --failed` resolved it
- Smoke waiver applied (internal attribute change, no user-visible behavior)
- Merged squash; post-merge fill done

**Banked:** `KioskModeTab.toast.test.jsx` is a known flaky test in CI — re-run with `gh run rerun --failed` resolves it.

---

## Queue 5 — Test backfill (PR #309)

**PR:** [test(agent): backfill tests — PolicyLedgerPanel, BadgeGrid, GapAnalysisPanel](https://github.com/Kelsean868/agencytrack/pull/309)
**Squash SHA:** `b4718fe`

### Scope
- `PolicyLedgerPanel.test.jsx`: extended from 5 tests → 15 tests (list states, create form, transition modal)
- `BadgeGrid.test.jsx`: new file (7 tests — computeEarnedBadges logic + rendering)
- `GapAnalysisPanel.test.jsx`: new file (6 tests — loading/error/null/layer labels/title/Met badge)
- `BadgeGrid.jsx` and `GapAnalysisPanel.jsx`: added explicit `import React` (Vitest JSX transform fix)

### Technical banked

**`vi.resetAllMocks()` vs `vi.clearAllMocks()`:** `clearAllMocks` only clears call history, not `mockResolvedValueOnce` queues. Cross-test contamination when an unconsumed `mockResolvedValueOnce` from one test leaks into the next. Always use `vi.resetAllMocks()` in `beforeEach` and add a `mockResolvedValue([])` default for the primary data-fetch mock.

**`fireEvent.submit(form)` pattern:** JSDOM doesn't reliably propagate `type="submit"` button clicks to React's `onSubmit` handler. `fireEvent.submit(container.querySelector('form'))` is reliable for triggering React form submit handlers in Vitest/JSDOM.

**Explicit React import for Vitest:** Vite supports automatic JSX transform but Vitest's classic transform requires explicit `import React from 'react'` in source files (not just test files). Any component file using JSX without explicit React import will fail when mounted in a Vitest test. Both `BadgeGrid.jsx` and `GapAnalysisPanel.jsx` needed this fix. Pattern already banked from PR #153 (`CommissionPlayground/index.jsx`).

**`getAllByText` when text appears multiple times:** `screen.getByText` throws when multiple elements match. Use `getAllByText(...).length > 0` or `getAllByText(...)[0]` when a label is intentionally repeated in the DOM (e.g., layer labels in `MetricSection` appear once per metric).

**CSS class selector for badge count:** `BADGES` has two entries with `label: 'Consistent'` (`streak_8` and `consistent`). Don't test badge count via label text — use `container.querySelectorAll('.badge-name').length` instead.

**Results:** 1267/1267 tests pass; lint clean; build clean.

---

## Queue 6 — Track G Evaluation

**Decision needed from dispatcher.**

### Spec assessment: COMPLETE

Read `docs/phase7-8-PRD.md` §6 in full. The Track G Money Needs Worksheet spec is comprehensive and implementable:

- **§6.1 Five Expense Groups** — Fixed, Living, Business, Savings & Accumulation, Miscellaneous. Sub-calculators specified for Insurance Industry Expenses, Car Expenses, Loans/Debt.
- **§6.2 PAYE Formula** — T&T brackets fully specified ($0-90k: 0%, $90k-$1M: 25%, above: 30%). Reverse-progressive engine for "gross needed" calc. Tenant config at `config/payeFormula`. Version history + hard banner when brackets change.
- **§6.3 Multi-Product** — Life/A&H/Property/Motor. Only Life flows to Commission Playground/Goals/Wizard.
- **§6.4 Privacy Model** — Consent modal on first create; persistent "Shared with" footer; manager audit trail; per-doc visibility toggle.
- **§6.5 Schema** — Path `/tenants/{tid}/users/{uid}/moneyNeeds/{year}`. Full document structure with expenseGroups, subCalculators, PAYE fields, estimatedRenewalIncome, firstYearCommissionsRequired/Targets.
- **§6.6 "Send to Playground"** — Copies `firstYearCommissionsTargets.life` to Commission Playground.
- **§6.7 Soft Validation** — Nudge (not block) when Personal Commitment < annual need.

### Priority concern

The Workshop Roadmap Revision (2026-05-20) ranks Track G at **priority #6 of 6**: "Strong agent tools; not a workshop ask." H2b (automated manager confirmation) and H2c/H3 (Track H remaining) remain open and ranked higher.

### Recommendation

**Do not draft walking skeleton without explicit dispatcher confirmation.** The spec is implementable, but Track G is the lowest-ranked remaining track. H2b and H3 may deliver more value for the Tatil demo. Suggest dispatcher weigh in on order before committing to a Track G PR.

---

## Open Questions for Dispatcher

1. **Track G priority:** Spec is complete. Should walking skeleton be drafted now, or hold until H2b/H2c/H3 are closed? Workshop Roadmap Revision says lowest priority — confirm before dispatching.

2. **Track E refined daily form (if expanding Queue 3 scope):** PRD §4.5 specifies fields that diverge from the existing `DailyLogEntry` form. Field-mapping decisions needed if Track E scope expands to the PRD-specified form shape.

3. **KioskModeTab flakiness:** `KioskModeTab.toast.test.jsx` ("Generate fires a success toast on auto-copy success") fails intermittently in CI. Worth a dedicated look to fix the flaky test rather than relying on re-run each time.

---

## All Merge SHAs (this session)

| PR | Title | Squash SHA |
|----|-------|------------|
| #305 | H1 policy ledger smoke + manager confirmation | 97a8493 |
| #306 | H1.2 history timeline + getPolicyHistory fix | b5c07d5 |
| #307 | Track E DailyFAB | f128deb |
| #308 | Agent nav testId standardisation | 09b920f |
| #309 | Test backfill (PolicyLedgerPanel, BadgeGrid, GapAnalysisPanel) | b4718fe |

Main HEAD after all fills: `1edccf3`

---

## Smoke / Verification Summary

| PR | Smoke | Result |
|----|-------|--------|
| #305 | Pre-merge preview + prod post-merge | ✅ Pass |
| #306 | Pre-merge preview (`h1-2-transition-smoke.mjs`) | ✅ Pass |
| #307 | Pre-merge preview (`daily-fab-smoke.mjs`) | ✅ 6/6 pass |
| #308 | Waived (internal attribute, no user-visible behavior); CSS bundle static check | ✅ |
| #309 | Waived (test + source-import fix, no UI behavior change) | ✅ |

---

*Generated by CC autonomous run. No operator review during execution.*
