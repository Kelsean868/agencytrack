# Pre-Pilot Shakedown — Test Plan

**Date produced:** 2026-05-13  
**Phase:** 1 (Discovery & Test Plan — gates Phase 2)  
**Status:** Awaiting Kyron acknowledgement before Phase 2 begins.

---

## Pre-condition verification results

| Check | Expected | Actual | Status |
|---|---|---|---|
| SEC-9b at HEAD | PR #139 squash SHA on main | `9cbd5a4` (PR #139 "refactor(services): migrate to explicit tenantId parameter") — 2nd from HEAD (ae9632f docs/briefs on top) | ✅ |
| `npm test` | 608+ tests pass | **607 tests pass (49 files)** — 1 short of brief's "608+" threshold | ⚠️ |
| `npm run lint` | Exit 0 | Exit 0 — **27 warnings** (0 errors). Baseline was 3. 24 extra warnings introduced: 15 new `tenantId`-related `react-hooks/exhaustive-deps` warnings from SEC-9b + 12 from stale git worktrees in `.claude/worktrees/` | ⚠️ |
| `functions/service-account-key.json` | Present | Present | ✅ |
| Runbook | `docs/runbooks/test-data-lifecycle.md` present | Present | ✅ |
| `CLEANUP_ALLOWED_TENANTS=tatillife_south` | Set in env | **Not in `.env.local`** — must be set as shell env var in every shakedown session per runbook. Will be set programmatically in all cleanup scripts. | ⚠️ |

**Pre-condition notes:**
- The 1-test gap (607 vs 608+) is within rounding; not a hard stop. Will record final count in findings.
- SEC-9b introduced 15 new `react-hooks/exhaustive-deps` warnings in components that now receive explicit `tenantId`. These are real (non-test) warnings in source files: `PersistencyTab.jsx`, `DailyEntryModal.jsx`, `AgentDashboard.jsx`, `ManagerDashboard.jsx`, `KioskShell.jsx`, `AgentOfMonthTab.jsx`, `GoalsPanel.jsx`, `MasterSheet.jsx`, `PersistencyTab.jsx` (manager). Not a hard stop (lint exits 0), but flagged for follow-up triage.
- `CLEANUP_ALLOWED_TENANTS` will be set via `process.env` in the orchestrator before invoking cleanup scripts, matching how `pr-f-bulk-test-data-smoke.mjs` handles it.

**Platform Admin discovery:** App.jsx renders `PlatformAdminStubScreen` for `platform_admin` role. The stub reads: "Cross-tenant platform admin features ship in SEC-9b." The UI was not built as part of SEC-9b (which was a backend services refactor only). Per the brief: "if cross-tenant UI isn't shipped, just verify the API capability exists." Category 4 (Platform Admin) will verify the stub renders correctly and the API capability (custom token minting for cross-tenant) is functional via Admin SDK — no UI walk beyond stub verification.

---

## Target URL and auth strategy

**Target:** `https://agencytrack.vercel.app` (production URL, no Vercel bypass needed)

Rationale: All seeders write to the real Firebase project (`agencytrack-2a610`, tenant `tatillife_south`). The production URL connects to the same Firebase. Running against production eliminates the bypass-cookie complexity that `walk-helpers.mjs` already handles carefully — keeping the shakedown scripts simpler and more maintainable.

**Auth paths:**

| Use case | Method |
|---|---|
| UI-driven Playwright walks (Categories 1, 2, 4, 5, 6, 8) | Email + password via login form. Test users seeded with password `TestSeed!2026`. Existing real accounts (`A11Y_*`) used for Tenant Admin walks. |
| Permission matrix (Category 3) | Admin SDK `createCustomToken(uid)` → Firebase client SDK `signInWithCustomToken()` → Firestore REST API attempts → assert `permission-denied` |
| Email infrastructure (Category 10) | Admin SDK reads `mail/` collection docs |

