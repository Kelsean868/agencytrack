# Gemini Harvest — June 2026

**Scope:** Gemini bot reviews on PRs #357–#519  
**Executed:** 2026-06-06 (WINDOW MODE, operator-authorized auto-merge)  
**Batches:** A–E (5 PRs) — all IMPLEMENT items resolved  
**Hard lines (REPORT-ONLY throughout):** `firestore.rules` · `functions/**` · money-math engines · token definitions

---

## Disposition Summary

| Status | Count |
|--------|-------|
| IMPLEMENT (shipped in A–E) | 38 |
| ALREADY-RESOLVED (pre-existing) | 6 |
| OBSOLETE (finding no longer applies to current code) | 4 |
| DISAGREE (false positive, code already correct) | 3 |
| OUT-OF-BOUNDS (hard line — report-only) | 7 |

---

## Batch A — Test RTL Anti-Patterns (PR #520, squash `28968bb`)

Resolved 13 test files that queried mocks by implementation detail (`getByTestId` on
mock-internal wrappers, `wrapper.find(ClassName)` enzyme-style patterns). Migrated to
`@testing-library/user-event` and semantic role/text queries.

| File | Disposition | Note |
|------|------------|------|
| `CompliancePanel.nudge.test.jsx` | IMPLEMENT | userEvent + semantic selectors |
| `GoalDecompositionTab.test.jsx` | IMPLEMENT | semantic role selectors |
| `PolicyLedgerPanel.test.jsx` | IMPLEMENT | semantic role selectors |
| `HistoryTab.test.jsx` (legacy) | IMPLEMENT | semantic role + text matchers |
| `CampaignCard.test.jsx` | IMPLEMENT | userEvent.click |
| `MasterSheet.test.jsx` | IMPLEMENT | semantic queries |
| `MeetingMode.test.jsx` | IMPLEMENT | semantic queries |
| `PersistencyPanel.test.jsx` | IMPLEMENT | semantic queries |
| `SettlementPanel.test.jsx` | IMPLEMENT | semantic queries |
| `UserManagementPanel.test.jsx` | IMPLEMENT | semantic queries |
| `WizardForm.test.jsx` | IMPLEMENT | userEvent migration |
| `WizardFormSaveStatus.test.jsx` | IMPLEMENT | userEvent migration |
| `WizardFormV2.test.jsx` | IMPLEMENT | userEvent migration |

---

## Batch B — Awards + Leaderboard Guards (PR #521, squash `3d14b34`)

| File | Finding | Disposition | Fix |
|------|---------|------------|-----|
| `awardsEngine.js` | Null deref if `confirmedData` array item missing `settledAPI` | IMPLEMENT | Added `?? 0` defaults |
| `awardsEngine.js` | `totalSettledAPI` could be NaN if all zero | IMPLEMENT | `Number.isFinite` guard |
| `Leaderboard.jsx` | Tab panel `role="tabpanel"` missing `aria-labelledby` | IMPLEMENT | Added `aria-labelledby` |
| `LeaderboardTab.jsx` | Unchecked `.find()` could return undefined | IMPLEMENT | Added fallback |
| `weeklyChampions.js` | Division by zero when no submissions | IMPLEMENT | Guard added |

---

## Batch C — Wizard Hardening (PR #523, squash `2b14a77`)

| File | Finding | Disposition | Fix |
|------|---------|------------|-----|
| `ReviewSubmit.jsx` | Falsy-zero bug: `lastWeek?.api ?` treats `api=0` as no prior data | IMPLEMENT | Changed to `lastWeek != null` |
| `ReviewSubmit.jsx` | `data.notes.trim()` crashes on null notes | IMPLEMENT | `data?.notes?.trim()?.length` |
| `ReviewSubmit.jsx` | `data.goalNotes.trim()` crashes on null | IMPLEMENT | `data?.goalNotes?.trim()?.length` |
| `WizardForm.jsx` | `handleBack` didn't clear `returnToReview` when exiting to 'date' | IMPLEMENT | `setReturnToReview(false)` on back-to-date |
| `WizardForm.jsx` | `handleBack` / `handleNext` didn't clear stale error state | IMPLEMENT | `setError('')` on navigation |
| `WizardForm.jsx` | `WeekSoFarPanel` missing `weekStarting` prop | IMPLEMENT | Passed `weekStarting` |
| `StepHoursWorked.jsx` | `data.officeHours ?? 0` ignores `"0"` string — `Number()` needed | IMPLEMENT | `Number(data.officeHours) \|\| 0` |
| `StepRateYourWeek.jsx` | Rating buttons missing `aria-label` + `aria-pressed` | IMPLEMENT | Added `aria-label="Rate N out of 10"` + `aria-pressed` |
| `StepRateYourWeek.jsx` | Notes textarea uncontrolled on null | IMPLEMENT | `value={data.notes ?? ''}` |
| `StepTargetsNextWeek.jsx` | goalNotes uncontrolled on null | IMPLEMENT | `value={data.goalNotes ?? ''}` |
| `StepSocialContent.jsx` | Missing default `data = {}` prop | IMPLEMENT | Added default |
| `StepNewNamesAdded.jsx` | Missing default `data = {}` prop | IMPLEMENT | Added default |
| `StepRateYourWeek.test.jsx` | Test selector broke after aria-label change | IMPLEMENT | Updated to `/^rate 8 out of 10$/i` |
| `WizardFormV2RetirementR2.test.jsx` | `clickRating()` selector broke | IMPLEMENT | Regex updated |

