# AgencyTrack — Agent-Facing Surface Audit
**Date:** 2026-05-25 | **Scope:** All agent-facing React components, test coverage, and interaction paths

---

## A. Tab Inventory

| Tab Name | data-testid (nav btn) | Component Rendered | Test File Exists? |
|---|---|---|---|
| Dashboard | (none) | Inline: goal carousel, KPIs, weekly standard, goals, activity feed, badges, gap analysis | Partial (6 tests in `AgentDashboard.test.jsx`) |
| Career | (none) | `CareerPortal` | YES (1 test — tap target) |
| Joint-Call Prep | `agent-tab-prospect-info` | `ProspectInfoPanel` | YES (13 tests) |
| Policy Ledger | `agent-tab-policy-ledger` | `PolicyLedgerPanel` | YES (5 tests) |
| Awards | (none) | `AgentAwardsPanel` | YES (1 test — smoke) |
| Persistency | `agent-tab-persistency` | `AgentPersistencyTab` | YES (7 tests) |
| Production Report | (none) | `ProductionReportTab` | Unknown |
| Leaderboard | (none) | `Leaderboard` | NO |
| History | (none) | Inline (submission list + viewer) | Partial (via dashboard tests) |
| Profile | (none) | `ProfileScreen` | YES (4 tests) |

**Nav testid coverage:** 3 of 10 tabs have `data-testid` on nav buttons (prospect-info, policy-ledger, persistency). Dashboard, career, awards, production-report, leaderboard, history: none.

---

## B. Test Coverage Summary

| Component | Test File | Count | Paths Covered |
|---|---|---|---|
| `PolicyLedgerPanel.jsx` | `__tests__/PolicyLedgerPanel.test.jsx` | 5 | Confirmation strip — all 5 arms |
| `ProspectInfoPanel.jsx` | `__tests__/ProspectInfoPanel.test.jsx` | 13 | Empty state, list, taxonomy labels, add flow |
| `AgentPersistencyTab.jsx` | `__tests__/PersistencyTab.test.jsx` | 7 | Award gate, edit lock, trend chart, history fallback |
| `WizardForm.jsx` | `__tests__/WizardFormSaveStatus.test.jsx` | ~40 | Save status, retry, offline detection, ARIA |
| `ProfileScreen.jsx` | `__tests__/ProfileScreen.signOut.test.jsx` | 4 | Sign out, touch target, Account section |
| `CareerPortal.jsx` | `__tests__/CareerPortal.tapTargets.test.jsx` | 1 | Touch target compliance |
| `EmailUpdateModal.jsx` | `__tests__/EmailUpdateModal.test.jsx` | 3 | Email form interaction |
| `WeeklyChampionsBanner.jsx` | `__tests__/WeeklyChampionsBanner.test.jsx` | 1 | Banner rendering |
| Step1–Step9 (9 files) | NONE | 0 | — |
| `BadgeGrid.jsx` | NONE | 0 | — |
| `Leaderboard.jsx` | NONE | 0 | — |
| `GapAnalysisPanel.jsx` | NONE | 0 | — |

---

## C. PolicyLedgerPanel — Interaction Path Coverage

### Confirmation Strip (5 arms) — all TESTED ✓

| Path | Condition | Tested |
|---|---|---|
| A — Confirmed + discrepancy | `confirmedAt` set, `hasDiscrepancy=true` | ✓ test #1 |
| B — Confirmed + clean | `confirmedAt` set, `hasDiscrepancy=false` | ✓ test #2 |
| C — Confirmed + no note | `confirmedAt` set, `managerNote=null` | ✓ test #3 |
| D — Settled, unconfirmed | `status='settled'`, `confirmedAt=null` | ✓ test #4 |
| E — Non-terminal | `status='submitted'`, no confirmation | ✓ test #5 |

### Other Interaction Paths — UNTESTED