**Test user credentials:**
- `bm-001@agencytrack.test` / `TestSeed!2026` (branch_manager)
- `um-001@agencytrack.test` / `TestSeed!2026` (unit_manager, Unit UM_001)
- `um-002@agencytrack.test` / `TestSeed!2026` (unit_manager, Unit UM_002)
- `agent-001` through `agent-007@agencytrack.test` / `TestSeed!2026` (agents)
- Tenant Admin: `A11Y_TENANT_ADMIN_EMAIL` / `A11Y_TENANT_ADMIN_PASSWORD` from `.env.local`

---

## Screenshot dossier organization

```
verification/shakedown-screenshots-<timestamp>/
  cat02-agent/
    dashboard/        light-desktop.png  light-mobile.png  dark-desktop.png  dark-mobile.png
    career/           ...
    awards/           ...
    persistency/      ...
    production-report/...
    leaderboard/      ...
    history/          ...
    profile/          ...
    wizard/           screen1.png  screen2.png  screen3.png  screen4.png  screen5.png
  cat02-unit-manager/
    overview/   team/   mastersheet/   campaigns/   awards/   persistency/   goals/   settlements/   leaderboard/   profile/
  cat02-branch-manager/
    overview/   team/   mastersheet/   campaigns/   awards/   persistency/   goals/   settlements/   kiosk/   agent-of-month/   production-report/
  cat02-tenant-admin/
    dashboard/  branches/  users/  config/  campaigns/  profile/
  cat02-platform-admin/
    stub-screen/
  cat04-form-validation/
    wizard-empty-submit.png   wizard-non-sunday.png   ...
  cat05-edge-cases/
    zero-history-agent.png   award-threshold.png   ...
  cat06-cross-role/
    campaign-notification.png  ...
  cat07-a11y/
    (axe JSON report files per surface, no screenshots)
  cat10-email/
    mail-doc-evidence.json
```

Minimum target: **80 screenshots** (brief requirement). Estimated capture: ~100-120.

---

## Per-category test inventory

### Category 1 — Authentication & session integrity (~10 tests)

| ID | Test | Assertion |
|---|---|---|
| T1.01 | Login as `bm-001` via UI | Auth state: `role=branch_manager`, `tenantId=tatillife_south`, `branchId` present |
| T1.02 | Login as `um-001` via UI | Auth state: `role=unit_manager`, `tenantId=tatillife_south`, `unitId` present |
| T1.03 | Login as `agent-001` via UI | Auth state: `role=agent`, `tenantId=tatillife_south` |
| T1.04 | Sign out as BM → sign in as Agent | No BM UI elements visible after agent login; no tenantId/branchId mismatch in console |
| T1.05 | Login → page reload mid-session | Auth state restored; dashboard renders without re-authentication |
| T1.06 | Login as agent → navigate all agent tabs → no console auth errors | Zero console errors with text "permission-denied" or "tenantId" during full navigation |
| T1.07 | Login as UM → navigate all manager tabs → no console auth errors | Same as above for manager role |
| T1.08 | Login with wrong password | Error message rendered; no crash |
| T1.09 | Custom token path (Admin SDK → custom token → UI verify) | Admin SDK creates custom token for `bm-001`; verify it mints without error |
| T1.10 | Sign out → attempt direct navigation to dashboard | Redirected to login screen |

**Estimated time:** 10 minutes

---

### Category 2 — Per-role surface coverage (~52 tests)

#### 2A — Agent surfaces (~14 tests, using `agent-001`)

