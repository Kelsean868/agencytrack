# Fable Verification & Hardening Run — Progress Checklist

> **Control surface for Fable Run 2** (brief: `docs/briefs/fable-verification-hardening-kickoff.md`).
> Lives on the `staging` branch; updated in the SAME commit as each item's work.
> Statuses: `PENDING` / `IN-PROGRESS` / `DONE-IN-STAGING` / `NEEDS-HUMAN-REVIEW` / `SKIPPED` (with reason).
> Authority: Run 1 AUTHORITY section governs (staging branch + agencytrack-staging ONLY; HARD STOPS unchanged).
> Run started 2026-07-09. CONTINUOUS — no mid-run checkpoint; hold at end with final smoke table.

## Run state

| Field | Value |
|---|---|
| Current phase | **B — Smoke suite authoring (Phase A complete)** |
| Last session | 2026-07-09 (session 1, Fable orchestrator) — Phase A seeded + executed |
| Staging branch base | `fa5fa29c` (main w/ VH brief merged into staging) |
| Staging URL | `https://agencytrack-git-staging-kyron-marchan-s-projects.vercel.app` |
| Accounts | staging-{tenant-admin, branch-manager, unit-manager, agent-1, agent-2, cro}@agencytrack-staging.test (tenant `staging_test`, branch `staging_branch`) |

## Promotion-review flags (new this run — expected NONE)