| Interaction | Notes |
|---|---|
| Create policy form | 5 sections, conditional fields (same-as-owner, replacement, cash-with-app) — no UI test |
| Status transition modal | 5 target-status branches each with distinct fields (rated/postponed/ntu/denied/settled) — no UI test |
| Error state on load | Alert banner on `getOwnPolicies` failure — no test |
| Empty state on load | "No policies yet" — no test |
| Status badge colour map | `STATUS_BADGE_CLS` for all 6 statuses — no test |

---

## D. WizardForm — 5-Screen Layout

| Screen | Title | Steps | needsLastWeekData | UI Tests |
|---|---|---|---|---|
| 1 | Prospecting & Calls | Step1, Step2 | false | SaveStatusIndicator only |
| 2 | Interviews & Sales | Step3, Step4 | false | ProductionSummaryPanel partial |
| 3 | New Names & Service | Step5, Step6 | true | None |
| 4 | Time & Reflection | Step7, Step8 | false | None |
| 5 | Next Week Goals | Step9 | false | None |

No end-to-end flow test covers date → screen 1 → ... → screen 5 → review → submit.

---

## E. Dead Code, TODO, and Known Gaps in Agent-Facing Files

| File | Line | Note |
|---|---|---|
| `AgentDashboard.jsx` | ~273 | Push notifications deferred — nudge banner is v1 fallback |
| `AgentDashboard.jsx` | ~596 | ActivityFeed + BadgeGrid absorbed from deferred B3 deliverable |
| `policiesService.js` | ~235 | Comment: "history display UI is deferred (H1.2 FU)" |

No FIXME or TODO comments found in agent-facing components.

---

## F. policiesService.js — Exported Functions

| Function | Tests |
|---|---|
| `createPolicy` | YES — 9+ assertions, validation error cases (10 fields) |
| `getOwnPolicies` | YES — mocked in panel tests |
| `transitionPolicyStatus` | YES — 7+ tests (rated/postponed/ntu/denied/settled branches) |
| `confirmPolicy` | YES — 5+ tests (discrepancy detection, notification creation) |
| `getPolicyHistory` | YES — 2+ tests (basic query return) |
| `getPoliciesForManager` | YES — 3+ tests (unit/branch/admin scoping) |

Service layer is well-covered. UI layer (create form, transition modal) is not.

---

## G. Summary: Key Findings

### Strengths
- All 5 PolicyLedgerPanel confirmation-strip arms have unit tests (added PR #305)
- policiesService.js fully covered at service layer
- ProspectInfoPanel (13 tests) and PersistencyTab (7 tests) are well-covered
- WizardForm save-state logic (offline, retry, ARIA) thoroughly tested
- Track F Joint-Call + ProspectInfo service tests robust

### Critical Gaps
1. **All 9 wizard step components (Step1–Step9) have zero tests** — form field bindings, conditional rendering, totals (Step2 telephone calc, Step4 production summary) never asserted at the component level
2. **PolicyLedgerPanel create/transition flows untested in UI** — only service layer covered
3. **No end-to-end wizard flow test** — start → all 5 screens → review → submit never executed in tests
4. **Leaderboard.jsx, GapAnalysisPanel.jsx, BadgeGrid.jsx: zero tests**
5. **data-testid coverage sparse** — 3 of 10 nav tabs; dashboard tab body entirely unmarked

### Recommended Follow-up PRs (priority order)
1. **Test backfill — Step4ClosingSales / ProductionSummaryPanel** (Step4 has complex nested objects; production summary calculation is business-critical)
2. **Test backfill — PolicyLedgerPanel create flow** (create form validation + `createPolicy` mock call)
3. **Test backfill — PolicyLedgerPanel transition modal** (5 target-status branches + field validation)
4. **History display UI** (deferred in H1.2; `getPolicyHistory` exists; no agent-facing component yet)
5. **data-testid sweep** — add testids to remaining 7 nav tabs for e2e harness compatibility

---

*Generated by automated surface audit, 2026-05-25. Source files: `AgentDashboard.jsx` (806 lines), `PolicyLedgerPanel.jsx` (617 lines), `WizardForm.jsx` (882 lines), 9 Step components, `policiesService.js` (256 lines), associated test files.*