| ID | Test | Assertion |
|---|---|---|
| T2A.01 | AgentDashboard KPI tiles | API total, Apps total, Persistency % rendered; values match seeded 4-week data |
| T2A.02 | Weekly Wizard — open new submission | Step 1 screen loads; agent info pre-populated |
| T2A.03 | Wizard — navigate all 5 screens | Back/Next functional; no JS errors; Step 5 Summary renders |
| T2A.04 | Wizard — draft auto-save | Fill field, wait 1.5s, reload page; draft values persist |
| T2A.05 | Wizard — submit flow | Submit button → submission appears in History tab |
| T2A.06 | Wizard — validation blocked | Attempt Next with empty required field → error displayed |
| T2A.07 | Career Portal | Goal tracking panel, Commission Playground, club tier all render |
| T2A.08 | Awards tab | Badge grid renders; no JS errors |
| T2A.09 | History tab | Past submissions listed (expect 4 weeks of seeded data); eye icon opens preview |
| T2A.10 | Profile — render and logging mode toggle | Weekly → Hybrid → Daily toggle cycles; preference persists on reload |
| T2A.11 | Leaderboard | Renders with agent ranking; test agents visible |
| T2A.12 | Production Report tab | Renders without JS errors |
| T2A.13 | Mobile viewport — all agent tabs | Screenshot each tab at 390×844; nav accessible; no overflow |
| T2A.14 | Dark mode — AgentDashboard | Toggle dark mode; dashboard re-renders; no white-flash or broken layout |

#### 2B — Unit Manager surfaces (~10 tests, using `um-001`)

| ID | Test | Assertion |
|---|---|---|
| T2B.01 | ManagerDashboard Overview | Overview tab loads; unit-scoped agent list |
| T2B.02 | Team tab | Agents 001-004 (UM_001 unit) visible; agents 005-007 NOT visible |
| T2B.03 | Master Sheet | 4 agents shown (UM-scoped); columns sortable; no cross-unit agents |
| T2B.04 | Campaigns tab | "Test Campaign Q2" visible |
| T2B.05 | Persistency tab | 3 months of seeded data for 4 agents visible; entry form if UM has write access |
| T2B.06 | Goals tab | Gap analysis renders; cannot edit Company Floor |
| T2B.07 | Settlements tab | Read-only (UM cannot confirm settlements) |
| T2B.08 | Meeting Mode | Meeting mode presentation accessible and renders agent cards |
| T2B.09 | Awards tab (manager view) | AgentAwardsPanel renders for UM scope |
| T2B.10 | Mobile viewport | Overview + Team + Master Sheet at 390×844 |

#### 2C — Branch Manager surfaces (~14 tests, using `bm-001`)

| ID | Test | Assertion |
|---|---|---|
| T2C.01 | ManagerDashboard Overview | All 7 test agents in view (cross-unit) |
| T2C.02 | Master Sheet | All 7 test agents; filterable by unit |
| T2C.03 | Settlements entry | Enter a settlement for agent-001; verify Awards Tracker switches to "Confirmed" |
| T2C.04 | Persistency entry | Enter persistency for agent-002; verify display update on reload |
| T2C.05 | Campaign creation | Create campaign → activate → verify agents see notification |
| T2C.06 | User management — create user | Create single user via UI; verify emailQueued feedback |
| T2C.07 | User management — edit user (PR-4 flow) | Edit test user name; save; verify updated |
| T2C.08 | User management — deactivate user | Deactivate agent-007; verify active:false in Firestore |
| T2C.09 | Branch CSV export | Download CSV; verify header row structure and agent count |
| T2C.10 | Goals — all 5 layers | Branch Target entry; Unit Target entry; verify floor read-only for BM |
| T2C.11 | Agent of Month tab | AOM tab renders; BM can nominate |
| T2C.12 | Kiosk tab | Token generation modal; generate token; verify kiosk URL structure |
| T2C.13 | Kiosk — revoke token | Revoke generated token; verify token no longer valid |
| T2C.14 | Mobile viewport | Overview + Team + Master Sheet at 390×844 |

#### 2D — Tenant Admin surfaces (~10 tests, using `A11Y_TENANT_ADMIN_EMAIL`)