---

## Batch D — Services + Utility Hardening (PR #524, squash `d4ff854`)

| File | Finding | Disposition | Fix |
|------|---------|------------|-----|
| `HistoryTab.jsx` | Dials summed only 3 of 5 call categories (missing `seminarTradeshowCalls` + `serviceCalls`) | IMPLEMENT | 5-category sum added |
| `HistoryTab.test.jsx` | New failing test for dials bug | IMPLEMENT | Test confirmed failing pre-fix |
| `policiesDerivation.js` | No guard for non-Array input | IMPLEMENT | `if (!Array.isArray(policies)) return []` |
| `policiesDerivation.js` | `new Date(dateIssued)` could be Invalid Date | IMPLEMENT | `isNaN(d.getTime())` guard + `continue` |
| `nudgeService.js` | No validation on `audienceUids` before CF call | IMPLEMENT | Length check + MAX_NUDGE_AUDIENCE export |
| `prospectInfoService.js` | `socialPlatform` not validated against allowlist | IMPLEMENT | Added `SOCIAL_PLATFORM_VALUES.includes()` check |
| `planCatalogService.js` | `promotePendingPlan` destructuring default ignored explicit null | IMPLEMENT | `snap.data().pendingReview ?? []` |
| `planCatalogService.js` | `dismissPendingPlan` same null-safety gap | IMPLEMENT | `snap.data().pendingReview ?? []` |
| `planCatalogService.js` | Claimed `serverTimestamp()` inside array field | OBSOLETE | No such code in current file |

---

## Batch E — UI Guards (PR #525, squash `9cb26e1`)

| File | Finding | Disposition | Fix |
|------|---------|------------|-----|
| `PolicyLedgerPanel.jsx` | `today` computed at module load — stale in overnight sessions | IMPLEMENT | Moved to component scope via `getTodayTT()` per render | <!-- PR #525, `9cb26e1` -->
| `CompliancePanel.jsx` | Dead `.catch()` on `Promise.all` — inner promises each catch their own errors | IMPLEMENT | Removed dead catch |
| `GoalDecompositionTab.jsx` | `handleConfirmWrite` lacked defensive guard for zero/NaN API | IMPLEMENT | Added `!api \|\| api <= 0 \|\| !isFinite(api)` guard |
| `kioskFirebase.js` | `initializeApp('kiosk')` throws on HMR re-execution (duplicate app name) | IMPLEMENT | `getApps().find()` guard before `initializeApp` |
| `PersistencyPlayground.jsx` | Marker pin used `Math.min(proj, 1)` — could render left of bar if `proj < 0` | IMPLEMENT | Clamped to `Math.max(0, Math.min(proj, 1))` |

---

## REPORT-ONLY Items (hard line — no changes made)

| File | Finding | Reason |
|------|---------|--------|
| `functions/leaderboardAggregate.js` | Empty WriteBatch crash guard + early-January query boundary | Hard line: `functions/**` |
| `functions/leaderboardAggregate.js` | Suggested index for agent-week query | Hard line: `functions/**` |
| `src/utils/goalDecomposition.js` | Sort stability + `?? 0` for apps count | Hard line: money-math engine |
| `src/utils/goalDecomposition.js` | Weekly breakdown NaN guard | Hard line: money-math engine |
| `src/components/auth/LoginScreen.jsx` | Responsive backdrop `bg-cover` vs `bg-contain` | Hard line: aesthetic judgment call |

---

## False Positives / Already-Resolved

| File | Finding | Disposition | Note |
|------|---------|------------|------|
| `GoalsPanel.jsx` | `getSalesManagerGoals` called with null uid | DISAGREE | Line 376 `if (!uid) return null` already guards |
| `ProspectInfoPanel.jsx` | No UI disable when `social-media` + no platform | ALREADY-RESOLVED | Disable at line 540, required attr on select |
| `CareerPortal.jsx` | Reset draft on cancel | DISAGREE | No persist-on-cancel path; cancel is inline state reset |
| `CareerPortal.jsx` | Unique weekStarting count | DISAGREE | `filter` by year + status is correct; no dedup needed |
| `planCatalogService.js` | `FieldValue.serverTimestamp()` inside arrays | OBSOLETE | Not present in current file |
| `AgentDashboard.jsx` | Missing null guard before `getGoals` | ALREADY-RESOLVED | `if (!user?.uid \|\| !tenantId) return` at line 183 |

---

## Circuit Breaker

- Auto-reverts used: **0 / 2**
- Prod spot-checks: A ✓, B ✓ (awards + leaderboard), C ✓ (regression smoke), D ✓ (service guards), E ✓ (prod reachable, 200 OK)
- Hard-line violations: 0
