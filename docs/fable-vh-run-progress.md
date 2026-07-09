# Fable Verification & Hardening Run — Progress Checklist

> **Control surface for Fable Run 2** (brief: `docs/briefs/fable-verification-hardening-kickoff.md`).
> Lives on the `staging` branch; updated in the SAME commit as each item's work.
> Statuses: `PENDING` / `IN-PROGRESS` / `DONE-IN-STAGING` / `NEEDS-HUMAN-REVIEW` / `SKIPPED` (with reason).
> Authority: Run 1 AUTHORITY section governs (staging branch + agencytrack-staging ONLY; HARD STOPS unchanged).
> Run started 2026-07-09. CONTINUOUS — no mid-run checkpoint; hold at end with final smoke table.

## Run state

| Field | Value |
|---|---|
| Current phase | **A — Seed deepening (starting)** |
| Last session | 2026-07-09 (session 1, Fable orchestrator) — run start, checklist created |
| Staging branch base | `fa5fa29c` (main w/ VH brief merged into staging) |
| Staging URL | `https://agencytrack-git-staging-kyron-marchan-s-projects.vercel.app` |
| Accounts | staging-{tenant-admin, branch-manager, unit-manager, agent-1, agent-2, cro}@agencytrack-staging.test (tenant `staging_test`, branch `staging_branch`) |

## Promotion-review flags (new this run — expected NONE)

_(none yet — Run 1's 5 standing flags remain listed in `docs/fable-build-progress.md`)_

---

## PHASE A — Seed deepening

Deliverable: `scripts/staging/seed-fixtures.mjs` (idempotent, re-runnable, staging-guarded, invoked after `seed-staging.mjs`), committed + executed against staging.

| # | Fixture family | Status | What / why / surface unlocked |
|---|---|---|---|
| A1 | Submissions — 8-10 wks × both agents (agent-1 strong/streaky + best week; agent-2 weak/gappy) + this week + drafts + manager (producing) subs | PENDING | |
| A2 | WARs — BM + UM weekly reports incl. status='submitted' (review-flow targets) + one draft | PENDING | |
| A3 | Goals — hierarchy + personal commitments (reachable pace/derived-income/celebration thresholds); tier goals w/ FFI/CI/Dials | PENDING | |
| A4 | Financing — terms + monthly ledger (agent-1 declining runningBalance → K9 arc; agent-2 miss + >10% flag → K7 risk cards) | PENDING | |
| A5 | Policies — settled+undelivered (CRO register, clawback tones within/at-risk/overdue), settled+delivered, submitted in-flight, one lapsed | PENDING | |
| A6 | Persistency — both agents across months (one >90, one 80-84 band) | PENDING | |
| A7 | Campaigns — ACTIVE tiered 'qualify' (3 tiers, persistencyGateEnabled, kiosk+meeting) + one 'placement'; windows cover seeded subs | PENDING | |
| A8 | Recruiting — 6-8 candidates across 8 stages incl. one stalled >14d, one licensed-this-year, mixed UM+BM owners | PENDING | |
| A9 | Appointments — agent-1 planner week (today mixed types + free block, rest of week, postponed+rebook pair) | PENDING | |
| A10 | Prospect preps — upcoming (today/tomorrow/in-N-days), one overdue, one fully prepped, one unprepped | PENDING | |
| A11 | CRO user persists (re-seed if absent) + undelivered policies for register tabs | PENDING | |
| A12 | Feature flags — `config/settings.featureFlags = { persistencyV2: true, policyLedgerCampaignLens: true, awardsProvenance: true }` | PENDING | |

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

## TIMING LOG

| item | model | effort | dispatched | completed | duration | outcome |
|---|---|---|---|---|---|---|
| run-setup: briefs + Run-1 state + env verification + checklist | fable (orchestrator) | inherited-default | 2026-07-09T00:00 | 2026-07-09T00:20 | ~20 min | done — checklist committed |