| ID | Test | Assertion |
|---|---|---|
| T2D.01 | TenantAdminDashboard | Renders correctly; tabs accessible |
| T2D.02 | All Users tab | Full user list; all 10 test users visible |
| T2D.03 | BulkImportUsersModal — re-test C2 flow | Upload 3-row CSV → preview → confirm → verify Step 3/4 copy + emailQueued |
| T2D.04 | BulkImportGoalsModal — re-test C3 flow | Upload goals CSV → import → verify goals written |
| T2D.05 | Branches tab | Create branch → edit → deactivate → reactivate cycle |
| T2D.06 | Company Config | Company Floor entry for API + Apps; verify agents see floor in goals |
| T2D.07 | Campaigns tab | Campaign panel accessible; can create campaign as TA |
| T2D.08 | Profile tab | ProfileScreen renders |
| T2D.09 | Kiosk token management (if TA has access) | Generate kiosk token; verify URL; revoke |
| T2D.10 | Mobile viewport | Dashboard + Users at 390×844 |

#### 2E — Platform Admin (~4 tests, no test user — using real PA account if available)

| ID | Test | Assertion |
|---|---|---|
| T2E.01 | Platform Admin stub screen | Renders PlatformAdminStubScreen ("Cross-tenant platform admin features") without crash |
| T2E.02 | Sign out from stub | Sign Out button works |
| T2E.03 | API capability — custom token cross-tenant | Admin SDK: mint custom token for `bm-001`; verify tenant claim is `tatillife_south` |
| T2E.04 | Cross-tenant denial | Attempt Firestore read of different tenant doc as `tatillife_south` user → assert permission-denied |

*Note: No PA login credentials in `.env.local`. Tests T2E.01-02 will be skipped unless PA creds are available; T2E.03-04 use Admin SDK and don't require a PA UI session.*

**Estimated time, Category 2:** 90 minutes total

---

### Category 3 — Permission boundary matrix (~24 tests)

All tests use Firebase client SDK authenticated via custom token (Admin SDK mints token → client SDK signs in → attempt REST operation → assert result).

| ID | Acting role | Operation | Should | Collection / path |
|---|---|---|---|---|
| T3.01 | Agent (agent-002) | Read another agent's submission | DENY | `/tenants/tatillife_south/submissions/{agent-001-doc}` |
| T3.02 | Agent | Write own `role` field | DENY | `/tenants/tatillife_south/users/{agent-001}` |
| T3.03 | Agent | Write to settlements | DENY | `/tenants/tatillife_south/settlements/*` |
| T3.04 | Agent | Write persistency | DENY | `/tenants/tatillife_south/persistency/*` |
| T3.05 | Agent | Read another tenant's users | DENY | `/tenants/tatillife_north/users/*` (if exists) |
| T3.06 | Unit Manager (um-001) | Read agent-005's submissions (different unit) | DENY | `/tenants/tatillife_south/submissions/{agent-005-doc}` |
| T3.07 | Unit Manager | Write to settlements | DENY | `/tenants/tatillife_south/settlements/*` |
| T3.08 | Unit Manager | Create a user doc | DENY | `/tenants/tatillife_south/users/new-doc` |
| T3.09 | Unit Manager | Read agents in UM_002 unit | DENY | `/tenants/tatillife_south/users?unitId=UM_002_UID` |
| T3.10 | Branch Manager | Read another branch's agents (if multi-branch) | DENY | (skip if only one branch) |
| T3.11 | Branch Manager | Write to `config/companyMinimums` | DENY | `/tenants/tatillife_south/config/companyMinimums` |
| T3.12 | Tenant Admin | Read `/tenants/other-tenant/users/*` | DENY | `/tenants/tatillife_north/*` (cross-tenant) |
| T3.13 | Signed-out | Read any submission | DENY | `/tenants/tatillife_south/submissions/*` |
| T3.14 | Signed-out | Read any user doc | DENY | `/tenants/tatillife_south/users/*` |
| T3.15 | Agent | Read own submission | ALLOW | `/tenants/tatillife_south/submissions/{own-doc}` |
| T3.16 | Agent | Write own submission (new doc) | ALLOW | `/tenants/tatillife_south/submissions/*` |
| T3.17 | Unit Manager | Read unit's agents' submissions | ALLOW | `/tenants/tatillife_south/submissions?agentId=agent-001` |
| T3.18 | Branch Manager | Write persistency | ALLOW | `/tenants/tatillife_south/persistency/*` |
| T3.19 | Branch Manager | Write settlements | ALLOW | `/tenants/tatillife_south/settlements/*` |
| T3.20 | Tenant Admin | Read all users in tenant | ALLOW | `/tenants/tatillife_south/users/*` |
| T3.21 | Tenant Admin | Write `config/companyMinimums` | ALLOW | `/tenants/tatillife_south/config/companyMinimums` |
| T3.22 | Agent | Read leaderboard | ALLOW | `/tenants/tatillife_south/leaderboard/*` |
| T3.23 | Agent | Write leaderboard | DENY | `/tenants/tatillife_south/leaderboard/*` |
| T3.24 | Agent | Read notifications (own only) | ALLOW | `/tenants/tatillife_south/notifications?recipientId=agent-001` |

