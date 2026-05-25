# Regression Smoke Sweep — 2026-05-25T09-31-16

**Overall:** ✅ 48 PASS / 0 FAIL / 0 SKIP
**Duration:** 104s
**Target:** https://agencytrack.vercel.app
**Runner:** CC autonomous block

## Results

| Step | Status | Note |
|------|--------|------|
| leg0-env-vars | PASS | All required env vars present |
| leg0-prod-reachable | PASS | https://agencytrack.vercel.app responded 200 |
| bypass-session | PASS | Vercel bypass cookie established |
| leg0-agent-login | PASS | Agent logged in to production |
| leg1-tab-dashboard | PASS | agent-tab-dashboard navigated, content rendered |
| leg1-tab-career | PASS | agent-tab-career navigated, content rendered |
| leg1-tab-prospect-info | PASS | agent-tab-prospect-info navigated, content rendered |
| leg1-tab-policy-ledger | PASS | agent-tab-policy-ledger navigated, content rendered |
| leg1-tab-awards | PASS | agent-tab-awards navigated, content rendered |
| leg1-tab-persistency | PASS | agent-tab-persistency navigated, content rendered |
| leg1-tab-production-report | PASS | agent-tab-production-report navigated, content rendered |
| leg1-tab-leaderboard | PASS | agent-tab-leaderboard navigated, content rendered |
| leg1-tab-history | PASS | agent-tab-history navigated, content rendered |
| leg1-tab-profile | PASS | agent-tab-profile navigated, content rendered |
| leg2-form-open | PASS | New Policy form opened |
| leg2-form-filled | PASS | ownerName="SMOKE-SWEEP-A-1779701476848", premium=5000 (Annual) |
| leg2-create-success | PASS | SMOKE-SWEEP-A-1779701476848 visible in Policy Ledger list |
| leg2-firestore-read | PASS | Policy doc found: GTqi140EKEOL6wKNtAIS |
| leg3-modal-open | PASS | Transition modal opened for SMOKE-SWEEP-A |
| leg3-modal-filled | PASS | Settled fields filled |
| leg3-submitted | PASS | Confirm clicked, modal closed |
| leg3-reload-settled | PASS | "Settled" badge visible after hard reload |
| leg4-history-renders | PASS | History list visible with 1 child elements for GTqi140EKEOL6wKNtAIS |
| leg5-seed | PASS | Seeded Policy A (disc): UgCuJAozmgnIgRjmZfCe, Policy B (clean): LSnDGJ4Odn5Dfr4QIBzW, Notif: GKMYfRVsPU36dl6xsLF6 |
| leg5-confirmed-chip | PASS | "Confirmed by" chip visible on discrepant policy |
| leg5-discrepancy-chip | PASS | "Discrepancy" chip visible on discrepant policy |
| leg5-value-line | PASS | Value comparison line visible on discrepant policy |
| leg5-manager-note | PASS | Manager note text visible on discrepant policy |
| leg5-clean-confirmed-chip | PASS | "Confirmed by" count on page: 2 (≥2 means both A+B confirmed) |
| leg5-clean-no-discrepancy | PASS | No "Discrepancy" in clean policy card HTML (correct) |
| leg6-notif-text | PASS | policy_discrepancy notification visible in bell drawer |
| leg6-warning-palette | PASS | bg-warning class found in bell drawer: "bg-warning/10 text-warning" |
| leg7-fab-visible | PASS | DailyFAB button visible on dashboard |
| leg7-modal-title | PASS | Modal title: "Log today — Monday, 25 May 2026" |
| leg7-modal-open | PASS | Daily entry modal opened successfully |
| leg8-agent-create | PASS | SMOKE-SWEEP-B-1779701476848 created |
| leg8-agent-settle | PASS | SMOKE-SWEEP-B-1779701476848 transitioned to Settled (settledAPI=8000) |
| leg8-policy-b-id | PASS | Policy B doc: eXgn67RL41qFbb7GTAkd |
| leg8-bm-login | PASS | Branch Manager logged in |
| leg8-bm-reconcil-loaded | PASS | Policy Reconciliation panel loaded |
| leg8-bm-sees-policy | PASS | SMOKE-SWEEP-B-1779701476848 visible in reconciliation panel |
| leg8-bm-confirm-submitted | PASS | BM confirmation form submitted (managerSettledAPI=9000, discrepant) |
| leg8-discrepancy-notification | PASS | policy_discrepancy notification found (recent) — eOZcIvzkIjaD2TQbA7D5 |
| leg9-wizard-open | PASS | WizardForm opened — date screen visible |
| leg10-daily-saved | PASS | Daily entry saved (modal closed or saved indicator visible) |
| console-errors | PASS | No unexpected JS console errors across agent session |
| cleanup | PASS | 5 smoke fixture(s) deleted |
| cleanup-enumeration | PASS | Re-enumeration: 0 SMOKE-SWEEP-* policies remain |

## Smoke Tags Seeded

- Policy create+transition+history: `SMOKE-SWEEP-A-1779701476848`
- Two-actor confirm: `SMOKE-SWEEP-B-1779701476848`
- Confirmation surfacing: `SMOKE-SWEEP-C-1779701476848-DISC`, `SMOKE-SWEEP-C-1779701476848-CLEAN`

## Screenshots

Saved to: `C:\Projects\AgencyTrack\scripts\verification\2026-05-25T09-31-16-regression-sweep-screenshots`

## Surfaces Covered

- LEG 0: Env / prod reachable
- LEG 1: All 10 agent nav tabs via `agent-tab-*` testIds (PR #308)
- LEG 2: Policy create write-read-verify (PR #305/#306)
- LEG 3: Policy transition to Settled + reload verify (PR #305)
- LEG 4: History timeline UI toggle or REST verify (PR #306)
- LEG 5: Confirmation surfacing — emerald/amber chips, value line, note (PR #305)
- LEG 6: Bell notification — policy_discrepancy warning palette (PR #305)
- LEG 7: DailyFAB opens DailyEntryModal (PR #307)
- LEG 8: Two-actor manager confirm + notification (PR #305)
- LEG 9: Weekly wizard opens
- LEG 10: Daily entry save
- CLEANUP: All SMOKE-SWEEP-* policies deleted; re-enumerated empty