_(none yet — Run 1's 5 standing flags remain listed in `docs/fable-build-progress.md`)_

---

## PHASE A — Seed deepening

Deliverable: `scripts/staging/seed-fixtures.mjs` (idempotent, re-runnable, staging-guarded, invoked after `seed-staging.mjs`), committed + executed against staging.

**Status: ALL 12 FAMILIES DONE-IN-STAGING (2026-07-09).** `scripts/staging/seed-fixtures.mjs` committed; executed twice against staging (idempotency proven — 88 docs, fixed `vhfix-*`/composite IDs, re-run resets fixture state and undoes smoke mutations). Rule-17 schema truth extracted from staging source by 3 parallel agents before authoring; every fixture family carries hand-computed smoke expectations. Read-back probe verified all collections populated. Bonus: staging `onSubmissionWrite` CF fired on the seeded submissions (leaderboard/notifications docs appeared) — real CF integration confirmed live.

| # | Fixture family | Status | What / why / surface unlocked |
|---|---|---|---|
| A1 | Submissions | DONE-IN-STAGING | A1 9 submitted wks (2026-05-03..06-28, all ≥4800 → 9 award weeks + 9-wk streak; best week 05-31 = 22,000; **YTD 122,000** → ratio 0.94 vs tenure floor 250k → clean) + this-week DRAFT (Master Sheet draft-exception + daily anchor WTD 3,000). A2 3 gappy wks (**YTD 8,500** → ratio 0.065 → `floor` DANGER flag; no this-week sub → non-filer + Meeting-Mode `report` flag). UM 3 wks + BM 2 wks producing subs (mp surfaces; BM unitId `__branch_direct__`). V2 wizard shape (`newBusiness`/`pppIncreases`/`lumpsums`/`totalProductionCredit`/`version:2` + full flat activity fields, `rating*` names). Unlocks: Agent Report View, exception lead panel, Master Sheet, awards pace, history drill/streaks, campaigns standings, kiosk podium, anchor strips. |
| A2 | WARs | DONE-IN-STAGING | UM 2026-06-21 + 06-28 SUBMITTED (BM-reviewable, rank 1<2), BM 06-28 SUBMITTED (TA-reviewable), BM 07-05 draft (overwrote Run-1 smoke crumb, same doc ID). Full `validWarWrite` shape incl. `managerRoleRank`, `jfwCount:0` echo. Unlocks: 2.1 review round-trip (approve/request-changes/self-review-denied). |
| A3 | Goals + plans | DONE-IN-STAGING | `config/companyMinimums` written explicitly (weekly api floor 4800, tenure bands, workingDaysPerWeek 5 — deterministic floors). goals/{a1}: personal 250k/50/92 + manager targets (weekly 5000); goals/{a2}: personal floor-level. unitGoals/{um}_2026 (600k/120 + FFI 200/CI 120/Dials 4000), branchGoals/2026 (1.5M/300 + activity). yearPlan+monthlyPlan COMMITTED for A1 (250k: life 150k/ah 50k/gen 50k) + UM (150k) → game-plan hub AllocationBar/MiniMonthStrip + D1 manager prefetch targets. weeklyPlans/{a1}_2026-07-05 (5 targets, provenance). Unlocks: gap analysis, pace math, game-plan hub, plan variance. |
| A4 | Financing | DONE-IN-STAGING | Terms both agents (`on_financing`). A1 ledger 6 mo declining runningBalance 30000→11000 (rate ≈3,800/mo → K9 arc + ~3 mo projection) + 3 confirmed MEETs. A2 ledger 4 mo climbing balance + **2 consecutive confirmed MISSes** (8000/9500 vs 12000, `submitted-final`) → amber + **adjustmentPct 0.15 > 0.10 flag** → K7 'At risk' chip. Unlocks: K9 PaydownArcHero, K7 roster tones. |
| A5 | Policies | DONE-IN-STAGING | 8 `vhfix-pol-*`: A1 settled+undelivered at issued-5d (**within**, daysLeft 25) / 26d (**at-risk**, 4) / 40d (**overdue**, −10) + settled+delivered (CRO fields) + submitted in-flight (social-media source); A2 within + in-flight + **lapsed** (persistency/lens EXCLUDED check). Full `createPolicy` shape (`proposedAPI`/`settledAPI`, enums). Unlocks: CRO register 3 tabs, DeliveryStripCard, clawback tones, mark-delivered Arm-E round-trip, ledger lens counts. |
| A6 | Persistency | DONE-IN-STAGING | E3 docs both agents × 2026-04/05/06: A1 gross 21/net 20 = **95.24%** (>90 band ×1.0, meetsAwardGate); A2 gross 18/net 15 = **83.33%** (80-84 band ×0.25). All six E3 inputs present (isE3Doc gate). monthKey dash vs doc-ID underscore honored. Unlocks: persistency tab bands, campaign gate multiplier. |
| A7 | Campaigns | DONE-IN-STAGING | `vhfix-camp-qualify` (structure qualify, 3 tiers Bronze/Silver/Gold, gate ON, kiosk+meeting, window 05-03→08-01): **A1 = Gold (122k/22) × gate 1.0 → projectedCash 10,000 / voucher 2,500**; A2 below Bronze. `vhfix-camp-placement` (3 ranks, window 06-07→08-01): **A1 rank 1 = 3,000×1.0; A2 rank 2 = 1,500×0.25 = 375**. Hand-computed payout NUMBERS for the Tier-2 assertion. Unlocks: standings, kiosk campaign panel, Meeting-Mode campaign scene. |
| A8 | Recruiting | DONE-IN-STAGING | 8 candidates, one per stage sourced→licensed; `vhfix-rec-4` (interview) stageChangedAt −20d → **STALLED** (>14d); `vhfix-rec-8` licensed + licensedAt; owners alternate UM/BM. Full `validCandidateWrite` shape. Unlocks: kanban write-read + stalled badge, funnel. |
| A9 | Appointments | DONE-IN-STAGING | A1 planner week: today 5 slots (PC/FFI-confirmed/FREE 'Prospecting time'/CI/SALE-kept apiAmount 8000), +1d/+2d/+3d spread, **postpone-rebook pair** (`vhfix-appt-rebook-old` postponed → `rescheduledToId` → `-new`), prospectId links to preps. `agentUnitId`=UM uid, `agentBranchId` set → UM/BM Team Planner composites. Unlocks: planner day/week, churn, Team Planner. |
| A10 | Prospect preps | DONE-IN-STAGING | 4 in `users/{a1}/prospectInfo`: today (prepped whole-life, 2 objections → imminent+ready), tomorrow (prepped term-life), +4d (**unprepped** — no policyType/objections), −3d (**overdue**). Taxonomy-valid objections/policyType. Unlocks: NextCallHero, countdown tones, rehearsal chips, readiness states. |
| A11 | CRO user | DONE-IN-STAGING | Idempotent re-seed (auth+claims+user doc — existed from Run 1, refreshed). 5 undelivered settled policies across agents for register tabs. Also: **orphan BM user doc `HqNHvANo…` deleted** (no auth backing; was polluting rosters) via generic email-vs-uid sweep. |
| A12 | Feature flags | DONE-IN-STAGING | `config/settings.featureFlags = {persistencyV2, policyLedgerCampaignLens, awardsProvenance} = true` (merge — companyName/currency preserved). Plus `kioskTokens/vhfix-kiosk-token` (tenantId+branchId, no expiry) for the Tier-3 kiosk stage leg. |

**Known drift banked for Phase B/C:** `weeklyPlanService` writes target key `telContacts` while `firestore.rules` `validPlanWrite()` requires `contactsMade` (hasAll+hasOnly) — a client-SDK weekly-plan commit would be DENIED by deployed rules. Seeded the service shape (what the app reads). Phase B must exercise the plan-commit write path; if it fails live, this is the root cause (Phase-C classification: pre-existing vs Run-1 regression TBD via git log).

## PHASE B — Full-surface live smoke suite

Deliverable: `scripts/verification/smoke-vh-staging.mjs` (registered in SMOKES.md), tiered, value-level assertions, per-role. PASS/FAIL/SKIP table per leg per role + failure screenshots. Env gap = SKIP-with-reason → extend seed → re-run leg.

| Leg group | Status | Notes |
|---|---|---|
| B-T1: palette cross-role (incl. mobile) · Agent Report View POPULATED (hand-computed expectation via extractFields) · admin quick-add · drag-reorder write-read-verify · exception lead panel (agent-2 flags) + AgentDrill Report tab · Master Sheet reality bar/presets/exceptions | PENDING | |
| B-T2: WAR review round-trip AS UPLINE (approve + request-changes; self-review DENIED) · recruiting kanban write-read + stalled badge · settings round-trip · PDF CTAs enabled · History drill + edit path · awards pace line · financing K9 arc + K7 tones · campaigns standings (payout NUMBER) · daily anchor strip + streak celebration fire-once · game-plan AllocationBar/MiniMonthStrip | PENDING | |
| B-T3: CRO register + mark-delivered round-trip (Arm E) · planner day/week + postpone-rebook link · Team Planner AS UM+BM · Meeting Mode deck AS BM (scene count) · flag-gated shells ON (+ one flag-OFF spot-check + restore) · prospect prep hero/countdown/rehearsal · kiosk stage (campaign panel, podium order, reduced-transparency) | PENDING | |
| B-XC: reduced-motion (count-ups snap) · dark-mode contrast spot-checks · console-clean on EVERY leg · zero requests to agencytrack-2a610 (network-log assertion) | PENDING | |

## PHASE C — Fix confirmed regressions

_(populated from Phase-B FAILs: reproduce 2x → root-cause → classify (a) Run-1 bug = fix + red-verified test + re-smoke / (b) smoke-script bug = fix script / (c) needs ruling = SKIP-and-log with unblock)_

| Fail | Class | Status | Notes |
|---|---|---|---|
| _(none yet)_ | | | |

## PHASE D — Pre-ruled follow-ups

| Item | Status | Notes |
|---|---|---|
| D1 Manager mp-game-plan prefetch (extend #829 gamePlanPrefetch.js to ManagerDashboard idle; motion-verifier before/after on manager transition) | PENDING | |
| D2 Keyboard nav-reorder (Alt+ArrowUp/Down within section, Escape cancel, Enter commit, aria-live, useNavOrder persistence, reduced-motion safe) | PENDING | |
| D3 SM/TA Team Planner nav (wire existing TeamPlannerPanel for sales_manager + tenant_admin; read-only, same trust marker) | PENDING | |

## OPERATOR-RULED (this run)

- ProfileScreen loggingMode picker STAYS — do not remove/alter. Manager-override half = post-promotion contracted item, NOT this run.
- Tunable constants CONFIRMED as-is (pace 0.5/0.85, stalled 14d, gate bands 90/85/80, readiness criteria).

## PRE-RULED SKIPS

Noticeboard collection · kiosk per-slide config persistence · prospect callbackDueAt · manager plan-review banner · mobile presenter remote · density substrate · anything needing a new collection/write-path contract · payout-release logic (HARD STOP, always).

---

## Session log

- **2026-07-09 (session 1):** Run started. Read VH brief + Run-1 brief AUTHORITY + Run-1 progress doc. Verified staging worktree (`C:/Projects/at-fable-staging`, branch `staging`, HEAD `fa5fa29c`), staging SA key present + `.env.staging` present (STAGING_BASE_URL, VERCEL_BYPASS_TOKEN, STAGING_SEED_PASSWORD). Checklist created. Beginning Phase A: schema-truth extraction (Rule 17) → seed-fixtures.mjs authoring → orchestrator-verified execution against staging.
- **2026-07-09 (session 1, cont.):** **PHASE A COMPLETE.** Read-only staging probes (canonical auth uids captured; orphan BM user doc found). 3 parallel Sonnet extraction agents returned exact schemas + derivation thresholds for all 12 families (submissions/WARs/goals · financing/policies/persistency/flags · campaigns/recruiting/appointments/prospect/kiosk/meeting-deck). Orchestrator authored `scripts/staging/seed-fixtures.mjs` (dual-guard, dry-run/apply, idempotent fixed-ID design) and executed twice (idempotency proven, 88 docs). Read-back probe verified. One drift finding banked (weeklyPlans `telContacts` vs rules `contactsMade`). Next: Phase B suite authoring (`scripts/verification/smoke-vh-staging.mjs`).

## TIMING LOG

| item | model | effort | dispatched | completed | duration | outcome |
|---|---|---|---|---|---|---|
| run-setup: briefs + Run-1 state + env verification + checklist | fable (orchestrator) | inherited-default | 2026-07-09T06:10 | 2026-07-09T06:28 | ~18 min | done — checklist committed `01c06752`, pushed |
| A: schema extraction — submissions/WARs/goals | sonnet (Explore) | inherited-default | 2026-07-09T06:29 | 2026-07-09T06:36 | 6.5 min | done — full shapes + thresholds; found weeklyPlans rules drift |
| A: schema extraction — financing/policies/persistency/flags | sonnet (Explore) | inherited-default | 2026-07-09T06:29 | 2026-07-09T06:33 | 3.6 min | done — full shapes incl. Arm E, clawback, miss engine |
| A: schema extraction — campaigns/recruiting/planner/prospect/kiosk | sonnet (Explore) | inherited-default | 2026-07-09T06:29 | 2026-07-09T06:35 | 6.1 min | done — standings math, deck logic, prospectInfo subcoll correction |
| A: staging probes + seed-fixtures.mjs authoring + 2× apply + verify | fable (orchestrator) | inherited-default | 2026-07-09T06:30 | 2026-07-09T07:05 | ~35 min | done — 88 docs, idempotent, orphan cleaned |