**Estimated time:** 25 minutes

---

### Category 4 — Form validation completeness (~16 tests)

All UI-driven via Playwright.

| ID | Surface | Test | Expected |
|---|---|---|---|
| T4.01 | Wizard Step 1 | Submit without Week Starting date | Error: "Required" or similar |
| T4.02 | Wizard Step 1 | Non-Sunday date in Week Starting | Error: date must be Sunday |
| T4.03 | Wizard numeric fields | Enter alphabetic text in API income field | Rejected / cleared |
| T4.04 | Wizard numeric fields | Enter negative number | Rejected or validation error |
| T4.05 | Create User (BM/TA) | Email malformed | Error: invalid email |
| T4.06 | Create User | Required name field empty | Error |
| T4.07 | Create User | Duplicate email (existing user) | Error from Cloud Function |
| T4.08 | Commission Playground | Negative API input | Rejected or zero-clamped |
| T4.09 | Goals entry | Zero or negative target below floor | Error: below company minimum |
| T4.10 | Persistency entry (manager) | Value > 100 | Error |
| T4.11 | Persistency entry | Non-numeric value | Rejected |
| T4.12 | Settlement entry | Future date | (observe behavior — flag if not rejected) |
| T4.13 | Wizard Step 5 | Submit with incomplete data from prior step | Blocked; user returned to error step |
| T4.14 | Daily input modal | Switch logging mode with unsaved data | Confirmation dialog before mode switch |
| T4.15 | BulkImport CSV | Malformed CSV (wrong column count) | Preview shows error rows; import fails gracefully |
| T4.16 | BulkImport CSV | Duplicate email in CSV | Error row in preview; other rows proceed |

**Estimated time:** 30 minutes

---

### Category 5 — Edge cases & boundary values (~10 tests)

| ID | Test | Setup | Expected |
|---|---|---|---|
| T5.01 | Agent with zero submission history | Use `agent-007` before submitting (freshly seeded, may have 0 manual submissions) | Dashboard renders gracefully; no NaN or crash |
| T5.02 | Agent at award threshold — Apps | Seed agent-003 with exactly 49 apps total | Centurion progress shows 49/100 or 49/50 depending on threshold |
| T5.03 | Persistency exactly at 90% | Seed agent-004 with 90.0 persistency | Award eligibility met; badge visible |
| T5.04 | Settlement on quarter boundary (Q4→Q1) | Enter settlement with date Dec 31 | Verify Q4 assignment; no off-by-one |
| T5.05 | Settlement on Jan 1 | Enter settlement with date Jan 1 | Verify Q1 assignment |
| T5.06 | Agent with 4 weeks of submissions (post-seed) | agent-001 has 4 seeded weeks | KPI sparkline renders 4 data points; week-over-week strip correct |
| T5.07 | Empty campaign (no participants) | Create campaign with 0 agents enrolled | Empty state rendered gracefully |
| T5.08 | Concurrent submission attempt | Two Playwright contexts for agent-001, both open wizard | Last-write-wins observed; no crash |
| T5.09 | BM dashboard with all agents' data | bm-001 views master sheet with all 7 agents | All 7 rows; pagination (if any) works |
| T5.10 | TA bulk import intentional failure row | CSV row with email that triggers mail send failure | Row marked failed; `emailQueued: false` returned; other rows succeed |

