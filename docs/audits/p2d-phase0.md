# P2d Phase 0 — numbers you can trust (audit 2026-09-24 BUG-01 · BUG-02 · BUG-04 · BUG-05 + P2c leftovers)

Brief: `docs/briefs/p2d-p2e-numbers-kiosk-appcheck.md` § PR 1. Written 27 Sep 2026 against
`main` @ `490bffd`, before any code. Line numbers are from that commit.

## STOP checks

| STOP condition | Finding | Verdict |
|---|---|---|
| The OIPA import does not mark imported policies so "head office" can be told from "self-confirmed" | It does. `parseOipaExport.js:392` stamps `statusSource: 'oipa_import'` (`STATUS_SOURCE_IMPORT`, `oipaImportConfig.js:277`). Every human status write stamps `'agent'` / `'manager'` (`policiesService.js:209`), and `firestore.rules:400-403` (`setsOwnStatusProvenance`) stops a client forging `oipa_import`. A later human status change overwrites the stamp, so the field says who set the *current* status. `buildImportPlan.js:253` never overwrites a human-set status. | **No STOP** |
| The hero and awards rules differ on purpose (documented) | One documented difference: self/family policies (`isSelfOrFamily`) count toward the hero but not toward awards (Kyron, 23 Sep 2026 — `ledgerProduction.js:161-166`; MDRT adds them back). The brief names this ("self + family treatment included"), so it is the known split, not a hidden rule. Everything else is the same test: Life, settled-or-confirmed, `dateIssued` year/month, `productionCredit`. | **No STOP** — the parity test asserts `hero = awards + self/family` |

## Change table

