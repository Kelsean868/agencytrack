# Pre-Pilot End-to-End Shakedown — Kickoff Brief

**Status:** Ready to dispatch AFTER SEC-9b merges (runs against post-SEC-9b state).
**Estimated CC effort:** 6–10 hours, autonomous execution during Kyron's away window.
**Two-strike counter:** Project carry-in **0/2** (assuming SEC-9b ships clean). Standard 2-strike loop applies.
**Main HEAD at brief drafting:** post-#138 squash SHA (CC captures actual HEAD in Phase 1 — must be post-SEC-9b merge).
**Source:** Pilot critical path — final pre-pilot verification arc per the May 2026 session. Designed to surface defects before Tatil roster import.

---

## Context

PR-F (#135) shipped the bulk test data tooling. Track D cron timezone fix (#137) corrected the schedule misconfiguration. PR #136 fixed the doCreateUser emailQueued truthfulness bug. PR #138 plumbed CI test step. SEC-9b retires the runtime tenantId holder.

Pre-pilot critical path now narrows to two items:
1. End-to-end shakedown using PR-F tooling — **this brief**
2. Tatil roster delivery — external dependency

This brief is the comprehensive verification arc. CC autonomously seeds the 10 test users, exercises every role's surface against the production-equivalent Firebase project, captures findings in a structured report, and wipes the test data clean — all during Kyron's away window.

**Designed for unsupervised execution.** Strike protocol is calibrated for autonomous runs: bugs found are NOT strikes (that's the shakedown working as designed). Infrastructure failures (seed/wipe/cleanup) ARE strikes.

---

## Decisions locked (do not re-litigate)

### Report-only mode

CC does NOT attempt to fix bugs found during the shakedown. All findings go in a structured report; Kyron triages and commissions fix briefs separately. Autonomous fixes during an unsupervised window introduce risk that's hard to bound.

### Comprehensive scope

Full coverage across all 5 roles (Agent, Unit Manager, Branch Manager, Tenant Admin, Platform Admin where applicable), all primary surfaces, all permission boundaries, all edge cases.

### Sequencing: AFTER SEC-9b merge

The shakedown runs against post-SEC-9b state. This implicitly verifies the refactor didn't regress anything — extra value. Phase 1 includes a verification step to confirm SEC-9b's squash SHA is at HEAD before proceeding.

### Test data: PR-F roster (10 users) + standard seed shape

- 1 Branch Manager (`bm-001@agencytrack.test`)
- 2 Unit Managers (`um-001@agencytrack.test`, `um-002@agencytrack.test`)
- 7 Agents (`agent-001` through `agent-007@agencytrack.test`)
- 4 weeks of submissions × 7 agents = 28 submission docs
- 3 months of persistency × 7 agents = 21 persistency docs
- 1 throwaway "Test Campaign Q2" with 7 agents enrolled

All seeded via the existing PR-F runbook (`docs/runbooks/test-data-lifecycle.md`). CC follows the runbook steps mechanically.

### Tooling: Playwright + Firebase Admin SDK

- **Playwright** for UI-driven flows (login, navigation, form submission, visual capture)
- **Firebase Admin SDK** (via `functions/service-account-key.json`) for permission/data integrity verification, custom-token auth, programmatic edge-case triggering
- Existing precedents to mirror: `scripts/multi-role-smoke.cjs`, `scripts/exploration-walk.cjs`, `scripts/manager-audit-screenshots.cjs`
- a11y compliance via existing `@axe-core/playwright` integration

### Shakedown scripts ARE permanent infrastructure

Commit them to `scripts/verification/shakedown/` for future re-runs (post-pilot major changes, Tatil feature additions, regression suites). One-time-and-discard would waste the investment.

### Cleanup MUST run regardless of shakedown outcomes

Even if the shakedown surfaces 50 bugs mid-flight, Phase 6 cleanup still executes. Orphaned `*@agencytrack.test` users + Firestore docs in production are unacceptable.

### Tenant scope: `tatillife_south` only

Single-tenant pilot. Multi-tenant shakedown is out of scope (SEC-9b enables it but pilot doesn't exercise it).

### Time bound: 10 hours hard ceiling

If total execution exceeds 10 hours, STOP and checkpoint. Something's wrong — could be infinite loops in scripts, runaway test cases, or cascading auth failures. Surface and re-plan.

---

## Scope

Ships in this single arc:

- 1 new directory: `scripts/verification/shakedown/` with modular Playwright + Admin SDK scripts
- Comprehensive test coverage across all 5 roles and all primary surfaces
- Screenshot dossier captured to `verification/shakedown-screenshots-<timestamp>/` (gitignored)
- Findings report committed to `docs/shakedown-findings-<YYYY-MM-DD>.md`
- Clean seed → exercise → wipe cycle
- `docs/CONTEXT.md` "Recently shipped" row append
- `docs/FOLLOW_UPS.md` updates if any new follow-ups emerge from findings (banked, not fixed)

---

## Test plan — categories CC must cover

### Category 1: Authentication & session integrity

- Login as each of the 10 test users via Firebase Auth client SDK + custom-token path
- Verify auth state correctly restores tenantId, role, branchId, unitId claims
- Sign out → sign in as different role → no leaked state
- Token refresh after role/branch change (per PR-4b's claim-refresh atomicity)
- Refresh page mid-session → state preserved

### Category 2: Per-role surface coverage

For each role, exercise every primary surface and assert correct rendering/behavior:

**Agent surfaces:**
- AgentDashboard (KPI tiles, weekly champion banner, motivational carousel, badges, leaderboard rank)
- Weekly Wizard (all 5 screens / 9 steps, draft save, submit, validation errors, mid-flight back/refresh)
- Career Portal (goal tracking, commission playground recompute, club tier progress)
- History (past submissions, eye/preview affordance, unlock requests)
- Profile (E6 logging mode toggle: weekly → hybrid → daily, daily nudge time, photo upload)
- Notifications drawer (read/mark-read flow)
- Awards/Settlements panel (read-only)
- Mobile-viewport screenshots of all the above

**Unit Manager surfaces:**
- ManagerDashboard (unit-scoped agent list, motivational carousel)
- MasterSheet (23-column grid for unit, sortable, filterable)
- MeetingMode (unit-level presentation, slide navigation)
- AgentAwardsPanel (unit-scoped)
- Goals panel (gap analysis, can't edit company floor)
- Campaigns panel (visible: Test Campaign Q2)
- Settlements (read-only assertion)
- Persistency display (read-only assertion)

**Branch Manager surfaces:**
- ManagerDashboard (branch-scoped, all 7 test agents across 2 UMs)
- Settlements entry (BM has `canConfirmSettlements: true`) — enter a settlement, verify Awards Tracker switches from "Estimated" to confirmed
- Persistency entry — enter persistency for agent, verify display update
- Campaign creation flow (full create → edit → activate → notify path)
- User management (create user with PR-D email flow + PR #136 truthfulness check, edit user PR-4 flow, role/branch edit PR-4b flow, deactivate flow)
- Branch-level MasterSheet + BranchHealthCards
- Branch CSV export — verify file structure
- Goal entry across all 5 layers (Company Floor → Sales Manager → Branch → Unit → Personal)

**Tenant Admin surfaces:**
- UserManagementPanel (full user list, role distribution, branch distribution)
- BulkImportUsersModal (re-test the C2 flow + #136 emailQueued shape end-to-end with intentional CSV row that triggers email failure)
- BulkImportGoalsModal (re-test C3 flow)
- BranchesPanel (create / edit / deactivate / reactivate cycle)
- Company Config (B5 Company Floor entry)
- Kiosk Mode token management (generate token, verify URL renders, revoke)
- Awards Tracker (full visibility, settlement confirmation)
- Audit Log (visible if implemented)

**Platform Admin (cross-tenant — if SEC-9b enables it):**
- Verify cross-tenant capability now works after SEC-9b
- Permission assertion: platform_admin can access tatillife_south; non-platform_admin cannot pivot
- Note: if cross-tenant UI isn't shipped, just verify the API capability exists

### Category 3: Permission boundary matrix

Programmatic via Admin SDK — log in as role X, attempt unauthorized operation, assert deny:

| Acting role | Should be denied |
|---|---|
| Agent | Reading another agent's submission |
| Agent | Editing their own role or branchId |
| Agent | Writing to settlements |
| Agent | Entering persistency |
| Unit Manager | Reading another unit's agents |
| Unit Manager | Confirming settlements (read-only) |
| Unit Manager | Creating users |
| Branch Manager | Reading another branch's agents |
| Branch Manager | Editing Company Floor |
| Tenant Admin | Reading another tenant's data (cross-tenant) |
| (signed-out) | Reading anything |

Full role × collection × operation matrix. Aim for 100% coverage.

### Category 4: Form validation completeness

- Required fields empty → appropriate error
- Numeric fields with text → reject
- Date fields with non-Sunday for Week Starting → reject
- Email fields malformed → reject
- TTD currency negative/zero where positive expected → reject
- E6 mode switch with unsaved data → confirmation dialog
- Wizard step navigation with invalid state → blocked

### Category 5: Edge cases & boundary values

- Agent with zero submission history (newly seeded agent)
- Agent right at award thresholds (49 apps vs 50 for Centurion progress)
- Persistency at exactly 90% (the award eligibility threshold)
- Settlement entry on quarter boundaries (Dec 31 → Q4 vs Jan 1 → Q1)
- Agent with 4 weeks of submissions (post-seed) — KPI sparkline + week-over-week strip
- Empty campaign (no participants) — graceful empty state
- Concurrent submission (two browser sessions for same agent) — last-write-wins behavior

### Category 6: Cross-role data flow

- BM creates campaign → all 7 test agents see notification (within 5-10 seconds)
- Agent submits qualifying activity → leaderboard updates within 5 minutes (scheduled CF — note this is timing-dependent)
- Manager actions generate audit log entries (if audit log shipped)
- E6 daily entries aggregate to weekly draft on Sunday cron (note: simulating cron is out of scope; verify aggregation logic via direct Admin SDK call)

### Category 7: A11y compliance

- Run `@axe-core/playwright` against every primary surface
- Capture violations by severity (critical / serious / moderate / minor)
- Compare against the a11y CI gate baseline (32 jsx-a11y rules at error per memory)
- Flag any new violations introduced post-A11y arc

### Category 8: Visual regression (screenshot dossier)

- Capture every primary surface in:
  - Light mode + Dark mode
  - Desktop viewport + Mobile viewport
- Organize by role / surface / theme / viewport
- Provide directory of ~80-120 screenshots for Kyron's visual review
- This is NOT visual regression vs. a baseline — just structured capture for human review

### Category 9: SEC-9b implicit verification

- Run every test category and assert no `tenantId`-related runtime errors
- Verify Firestore writes carry correct `tenantId` for the acting user's tenant
- Verify cross-tenant attempts deny correctly (per Category 3)

### Category 10: Email infrastructure verification

- Create a user → verify `mail/` collection receives the doc (server-side Trigger Email Extension)
- Verify `emailQueued` return shape correctly reflects mail/ write result (per PR #136)
- Try inducing a mail/ write failure (if possible) → verify `emailQueued: false + emailError` returned
- Note: actual SendGrid delivery not verified (out of scope — would require SendGrid API access)

---

## Output specification — findings report format

Single markdown file at `docs/shakedown-findings-<YYYY-MM-DD>.md` with structure:

```markdown
# Pre-Pilot Shakedown Findings — <Date>

## Executive summary
- Total tests run: N
- Pass: P / Fail: F / Inconclusive: I
- Bugs found: B (Blocker: X, Major: Y, Minor: Z, Polish: W)
- Recommendation: ship pilot / fix-then-ship / hold

## Bug inventory

### Bug 001 — <title>
- **Severity:** Blocker / Major / Minor / Polish
- **Category:** Functional / Visual / Permission / Edge case / a11y / Performance
- **Role:** Affected role(s)
- **Surface:** Affected surface(s)
- **Expected:** What should happen
- **Actual:** What happened
- **Repro:** Numbered steps to reproduce
- **Screenshot:** Path to relevant screenshot(s) in `verification/shakedown-screenshots-<timestamp>/`
- **Suggested fix area:** File / component / service likely involved
- **Effort estimate:** Rough hours (S/M/L bucket)

### Bug 002 — ...

## Test coverage report
- Per-category coverage statistics
- Any categories that couldn't be fully exercised (with reasons)

## Performance observations
- Slow surface load times (if any)
- Slow Firestore queries (if observable)
- Slow Cloud Function cold starts (if observable)

## A11y violations summary
- Critical / Serious / Moderate / Minor counts
- New violations vs. baseline (if detectable)

## Open questions for Kyron
- Items that surfaced where CC's judgment isn't sufficient (domain-specific, UX-aesthetic, etc.)
```

Severity definitions:
- **Blocker:** Pilot cannot launch with this bug. Data loss, security boundary breach, core flow broken.
- **Major:** Pilot can launch but bug significantly impacts user experience or specific workflows.
- **Minor:** Annoying but workaround exists.
- **Polish:** Visual / copy / UX refinement.

---

## File inventory

**New files (CC creates):**

| Path | Purpose |
|---|---|
| `scripts/verification/shakedown/auth-helpers.mjs` | Custom-token auth for test users + session management |
| `scripts/verification/shakedown/role-agent-walk.mjs` | Agent surface coverage |
| `scripts/verification/shakedown/role-unit-manager-walk.mjs` | UM surface coverage |
| `scripts/verification/shakedown/role-branch-manager-walk.mjs` | BM surface coverage |
| `scripts/verification/shakedown/role-tenant-admin-walk.mjs` | TA surface coverage |
| `scripts/verification/shakedown/permission-matrix.mjs` | Full role × collection × operation matrix |
| `scripts/verification/shakedown/form-validation.mjs` | Form validation completeness |
| `scripts/verification/shakedown/edge-cases.mjs` | Boundary values & edge conditions |
| `scripts/verification/shakedown/cross-role-flows.mjs` | Cross-role data flow verification |
| `scripts/verification/shakedown/a11y-sweep.mjs` | Axe-core compliance per surface |
| `scripts/verification/shakedown/screenshot-dossier.mjs` | Structured visual capture |
| `scripts/verification/shakedown/email-infrastructure.mjs` | mail/ collection + #136 shape verification |
| `scripts/verification/shakedown/run-all.mjs` | Orchestrator — runs all categories sequentially |
| `docs/shakedown-test-plan.md` | Phase 1 deliverable — surfaced for Kyron's review before Phase 2 |
| `docs/shakedown-findings-<YYYY-MM-DD>.md` | Phase 5 deliverable — the report |

**Files referenced but not modified:**

- `docs/runbooks/test-data-lifecycle.md` — followed for seed/wipe
- `scripts/seed/*` — invoked for data seeding (PR-F infrastructure)
- `scripts/cleanup/*` — invoked for data cleanup (PR-F infrastructure)
- `scripts/verification/lib/walk-helpers.mjs` — reused where applicable

**Files touched (docs only):**

- `docs/CONTEXT.md` — append "Recently shipped" row
- `docs/FOLLOW_UPS.md` — bank any new follow-ups surfaced (NOT fix the underlying bugs)

---

## Phases

### Phase 1 — Discovery & Test Plan (gates Phase 2; the most important phase)

1. Verify pre-conditions:
   - Main HEAD includes SEC-9b squash SHA (post-SEC-9b state)
   - `npm test` passes (608+ tests after SEC-9b)
   - `npm run lint` passes
   - `functions/service-account-key.json` present
   - `CLEANUP_ALLOWED_TENANTS=tatillife_south` env set
   - PR-F runbook intact at `docs/runbooks/test-data-lifecycle.md`

2. Read existing Playwright scripts to understand precedents:
   - `scripts/multi-role-smoke.cjs`
   - `scripts/exploration-walk.cjs`
   - `scripts/manager-audit-screenshots.cjs`
   - `scripts/a11y-axe-scan.cjs`
   - Identify reusable patterns: auth flow, screenshot capture, viewport config, assertion infrastructure

3. Read the runbook + PR-F seeder/cleanup scripts to confirm seed/wipe mechanics.

4. Produce `docs/shakedown-test-plan.md` covering:
   - Per-category test inventory (specific tests, not just categories)
   - Auth strategy (how each role's session gets established)
   - Screenshot organization (filesystem layout for the dossier)
   - Estimated test count per category
   - Parallelization opportunities (which categories can run concurrently)
   - Total estimated runtime

5. Surface the test plan in chat. **Kyron acknowledges before Phase 2.** This is the autonomy checkpoint — if the test plan looks wrong, fix it before CC commits to multi-hour execution.

### Phase 2 — Script implementation

- Write all scripts per the file inventory
- Modular structure: each category in its own file
- Shared auth helpers + screenshot helpers
- `run-all.mjs` orchestrates — sequential by default, parallel where annotated safe
- Each category produces structured JSON output (assertions, screenshots taken, bugs found)
- Lint clean: `npm run lint` passes on all new scripts
- Local syntax check: `node --check scripts/verification/shakedown/run-all.mjs`

### Phase 3 — Seed test data

Follow PR-F runbook mechanically:
1. Generate CSVs via `scripts/seed/generate-users-csv.mjs` and `generate-goals-csv.mjs`
2. Import users + goals (CC simulates the manual modal step by calling the underlying services directly — the modal is exercised separately in Category 2)
3. Run direct seeders for submissions, persistency, campaign
4. Verify seed completed correctly: 10 users in Auth, 10 user docs in Firestore, 28 submissions, 21 persistency docs, 1 campaign — counts must match

If seed fails → STOP, surface, do NOT proceed to shakedown.

### Phase 4 — Execute shakedown

- Run `run-all.mjs` — sequential execution, all 10 categories
- Each category captures: assertion results, screenshots, bugs found
- Continue through all categories even if some fail (reconnaissance mode, not fail-fast)
- Per-category logs to `verification/shakedown-<timestamp>/<category>/log.txt`
- Screenshots to `verification/shakedown-screenshots-<timestamp>/<role>/<surface>/<theme>/<viewport>.png`
- Total runtime budget: 4–8 hours

If execution stalls (any single category > 90 minutes) → checkpoint and surface.

### Phase 5 — Report generation

Compile findings into `docs/shakedown-findings-<YYYY-MM-DD>.md` per the output specification. Cross-reference every bug to its screenshot. Include executive summary with go/no-go recommendation.

### Phase 6 — Cleanup (MUST RUN regardless of shakedown outcomes)

Follow PR-F cleanup:
1. Run `scripts/cleanup/preview-test-data-sweep.mjs --mode=email-pattern` → review enumerated paths
2. Run `scripts/cleanup/wipe-test-data-sweep.mjs --mode=email-pattern --execute` with typed confirmation
3. Verify post-wipe: 0 `*@agencytrack.test` users in Auth, 0 test docs in Firestore
4. If cleanup fails → STOP and surface immediately. Production orphans = critical issue.

### Phase 7 — Commit + PR

- Lint clean: `npm run lint`
- Tests pass: `npm test`
- Build succeeds: `npm run build`
- Update `docs/CONTEXT.md` Recently-shipped row
- Update `docs/FOLLOW_UPS.md` with any new follow-ups banked from findings
- Conventional commits — split by logical unit (one per category or one combined)
- Push, open PR
- **PR title:** `test(shakedown): pre-pilot end-to-end shakedown infrastructure + findings`
- **PR description includes:** executive summary from findings report, bug count by severity, link to full report

### Phase 8 — STOP

DO NOT MERGE. Kyron reads findings report on return, triages bugs, decides next moves.

---

## Hard stops

- **Seed phase fails** → STOP, no shakedown without test data
- **Cleanup phase fails** → STOP IMMEDIATELY, manual cleanup required (potential production orphans)
- **`npm run lint` fails** → fix, don't commit broken scripts
- **Any test action touches a non-`*@agencytrack.test` user** → STOP IMMEDIATELY (data corruption risk)
- **Any test action targets a tenant other than `tatillife_south`** → STOP IMMEDIATELY
- **Total execution exceeds 10 hours** → STOP, checkpoint, surface
- **Any single category exceeds 90 minutes** → STOP, checkpoint, surface
- **More than 20 blocker-or-major bugs found** → STOP, surface (something fundamental is wrong, don't keep accumulating)
- **Phase 1 test plan diverges materially from this brief's category list** → STOP, surface, await acknowledgement
- **Auth state corruption** (test user can't log in mid-shakedown) → STOP, surface
- **Firestore quota or rate limits triggered** → STOP, surface
- **Cloud Function deploy state changes mid-shakedown** (someone else deploying) → STOP, surface

---

## NOT in scope

- Autonomous bug fixes — report-only mode locked
- Manual UX / aesthetic judgment — flag for Kyron's review
- Mobile interaction testing (touch gestures, swipes) — desktop + mobile-viewport screenshots only
- Performance benchmarking — observational only
- Load testing — single test session at a time
- SendGrid actual email delivery — verify mail/ writes only
- Cron timing tests — schedules fire on real Trinidad time
- Domain-specific Trinidad workflow validation — Kyron's expertise
- Cross-tenant scenarios beyond verifying the API capability exists
- Refactoring existing scripts or services
- Adding tests to vitest suite (separate from shakedown scripts)
- Pilot launch decision — Kyron makes the call based on findings

---

## Verification matrix (CC must include in PR description)

| Item | Expected |
|---|---|
| Pre-conditions verified | Main HEAD post-SEC-9b, 608+ tests pass, lint clean, service-account-key present |
| Test plan committed | `docs/shakedown-test-plan.md` present, Kyron acknowledged |
| All categories ran | 10/10 categories executed, results logged |
| Screenshots captured | Count ≥ 80, organized by role/surface/theme/viewport |
| Findings report committed | `docs/shakedown-findings-<YYYY-MM-DD>.md` with executive summary, bug inventory, coverage report |
| Seed verified | Test data fully created (10 users, 28 submissions, 21 persistency, 1 campaign) |
| Cleanup verified | Post-wipe: 0 `*@agencytrack.test` users, 0 test docs in Firestore |
| Lint clean | `npm run lint` → 0 errors |
| Build succeeds | `npm run build` → success |
| Tests pass | `npm test` → 100% pass (existing suite, no regressions) |
| Total runtime | < 10 hours |
| No production data affected | All operations confined to `*@agencytrack.test` and `testDataBatchId`-marked docs |

---

## CC kickoff prompt (one-liner)

> Execute the pre-pilot shakedown per the brief in `docs/briefs/pilot-shakedown-kickoff.md`. Project strike count 0/2. Standard 2-strike loop, calibrated for autonomous execution: bugs found are NOT strikes, infrastructure failures ARE strikes. Pre-conditions: SEC-9b must be merged to main first. Read the brief, begin Phase 1 (discovery + test plan). Surface the test plan in chat before any script implementation. This is a 6–10 hour autonomous arc — pace accordingly, checkpoint per category. Report-only mode: no autonomous bug fixes, all findings go in `docs/shakedown-findings-<YYYY-MM-DD>.md`. Cleanup MUST run regardless of outcomes. Do NOT merge — open PR with the report, stop.