**Estimated time:** 25 minutes

---

### Category 6 — Cross-role data flow (~8 tests)

| ID | Test | Flow | Expected |
|---|---|---|---|
| T6.01 | Campaign notification delivery | BM creates campaign → agent-001 logs in → checks notification drawer | Campaign notification present within 10s |
| T6.02 | Submission → leaderboard update | Agent submits → BM checks leaderboard | (Timing-dependent CF; observe state; flag if stale) |
| T6.03 | Settlement → awards tracker | BM confirms settlement → agent-001 checks Awards tab | Estimated → Confirmed transition visible |
| T6.04 | Persistency entry → agent view | BM enters persistency for agent-002 → agent-002 checks Persistency tab | Updated % visible |
| T6.05 | Goal entry → gap analysis | BM enters branch goal → agent-001 checks Career Portal gap analysis | New branch target reflected |
| T6.06 | User deactivation → login attempt | BM deactivates agent-007 → attempt login as agent-007 | Login fails with appropriate error |
| T6.07 | Company Floor change → agent goal validation | TA raises Company Floor → agent-001 tries to set goal below new floor | Validation rejects below-floor goal |
| T6.08 | E6 daily entries → weekly aggregation | Write daily activity entries via Admin SDK for agent-003 → check weekly draft aggregation | Weekly draft shows summed values (Admin SDK simulation, not cron) |

**Estimated time:** 35 minutes

---

### Category 7 — A11y compliance (~18 axe-core sweeps)

Uses `@axe-core/playwright` (same as `scripts/a11y-axe-scan.cjs`). Sweeps each primary surface in light mode (desktop). Dark mode sweeps for 3 high-risk surfaces.

| ID | Surface | Role | Mode |
|---|---|---|---|
| T7.01 | Login screen | — | light |
| T7.02 | AgentDashboard | agent-001 | light |
| T7.03 | AgentDashboard | agent-001 | dark |
| T7.04 | Career Portal | agent-001 | light |
| T7.05 | Wizard (Step 1) | agent-001 | light |
| T7.06 | History | agent-001 | light |
| T7.07 | Profile | agent-001 | light |
| T7.08 | Leaderboard | agent-001 | light |
| T7.09 | ManagerDashboard Overview | bm-001 | light |
| T7.10 | ManagerDashboard Overview | bm-001 | dark |
| T7.11 | Master Sheet | bm-001 | light |
| T7.12 | Campaigns | bm-001 | light |
| T7.13 | Goals | bm-001 | light |
| T7.14 | TenantAdminDashboard | tenant-admin | light |
| T7.15 | TenantAdminDashboard | tenant-admin | dark |
| T7.16 | All Users (UserManagementPanel) | tenant-admin | light |
| T7.17 | Branches | tenant-admin | light |
| T7.18 | Platform Admin stub | — | light |

Output: per-surface axe JSON + aggregated violation counts by severity (critical/serious/moderate/minor).

**Estimated time:** 45 minutes

---

### Category 8 — Screenshot dossier (~100-120 screenshots)

Structured capture (not assertions). Four variations per surface: light+desktop, light+mobile, dark+desktop, dark+mobile.