| Part | Files / rule blocks | Today | Change |
|---|---|---|---|
| 1.1 Provenance line | `src/lib/settledProvenance.js` (new shared `settledProvenance` + `provenanceLine`, re-exported by `ledgerProduction.js`), `HomeV2/homeDerivations.js` (re-export), `AwardLensView.jsx` + `deriveAwardLens` (award card), `CampaignHeroCard.jsx` + `derivePolicyLens` (Campaign), `AgentAwardsPanel.jsx` (Awards tab) | Only the Home hero shows (`PipelineStrip.jsx` also derives the YTD figure but is not rendered by any screen since LX, so it is left alone; `[n] from head office · [n] self-confirmed` `HeroCard.jsx:80`), counted inline in `deriveYearProduction` | One helper counts provenance over the policies that make up each figure; every surface prints the same line from it. Awards tab gains a "Settled {year}" line read from `deriveYearProduction` so it shows the same YTD figure as the hero. |
| 1.2 Agent self-confirm | `firestore.rules` `policies` — new **Arm F**; `policies/{id}/history` agent create arm; `policiesService.js` new `selfConfirmPolicy`; `PolicyDrillDrawer.jsx` + `PolicyLedgerPanel.jsx` | An agent can set details only on the `→ settled` transition (Arm B). Once settled — including every head-office-settled import, which carries `settledAPI: null` — nothing can be confirmed or corrected by the agent. | Arm F: owner only, `status == 'settled'` before and after, not yet manager-confirmed (`confirmedByUid` absent), touches only `settledAPI · issuedCoverage · initialPremium · earnedCommission` + stamps `selfConfirmedBy == auth.uid`, `selfConfirmedAt == request.time`, `enteredBy == auth.uid`, `enteredAt == request.time`; same value guards as Arm B's settle edge. No status, `dateIssued` or `statusSource` change, so the provenance bucket cannot be moved. History: the agent arm also accepts the `settled → settled` self-confirm event on the agent's own settled policy. Arm C (manager confirm) unchanged. |
| 1.3 Persistency `enteredBy` | `firestore.rules` `persistency` create/update agent arm; `persistencyService.js` `savePersistency` | Service stamps `enteredBy/enteredAt` on first write and preserves the first writer's on overwrite; rules check `lastEditedBy` only | Agent arm additionally requires `enteredBy == request.auth.uid` and `enteredAt is timestamp`. Service: when the writer is an agent and the stored `enteredBy` is someone else, the agent's write re-stamps `enteredBy/enteredAt/enteredByRole` (the agent entered the figures now held). Manager / admin arms unchanged. |
| 2 `todayTT` | `src/utils/dateInputs.js` (promote `getTodayTT`; add `ymdTT`, `ymdUTC`, `isAfterTodayTT`), 15 NOW-UTC sites below, 14 anchored sites, `eslint.config.js` | Helper exists (`getTodayTT`, Intl `America/Port_of_Spain`) but 15 client sites build "today" from UTC | **Promote** `getTodayTT()` (brief's `todayTT()`; no second helper). NOW-UTC sites → TT. Anchored / timestamp sites → `ymdUTC(d)` (identical output — moved only so the lint rule can ban the raw pattern). ESLint `no-restricted-syntax` bans `.slice/.split/.substring` on `toISOString()` in `src/` outside `src/utils/dateInputs.js` (tests exempt). |
| 3 One YTD loop | `src/lib/ledgerProduction.js` | `deriveYearProduction` and `awardRowsFromLedger` each loop the policy list with their own settled test | New `settledCreditList(policies)` — one entry per Life, settled, dated policy with its `productionCredit`. Both functions read it. Award rows also carry `selfFamilyApps` so the parity test can check apps as well as API. `policyCampaignLens.js` keeps its own campaign credit table (Rule 7) — unchanged. |
| 4.1 History writes | `firestore.rules` `policies/{id}/history` manager create arm | BM / TA / PA and flagged SM: any policy in the tenant; UM: own unit | Manager arm uses the same `parentPolicyInScope()` as reads: BM own branch, UM own unit, SM/TA/PA tenant. Agent arm (own policy) unchanged in scope. Narrows only. |
| 4.2 Recon Confirm button | `PolicyReconciliationPanel.jsx` | SM without `canConfirmSettlements` sees the **Confirm** tab button beside "View only" | Tab row hidden when the viewer can neither confirm nor lapse. |

## UTC "today" sites found (non-test `src/`)

**NOW-UTC — computed from the current instant in UTC; wrong 20:00–24:00 TT → changed to TT:**

| # | Site | Use |
|---|---|---|
| 1 | `src/utils/campaignEngine.js:592-595` `getDaysRemaining` | campaign days-left / "Ended" (the audit's 31 Dec scenario) |
| 2 | `src/services/campaignService.js:25` | active campaigns query window |
| 3 | `src/lib/kiosk/kioskServices.js:72` | kiosk campaigns query |
| 4 | `src/components/campaigns/CampaignPanel.jsx:27` | campaign active/upcoming/ended |
| 5 | `src/components/manager/UserManagementPanel.jsx:141` | contract-start "not in future" check |
| 6 | `src/components/manager/UserManagementPanel.jsx:299` | date input `max` |
| 7 | `src/components/manager/EditUserDrawer.jsx:99` (`TODAY`, used at 291, 671, 701) | contract-start check + `max` |
| 8 | `src/components/submissions/HistoryTab.jsx:73-77` `currentWeekStarting` | current week (UTC parts of now) |
| 9 | `src/utils/tenureFloors.js:41-43` `monthsOfService` | tenure band → company floor (UTC parts of now) |
| 10 | `src/lib/strategicPlan/unitGrouping.js:44-46` `experienceYears` | experience years (UTC parts of now) |
| 11 | `src/lib/strategicPlan/assembleModel.js:178` `windowState` | period window done/progress/future |
| 12 | `src/utils/awardsEngine.js:633` | projected qualify date |
| 13 | `src/services/exportService.js:110` | PDF file name date |
| 14 | `src/services/exportService.js:139` | branch CSV date |
| 15 | `src/services/ledgerExportService.js:51` | HO-check PDF "generated on" |

**ANCHORED / TIMESTAMP — output kept identical, raw call moved behind `ymdUTC()`:**
`campaignWhatIf.js:27` · `policyCampaignLens.js:152, 155` (`toDateStr`) · `strategicPlan/settledTwinRun.js:24` · `ledgerProduction.js:127` · `FinancingSelfView.jsx:53` · `CompliancePanel.jsx:42` · `manager/PersistencyTab.jsx:209` · `roster/periodUtils.js:62, 76, 77` · `UserManagementPanel.jsx:911` · `planner/recurrence.helpers.js:35` · `HistoryTab.jsx:67`.
Found during the build (after Phase 0 was posted) by the new lint rule / a wider grep, same treatment: `src/lib/policiesDerivation.js:39` (`.substring(0, 7)` month key for `settlementShapeFromPolicies`) and `src/components/manager/GoalsPanel.jsx:318, 417, 528` (`toISOString?.()` optional chain on `setAt`).
`toDateStr` is kept byte-identical on purpose: it dates `dateIssued` for awards and campaigns, and legacy docs stored at UTC midnight would move a day under TT formatting.

## Named deviation from the brief's wording (Part 1.2)

The brief names the stamps `confirmedBy / confirmedAt / enteredBy`. `confirmedAt` is already the
**manager** confirmation field (Arm C, `policiesService.js:317`), and `isConfirmed()` reads it
(`policyStatusTokens.js:28`). An agent writing `confirmedAt` would turn the policy gold
"Confirmed", print "Confirmed by undefined" in the drawer, and drop it from the manager's
Reconciliation worklist (`PolicyReconciliationPanel.jsx:188` filters `!confirmedAt`) — blending
declared and evidenced, which the ruling forbids. So the agent stamps are
`selfConfirmedBy` / `selfConfirmedAt` / `enteredBy` / `enteredAt`. Rename is one rules block and
one service function if Kyron prefers otherwise.

## Out of scope, noticed

`functions/` has its own TT helpers (`previewImport.js:28`, `setAgentOfMonth.js:15`,
`ingestCallActivity.js:118`) — server side, not client "today"; untouched.