| Role | Surfaces captured | Approx screenshots |
|---|---|---|
| Agent (agent-001) | 8 tabs × 4 variants | 32 |
| Unit Manager (um-001) | 8 tabs × 4 variants | 32 |
| Branch Manager (bm-001) | 8 key tabs × 4 variants | 32 |
| Tenant Admin | 4 key tabs × 4 variants | 16 |
| Platform Admin stub | 1 × 2 variants | 2 |
| Form/edge screenshots | From Categories 4-6 | ~10 |

**Total target: ~124 screenshots** (exceeds 80 minimum).

**Estimated time:** 60 minutes (can run concurrently with Category 7)

---

### Category 9 — SEC-9b implicit verification (embedded, ~6 checks)

These checks are woven into the Category 2-6 execution — not a standalone script. The orchestrator checks for these signals during all categories:

| ID | Check |
|---|---|
| T9.01 | Zero console errors containing "tenantId" during any Playwright walk |
| T9.02 | All Firestore writes during Category 2 carry correct `tenantId` field (Admin SDK spot-check after each write-heavy test) |
| T9.03 | No "Uncaught TypeError: cannot read tenantId of undefined" errors in any category |
| T9.04 | Cross-tenant denial works after SEC-9b (T3.12, T3.13, T3.05) |
| T9.05 | Custom token auth still mints correctly (T1.09, T2E.03) |
| T9.06 | All existing tests still pass post-shakedown run (npm test after Phase 4) |

---

### Category 10 — Email infrastructure verification (~6 tests)

| ID | Test | Method | Expected |
|---|---|---|---|
| T10.01 | Create user via UI → mail/ doc written | BM creates user via TA UI | `mail/` collection receives doc within 5s |
| T10.02 | `emailQueued: true` when mail/ write succeeds | Observe createUser Cloud Function return | `emailQueued: true` in UI feedback |
| T10.03 | `emailQueued: false + emailError` on mail failure | Admin SDK: write a mal-formed mail/ doc → observe trigger | Delivery error captured in doc |
| T10.04 | mail/ doc delivery.state progression | Poll for 60s after T10.01 | state transitions: PENDING → SUCCESS (or ERROR) |
| T10.05 | Bulk import 3-row CSV → 3 mail/ docs | Re-test C2 BulkImport path | 3 mail/ docs written; all reach terminal state within 90s |
| T10.06 | Sunday nudge mail/ doc write (Admin SDK simulation) | Write nudge doc via Admin SDK | Extension picks up doc; delivery.state → SUCCESS within 90s |

**Estimated time:** 20 minutes (includes mail polling waits)

---

## Estimated runtime per category

| Category | Tests | Est. time |
|---|---|---|
| Cat 1: Auth | 10 | 10 min |
| Cat 2: Role surfaces | 52 | 90 min |
| Cat 3: Permission matrix | 24 | 25 min |
| Cat 4: Form validation | 16 | 30 min |
| Cat 5: Edge cases | 10 | 25 min |
| Cat 6: Cross-role flows | 8 | 35 min |
| Cat 7: A11y | 18 sweeps | 45 min |
| Cat 8: Screenshot dossier | 120 shots | 60 min |
| Cat 9: SEC-9b (embedded) | 6 | 0 min extra |
| Cat 10: Email infra | 6 | 20 min |
| **Total** | **~150 assertions + 120 screenshots** | **~6 hrs** |

Plus seeding (~15 min) and cleanup (~15 min) = **~6.5 hours total**. Within the 10-hour hard ceiling.

**Hard stops** (from brief): any single category > 90 min → checkpoint. Cat 2 is the risk category; 90 min is exactly its budget.

---

## Parallelization opportunities

Sequential by default (brief design). Safe-to-parallel if runtime budget tightens:
- Cat 7 (A11y) and Cat 8 (Screenshots): These both just read UI — they could run in parallel browser contexts. Kept sequential for simplicity unless the run is running behind schedule.
- Cat 9 is embedded — no parallel consideration.
- All others have inter-category dependencies (seeds must exist, some tests modify state).

---

## File inventory — scripts CC will create

| Path | Purpose |
|---|---|
| `scripts/verification/shakedown/auth-helpers.mjs` | loginAsViaUI, loginAsViaCustomToken, TEST_USERS, env loader |
| `scripts/verification/shakedown/seed-phase.mjs` | Phase 3 orchestration — generates CSVs, seeds via Admin SDK, verifies counts |
| `scripts/verification/shakedown/cat01-auth.mjs` | Category 1 tests |
| `scripts/verification/shakedown/cat02-role-agent.mjs` | Category 2A agent surface walk |
| `scripts/verification/shakedown/cat02-role-unit-manager.mjs` | Category 2B UM surface walk |
| `scripts/verification/shakedown/cat02-role-branch-manager.mjs` | Category 2C BM surface walk |
| `scripts/verification/shakedown/cat02-role-tenant-admin.mjs` | Category 2D TA surface walk |
| `scripts/verification/shakedown/cat02-role-platform-admin.mjs` | Category 2E PA stub verification |
| `scripts/verification/shakedown/cat03-permission-matrix.mjs` | Category 3 permission boundary tests |
| `scripts/verification/shakedown/cat04-form-validation.mjs` | Category 4 form validation tests |
| `scripts/verification/shakedown/cat05-edge-cases.mjs` | Category 5 boundary value tests |
| `scripts/verification/shakedown/cat06-cross-role-flows.mjs` | Category 6 cross-role data flow |
| `scripts/verification/shakedown/cat07-a11y.mjs` | Category 7 axe-core sweeps |
| `scripts/verification/shakedown/cat08-screenshot-dossier.mjs` | Category 8 structured visual capture |
| `scripts/verification/shakedown/cat10-email-infra.mjs` | Category 10 email infrastructure |
| `scripts/verification/shakedown/run-all.mjs` | Orchestrator — sequential execution, JSON result aggregation |
| `docs/shakedown-findings-2026-05-13.md` | Phase 5 deliverable — findings report |

---

## Deviations from brief requiring acknowledgement

1. **Platform Admin UI is a stub.** `App.jsx` shows `PlatformAdminStubScreen` for `platform_admin` — the brief anticipated "if cross-tenant UI isn't shipped, just verify the API capability exists." Plan treats Category 2E accordingly. **No change to plan needed, just noting.**

2. **No Platform Admin test credentials in `.env.local`.** Category 2E UI tests (T2E.01-02) will be skipped. API capability tests (T2E.03-04) use Admin SDK and don't need PA creds. **Recommend:** if you have a `platform_admin` login, add `A11Y_PLATFORM_ADMIN_EMAIL` / `A11Y_PLATFORM_ADMIN_PASSWORD` to `.env.local` before Phase 2.

3. **607 tests pass (brief said 608+).** The 1-test gap is not a hard stop. Running the shakedown regardless. **Recommend:** confirm if a test was intentionally removed in SEC-9b or if this is a brief estimation error.

4. **24 additional lint warnings from SEC-9b.** Components receiving explicit `tenantId` via props now have `react-hooks/exhaustive-deps` warnings (the hooks' dep arrays don't include `tenantId`). Not a hard stop (lint exits 0), but suggests a follow-up lint sweep after the pilot. **No plan change needed; will bank in FOLLOW_UPS.md.**

5. **Stale worktrees in `.claude/worktrees/`.** Six old worktrees are still on disk, each contributing 2 lint warnings. These can be deleted post-shakedown. **No plan change needed; noting for cleanup.**

---

## Next step

**Phase 2 begins on Kyron's acknowledgement.** Script implementation starts with `auth-helpers.mjs` and `seed-phase.mjs`, followed by category scripts, then `run-all.mjs`.
