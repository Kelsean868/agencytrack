# AgencyTrack — CONTEXT.md

> **What this is:** Living project state. Read by Claude Code at the start of every session. Captures locked decisions, active follow-ups, and where we left off.
>
> **What this is not:** A replacement for `CLAUDE.md`. CLAUDE.md is the static rulebook (code style, domain rules, design system, stack). CONTEXT.md is the dynamic state. **Where they conflict, CONTEXT.md wins — it's newer.**
>
> **Maintenance:** Update at the end of each session. Anything you'd otherwise have to re-explain in a kickoff prompt belongs here.
>
> **Size caps (enforced per Rule 16):** `Recently shipped` ≤ 5 rows · `Last updated` / `Where we left off` / `Current main HEAD` / `Active track` each ≤ 3 entries. Overflow → `docs/CONTEXT-history.md`.

---

## Current state — top of file for fast reading

| Field | Value |
|---|---|
| Last updated | **PR #TBD (`{TBD}`) — feat(admin): Branches table — total users per branch + role breakdown (HUMAN-MERGE; 2026-06-19).** `BranchesPanel` per-row count drops the `role==='agent'` filter → **total active users with `branchId === branch.id`** (all roles), with a compact per-role breakdown line (`2 agents, 1 UM, 1 BM, 1 SM`); column header `Agents → Users`; `data-testid="branch-user-count-{id}"`. Pure client display over the already-loaded `getAllUsers` — no new query, no rules change. GATE PASS: `doCreateUser` stamps `branchId` on every role (managers included), so the branchId-keyed total captures the assigned BM. lint 0; client 3335/3335 Vitest (+4 BranchesPanel cases); build clean; smoke [TBD]. **Prior:** **PR #692 (`25535d4`) — feat(daily): DCv2 Phase 5 — manager days-worked + weekend marker (HUMAN-MERGE; 2026-06-19).** Aggregator twins emit `daysWorked`/`weekendWorked`/`weekendApi`; `extractFields` null-preserving; `MasterSheet` 3 columns adjacent to API. GATE 1+2 PASS. ⚠️ functions deploy required (cron). smoke 28/28 both themes. **Prior:** **PR #691 (`403247e`) — feat(daily): Phase 4 — Sun–Sat 7-cell strip (Sunday back-fill) (HUMAN-MERGE; 2026-06-19).** Sunday 7th cell, `isOff=true`, back-fill via `saveDailyEntry`; no aggregator/rules change. smoke 31/31. |
| Current main HEAD | `{TBD}` (PR #TBD feat(admin): Branches table — total users per branch, HUMAN-MERGE). **Prior:** `25535d4` (PR #692 feat(daily): DCv2 Phase 5 — manager days-worked + weekend marker, HUMAN-MERGE). **Prior:** `403247e` (PR #691 feat(daily): Phase 4 — Sun–Sat 7-cell strip, HUMAN-MERGE). |
| Active track | **Branches table — total users per branch + role breakdown. BUILD COMPLETE, HOLD for human review (PR #TBD, `{TBD}`, HUMAN-MERGE, 2026-06-19).** `BranchesPanel` count = total active users by `branchId` (all roles, role filter dropped) + compact breakdown; header `Agents → Users`. Pure client display; no new query/rules. lint 0; client 3335/3335 (+4); build clean; smoke [TBD]. **Prior (DCv2 Phase 5): COMPLETE (PR #692, `25535d4`, 2026-06-19) — ⚠️ `firebase deploy --only functions` still required (cron twin touched).** Aggregator twins emit `daysWorked`/`weekendWorked`/`weekendApi`; `MasterSheet` 3 columns adjacent to API. smoke 28/28. **Prior (Phase 4): COMPLETE (PR #691, `403247e`, 2026-06-19).** Sunday 7-cell back-fill; smoke 31/31. |
| Next track | **Daily Capture v2 Phase 5 build complete (manager days-worked + weekend, PR #692); Phase 4 + Phase 3 series also complete.** No further DCv2 phases queued — next track dispatcher-assigned (pilot prep / SEC-9b per CLAUDE.md § Current Phase). ~~submission-branchid Slice 2 — SHIPPED (PR #655).~~ ~~Onboarding Wizard Slice C — SHIPPED (PR #648).~~ HIGH FU: manager tenure-confirmation surface (banked PR #649). **Task #7:** Functions S3b — persistency nudge CF + leaderboardAggregate crash fix (BUILD-AND-HOLD; brief must land on `origin/main` per Rule 10 before dispatch). **Task #7:** Functions S3b — persistency nudge CF + leaderboardAggregate crash fix (BUILD-AND-HOLD; brief must land on `origin/main` per Rule 10 before dispatch). Queue 3 (Goals v3 recon — PR #621, HOLD — Kyron product calls). Queues 5/7/8/11 BUILD-AND-HOLD pending dispatcher. **Producing-manager LOW FU (banked from PR #631 smoke):** BM self-edit drawer toggle (positive UI case) not exercisable via A11Y test env — A11Y BM has empty roster + BM's own entry not in team panel. Verified via: emulator rules 5/5 PASS + leg-1 REST write PASS + leg-9 SM-no-toggle PASS + code review. Manual verify when a BM account with managed users is available. **Gemini FUs from this batch (LOW):** PR #619 — focus-trap always-mounted pattern in `RecommendLockDrawer` (hook may not engage on open; needs mount/unmount rework); PR #619 smoke — extra unused browser page + hardcoded empty capture report; PR #628 — consider `dark:text-surface` vs `dark:text-[--color-bg]` (verify equivalence in tailwind.config.js). **Prior:** Goals Slice 2 hardening follow-up items (handleDrawerSave silent-error gap, axe on drawer, dark-mode smoke — all addressed in PR #619 except focus-trap always-mounted pattern). **Prior:** Money Needs default-items verification (HOLD). |
| Queued | F2.2 (email-to-BM on joint-call submit); `needCovered` taxonomy confirmation (Track H/G); BOA-teardown FU (backfill + rule cleanup). True telephone-contacts wizard field; manager-side floor adherence roll-up (Track F adjacency). Peer-BM branch-scoped exclusion (agentBranchId denormalization — heavier FU). LOW housekeeping FU from #244: CLAUDE.md "lint + build" → "lint + test + build" doc drift (global-stub FU now RESOLVED by #264). ~~isProducingManager setter RESOLVED~~ **isProducingManager panel + script RETIRED (Slice 2.2, PR #639)** — `personalApi`/`personalApps` fields and `isProducingManager` gate removed from `ManagerWarTab`/`managerWarService`/`ManagerWarDetail`; `set-producing-manager.mjs` deleted. No setter needed; concept retired. Track D parity expansion + BM at-risk view deferred (D2+). |
| Two-strike counter | 0/3 — clean. |
| Stash pending | No |

---

## Locked decisions — do not re-litigate

These are settled across all future sessions. If a session audit surfaces a reason to revisit, treat as a **surprise-stop** — surface in chat, do not unilaterally override.

### Onboarding identity — write-once + pilot relaxation (Slice A, 2026-06-15)

- **Write-once on `agentNumber` / `dateOfBirth`:** an agent may set these fields once (when null/absent at write time); locked after; `canManage` corrects via the existing manager update arm. This is a **pilot relaxation** of the manager-only account-creation norm — deliberate and reversible.
- **Reversibility:** the write-once owner arm in `firestore.rules` can be removed post-pilot with zero wizard changes. Manager correction (`canManage` arm) already exists and is unchanged.
- **`onboardingComplete` is NOT write-once:** the owner may set or clear it; a manager may also reset it (re-triggers the wizard on next login).
- **No real-time collision check in v1:** Uniqueness is manager-review-reconciled; a CF-based check is banked as a MEDIUM follow-up (FOLLOW_UPS.md § Onboarding identity).

### Onboarding tenure — `contractStartDate` / `monthsAtTatil` / `monthsInIndustry` write-once (Slice 1, PR #649 `abd1236`)

- **Three fields added to owner write-once arm and manager correction arm:** `contractStartDate` (YYYY-MM-DD string), `monthsAtTatil` (int ≥ 0), `monthsInIndustry` (int ≥ 0). Same pilot-relaxation rationale as `agentNumber`/`dateOfBirth` — managers are slow to provide this data; agents self-enter during onboarding.
- **REUSE `contractStartDate` — NOT a new field:** `doCreateUser` CF stamps `contractStartDate = ''` on all agent docs at creation. The owner write-once guard uses an empty-string check (`resource.data.get('contractStartDate', '') == ''`) which fires correctly for both CF-stamped `''` and absent (no-CF path). 15+ read sites across tenureFloors.js, awardsEngine, yearPlanProjection, AwardProjectionStrip, YearPlanModal, AgentReportDocument — the field is authoritative.
- **Stakes are higher than DOB:** `monthsAtTatil` feeds `newBsAward` eligibility (`≤ 18`); `monthsInIndustry` feeds `rookieAward` eligibility (`≤ 18`). A wrong value shifts tenure band → career floor + award eligibility.
- **`monthsAtTatil` / `monthsInIndustry` guards use `is int AND >= 0`:** rejects floats (14.5) and negatives (-1). Stored at save time (Slice 2); manager-confirm FU is the correction path.
- **`monthsInIndustry` stored at save time (Slice 2):** derived from `contractStartDate` for "Tatil is first company" agents; agent-entered (validated ≥ Tatil tenure, sanity-capped) for experienced agents. Boundary aligned to `≤ 18` eligible guard.
- **32/32 emulator tests PASS** (17 new tenure cases + 15 original identity cases) — `tests/rules/users-onboarding.rules.test.mjs`.
- **Manager-confirm FU:** near-term surface for managers to confirm/correct self-entered tenure — see FOLLOW_UPS.md § Onboarding tenure manager confirmation.

### App host — single-source two-constant invariant (PR #672 `82314e3`)

- **Canonical app host is `https://portal.agencytrack.app`.** Held by exactly **two functional-source constants:** `src/constants/brand.js` `APP_URL` (frontend) and `functions/lib/config.js` `APP_URL` (backend). Keep them in sync (each file carries the sync comment).
- **No other functional file may contain a literal app host.** `src/services/authService.js` (email-change continueUrl) and `src/components/kiosk/KioskModeTab.jsx` (`KIOSK_BASE`) import `APP_URL` from `constants/brand`. Backend consumers (invite/reset continueUrls, compliance-nudge `appUrl`, kiosk-token base) read `APP_URL` from `functions/lib/config.js`.
- **Known exception:** `functions/scripts/seed-platform-admin.cjs` is an operator-run bootstrap script and retains its own literal (out of scope per the migration brief's `scripts/` carve-out). Not runtime; not part of the invariant.
- **MERGE-gated:** merging deploys the portal URLs to the frontend immediately (Vercel). Portal must be live + Firebase-authorized before merge; functions deploy follows merge. Falsification: the invariant is overturned if a grep finds any other functional-source app-host literal — surface, do not bank.
### Smoke tenant isolation — `tatillife_smoke` is the canonical A11Y tenant (PR #674 `3730035`)

- **All A11Y smoke accounts live in `tatillife_smoke`, never in `tatillife_south`.** Accounts in `tatillife_south` were deleted because they polluted production leaderboards and roll-ups.
- **Provisioned by `functions/scripts/seed-smoke-tenant.cjs --apply`** (idempotent; re-runnable to sync passwords or reset docs). Requires `.env.local` `A11Y_*` credentials + `functions/service-account-key.json`.
- **Six role tiers:** agent · unit_manager · branch_manager · sales_manager · tenant_admin · platform_admin (optional — skipped gracefully if `A11Y_PLATFORM_ADMIN_EMAIL` absent). Branch id = `smoke_branch`.
- **Leaderboard isolation:** `recomputeLeaderboardScheduled` is `TENANT_ID='tatillife_south'`-bound (`functions/index.js:42`). Smoke tenant leaderboard data requires an explicit `recomputeLeaderboardOnDemand({tenantId:'tatillife_smoke'})` call; leaderboard-dependent smokes are Brief 2 territory.
- **Rules are tenant-generic** — no rules or index changes needed for a new tenant.
- **`isActive` (not `active`) on branch docs** — matches `branchService.js` `where('isActive', '==', true)` query.

### Multi-tenancy (SEC-9, shipped PR #16; holder retired in SEC-9b)

- `tenantId` is sourced from auth claims at runtime and exposed via `useAuth().tenantId` in all React components.
- All services accept `tenantId` as an explicit first parameter — the `getTenantId()` runtime holder in `src/firebase.js` was deleted in SEC-9b (shipped PR #139, `9cbd5a4`).
- `AuthContext` no longer calls `setRuntimeTenantId`; KioskRoute passes `tenantId` to `KioskShell` as a prop.
- ~~One inline `import.meta.env.VITE_TENANT_ID` read remains at the AuthContext bootstrap site only — tracked by SEC-11.~~ **Resolved in PR-2:** bootstrap block deleted, SEC-11 closed.
- `firebase.js` no longer exports `tenantId` as a const, nor the `_tenantId`/`setRuntimeTenantId`/`getTenantId` holder trio.

### ~~User-management hierarchy matrix (next track, plan approved)~~

> **Superseded 2026-05-13.** This locked decision captured the user-management plan as approved before user-mgmt PR-1/PR-2/PR-3 shipped. The plan landed, but the role model changed during execution: **`super_admin` was retired in PR-3** and replaced with the `platform_admin` (cross-tenant) + `tenant_admin` (within-tenant) split. The seed script `scripts/seed-first-super-admin.cjs` was replaced by `functions/scripts/seed-first-tenant-admin.cjs` (+ `seed-platform-admin.cjs` for cross-tenant operators). **For the current hierarchy, creation matrix, and seed scripts, see CLAUDE.md § Roles & Permissions.** The original section text is preserved below (struck through) as historical record.
>
> Test-environment reference for the `platform_admin` (Kyron, UID `4GeeZbhZBwdtGOLoJoggf4MQo142`, Auth email `kyron@tatillife.com`) moved to § Test environment references below.

~~**Hierarchy:**~~
~~```~~
~~Agent → Unit Manager → Branch Manager → Sales Manager → Super Admin (Kyron)~~
~~```~~

~~> **Override of CLAUDE.md:** CLAUDE.md lists 4 roles and notes Sales Manager as "deferred to Phase 9." This is now superseded — Sales Manager ships in this work.~~

~~**Creation matrix:**~~

~~| Creator | Can create |~~
~~|---|---|~~
~~| Super Admin | Sales Manager, Branch Manager, Unit Manager, Agent, **Super Admin** |~~
~~| Sales Manager | Branch Manager, Unit Manager, Agent (NOT other Sales Managers) |~~
~~| Branch Manager | Unit Manager, Agent **within their branch** |~~
~~| Unit Manager | Agent **within their unit** |~~
~~| Agent | (nothing) |~~

~~Rule: no tier creates its own peers, except Super Admin → Super Admin.~~

~~**Schema decisions (Path C):**~~
~~- `branchId: string` on every user doc. Default backfill: `'tatil_south'`.~~
~~- `ownedBranchIds: string[]` on manager docs. `['*']` wildcard for super_admin and sales_manager.~~
~~- Both fields mirrored to Firebase Auth custom claims for cheap rule reads.~~
~~- No `/branches` collection. Enumerated branch list lives at `/tenants/{tid}/meta/branches`.~~
~~- `active: boolean` field for soft-delete. Missing field treated as truthy (active).~~
~~- `/auditSuperAdminCreations/{auto-id}` top-level collection for super_admin creation audit log. (Originally referenced as `/audit/superAdminCreations/{auto-id}` in plan shorthand; flattened to a single segment to satisfy Firestore's even-segment doc-path rule.)~~

~~**Atomicity (memory-locked):**~~
~~- Account creation must write tenantId and branch fields to **both** the user doc **and** the auth custom claim in a single transactional path.~~
~~- Pattern: provisioning-flag saga — `provisioning: true` doc write → set claims → clear flag. On claim-set failure, compensating delete of both auth user and Firestore doc. Reads filter `provisioning != true`.~~

~~**Other locked design decisions:**~~
~~- Single polymorphic `createUser` Cloud Function with `role` parameter (replacing `createAgentAccount`).~~
~~- Super Admin self-creation requires typed-confirmation field — must type `CREATE SUPER ADMIN` verbatim.~~
~~- Audit log writes only on super_admin creation, captures `creatorUid`, `creatorEmail`, `createdUid`, `createdEmail`, `ip`, `userAgent`, `timestamp`, `confirmationGiven`.~~
~~- One email = one role. No dual-role accounts.~~
~~- Functions runtime stays v1 for this work. v2 migration is its own ticket.~~
~~- Refresh-token revocation on deactivation — immediate, with UX modal stating "user will be signed out immediately, unsaved work lost."~~
~~- Bootstrap path in AuthContext deleted in user-mgmt PR-2 (closes SEC-11). Replaced by `scripts/seed-first-super-admin.cjs` for new-tenant provisioning.~~
~~- `SUPER_ADMIN_UID` hardcoded bypass at `functions/index.js:7` removed in PR-2.~~

~~**PR sequencing (3 PRs, sequenced):**~~
~~1. **PR-1** — Schema + atomicity foundation: new fields, backfill migration, dual-write saga, sales_manager role added to rules, `/audit` collection rules. Bypass NOT removed yet (circular dependency).~~
~~2. **PR-2** — Polymorphic `createUser` Cloud Function, audit log writes, bootstrap path deletion, `SUPER_ADMIN_UID` removal, `seed-first-super-admin.cjs` script. `createAgent` retained as thin wrapper for backwards compat.~~
~~3. **PR-3** — UI matrix: filtered dropdowns per tier, typed-confirmation field, deactivate/reactivate UI, `Show deactivated` toggle, `createAgent` wrapper removed.~~

~~**Audit findings surfaced during PR-1 plan (locked):**~~
~~- **Finding 1** — CLAUDE.md "Known Open Items #1" previously claimed `firestore.rules` had a hardcoded super_admin UID bypass. The bypass actually lives in `functions/index.js:7` (referenced at `:65` in `setUserClaims`). Reworded in CLAUDE.md as part of PR-1.~~
~~- **Finding 2** — CLAUDE.md "Known Open Items #8" claimed `firebase.js` used deprecated `enableIndexedDbPersistence`. The migration to `persistentLocalCache` already shipped at some prior point. Item removed from CLAUDE.md in PR-1.~~
~~- **Finding 3 (SEC-12)** — `firestore.rules:118-120` references `request.auth.token.unitId` for the `unit_manager` write path on `/unitGoals`, but `unitId` is never written as a custom claim by `setUserClaims` or `createAgentAccount` (only `role` and `tenantId`). The `unit_manager` branch always evaluates false; only super_admin/branch_manager actually write unitGoals today. Out of scope for PR-1; tracked as SEC-12.~~
~~- **Q5 UID-header precedent** — Production UIDs are committable in code (e.g., migration script header comment, CONTEXT.md test-environment references). Real names are NOT committable. Pattern: `role: <UID>  [name redacted]`. Established as locked precedent in PR-1.~~

### Workflow rules

- **Worktree branches only.** Never push directly to `main`.
- **Squash merges** via GitHub UI only. No auto-merge.
- **Post-merge verification mandatory:** `git fetch origin && git pull origin main && git log origin/main --oneline -5` AND a production walkthrough via `scripts/exploration-walk.cjs`. The pull is required so worktree-local tooling matches production — fetch alone leaves the working tree at pre-merge state and verification scripts may run stale.
- **Production polling retired** (PR #15) — production deploy verification is manual via Vercel dashboard.
- **Verification artifacts stay local** — logs, screenshots, one-off scripts under `verification/` are gitignored by design.

### Test environment references

- **Test agent:** `kelsean@gmail.com` / password in `.env.local` as `A11Y_AGENT_PASSWORD`. UID: `J0j4uBqzTPcfm1IlGCPyDzo27RP2`.
- **Vercel bypass:** token in `.env.local` as `VERCEL_BYPASS_TOKEN`. Usage: `?x-vercel-protection-bypass=<TOKEN>&x-vercel-set-bypass-cookie=true` on first request, sets cookie. **Never echo the value to chat or logs.**
- **Platform admin (production):** Kyron, UID `4GeeZbhZBwdtGOLoJoggf4MQo142`, Auth email `kyron@tatillife.com`. (Was `super_admin` pre-user-mgmt-PR-3; claim migrated to `platform_admin` during PR-3.)

---

## Active follow-ups

> Bubbled-up subset of `docs/FOLLOW_UPS.md` — items likely to be touched in the next 1–2 sessions. Background-risk items (Node 20 deprecation, `firebase-functions` SDK upgrade, SEC-9c, SEC-12, R2–R5 wizard polish, etc.) live in `docs/FOLLOW_UPS.md` only.

| Ticket | Title | Blocking? | Next action |
|---|---|---|---|
| Orphan cleanup | UID `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc with no Auth user | No | Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). |

---

## Recently shipped

| PR | SHA | Description |
|---|---|---|
| [#TBD](https://github.com/Kelsean868/agencytrack/pull/TBD) | `{TBD}` | **feat(admin): Branches table — total users per branch + role breakdown** (HUMAN-MERGE, 2026-06-19). `BranchesPanel` per-row count drops the `role==='agent'` filter → total active users with `branchId === branch.id` (all roles) + compact per-role breakdown line (`2 agents, 1 UM, 1 BM, 1 SM`); column header `Agents → Users`; `data-testid="branch-user-count-{id}"`. Pure client display over already-loaded `getAllUsers` — no new query, no rules change. GATE PASS: `doCreateUser` stamps `branchId` on every role (managers included) so the total captures the assigned BM. lint 0; client 3335/3335 (+4 BranchesPanel cases); build clean; smoke [TBD]. |
| [#692](https://github.com/Kelsean868/agencytrack/pull/692) | `25535d4` | **feat(daily): DCv2 Phase 5 — manager days-worked + weekend marker** (HUMAN-MERGE, 2026-06-19). Both aggregator twins emit `daysWorked` (distinct logged dates), `weekendWorked` (opening-Sun/Sat via noon-UTC anchor), `weekendApi` (weekend-entry `totalProductionCredit` basis) onto the weekly submission. `extractFields` null-preserving (absent → `—`, never 0). `MasterSheet`: three columns adjacent to API (Days Wkd · Weekend `CalendarCheck` info badge · Wknd API) + CSV (`Yes`/`No`/`—`) + a11y + `data-testid`. GATE 1 PASS (no submission `hasOnly`) → no rules change. Functions deploy required post-merge (cron touched). lint 0; client 3339/3339 (+8); functions 279 (+9); build clean; smoke 28/28 both themes. |
| [#691](https://github.com/Kelsean868/agencytrack/pull/691) | `403247e` | **feat(daily): Phase 4 — Sun–Sat 7-cell strip (Sunday back-fill)** (HUMAN-MERGE, 2026-06-19). `deriveWeekStripDays` extended from 6→7 cells; Sunday cell `isOff=true` (off-styled, no nag); saves via `saveDailyEntry` → `weekStarting=itself` → counted by existing aggregator; no aggregator/rules/CF change. 3323/3323 Vitest (+6 new Sunday-cell tests, SAT_IDX 5→6); lint 0; build clean; smoke 31/31 PASS both themes (Leg 4c data-chips delta 0→1; axe NO-NEW). Gemini: OBSOLETE. |
| [#685](https://github.com/Kelsean868/agencytrack/pull/685) | `8307ef8` | **feat(aggregator): Daily Capture v2 Phase 1b — aggregate 13 daily fields + distinct telContacts** (HUMAN-MERGE, 2026-06-18). CJS (`functions/aggregators/dailyToWeekly.js`) + ESM (`src/lib/schema/dailyActivity.aggregator.js`) extended with 13 new field sums. `contactsMade` → `telContacts` cascaded through weeklyActivityFloors + planVariance + weeklyPlanAssembly + SuggestedWeekCard. EXPAND migration run to production; `telContacts` added, `contactsMade` preserved (CONTRACT FU banked). Gemini HIGH (`||` → `??` in `extractFields.js:86`) applied in-PR. 3243/3243 Vitest PASS; lint 0; build clean; 30/30 SDK smoke PASS. |
| [#684](https://github.com/Kelsean868/agencytrack/pull/684) | `19db5a8` | **feat(schema): Daily Capture v2 Phase 1a — daily schema extension (full funnel parity)** (HUMAN-MERGE, 2026-06-18). `src/lib/schema/dailyActivity.js`: 13 new fields + `normalizeDailyEntry` coercion util. No aggregator, no rules, no UI. Lint 0; 3243/3243 Vitest PASS; build clean; 26/26 SDK smoke PASS. |
---

## Phase 7-8 Planned Tracks

Comprehensive design captured in `docs/phase7-8-PRD.md`. Build order and PR breakdown in `docs/phase7-8-implementation.md`.

Recommended sequence: **D → E → G → F → H** (~36–46 PRs total, no track blocks pilot launch).

- **Track D** — Awards Expansion + Ruleset Config Migration. Moves Tatil 2026 constants from `awardsEngine.js` to `config/awardsRuleset/{year}`. Adds agent + UM awards parity expansion and BM at-risk view. ~6–8 PRs.
- **Track E** — Daily Reporting Polish. Per-agent work schedule (working days + T&T holidays + vacation overrides), Floating Action Button for Daily Log, refined 8-field-in-2-sections form structure. Polish atop already-shipped E6 logging mode. ~5–7 PRs.
- **Track F** — Manager Drill-down + Coaching Notes. New `/manager/agent/:agentId` route with agent-mirror dashboard, historic trend visualizations from nightly Cloud Function aggregates, coaching notes private to manager chain. ~8–10 PRs.
- **Track G** — Money Needs Worksheet. T&T-localized 5-expense-group budget with 3 sub-calculators (Insurance Industry, Car Expenses, Loans/Debt), piecewise PAYE config in `config/payeFormula`, privacy defaults with manager-read audit. ~7–9 PRs.
- **Track H** — Policy Ledger MVP. Real-time per-policy entry, state machine (Submitted → Settled → Lapsed terminal), awards engine soft-migrates from settlements via per-agent `usesPolicyLedger` flag. ~10–12 PRs. Depends on Track D.

Five pre-track verification follow-ups (PH7-8-Q1 through Q5) banked in `docs/FOLLOW_UPS.md` LOW tier; resolve in the design pass for each track.

---

## Workshop-Driven Roadmap Revision (2026-05-20)

Source: Tatil Life manager workshop 2026-05-19 (competitor SCG/ApplyOn demo). Canonical: `docs/AgencyTrack_Workshop_Roadmap_Revision.md`.

- **NEW Track I** — Manager Activity Reporting (manager's own WAR + recruitment activity).
- **NEW Track J** — Tenure & Level API Minimums (head-of-sales slide 2026-05-19). J1 shipped in PR #240 (`4134d2c`): tenure-based Company Floor + per-agent weekly API derivation, provisional pending head-of-sales confirmation. J2 (career-level 2-yr-average qualification) + J3 (manager levels 8–10 production model → Track I) deferred.
- **Track J — V2 Redesign** — screen-by-screen port of `design_handoff_v2_app/` mockups (34 hi-fi references, README §4 token bridge). Work order per README §10: App Shell → Agent suite → Manager suite → CRO/back-office → Kiosk/Meeting → System screens → Emails. J1 (App Shell chrome restyle) shipped PR #388 (`63cb0cf`). J2 (Agent Dashboard — Planning/Tools/Recognition nav groups + content deltas) is next.
- **Track F extended** — structured Joint-Call Observation Log + appointment-bound Prospect-Info form (manager-chain privacy, same model as coaching notes).
- **Track H column decision LOCKED** — IN: Source of Prospect (enum), Cash with Application, Date Placed (= `dateIssued`), Policy Delivery Date. OUT: demographics. Need Covered → joint-call form.
- **Small adds** — social/content KPIs (Track E sub-item); Personal Growth/CPD log (Career Portal/Phase 8).
- **Quick wins** — extend `config/companyMinimums` with `weeklyActivityFloors` + Tenant-Admin surface + seed agreed Tatil minimums (60/40/20/15/10/10/1/1/4800/100); relabel dashboards "Expected/Actual".
- **Re-sequence (insider-seat):** Quick wins → Track F (incl. joint-call forms) → Track I → D + E → H → G.
- **Guardrail:** activity/production/coaching only, not a relational CRM; Tatil has no own CRM; future tightly-integrated CRM separately scoped.

Recently-shipped row: `docs(roadmap): workshop-driven roadmap revision (#236)` — SHA `58ebb2c`.

Track J1 row: `feat(goals): tenure-based Company Floor + per-agent weekly API derivation (#240)` — SHA `4134d2c`.

---

## Pending operational state

These don't block anything, but they need to be resolved or carried forward each session.

- **Orphan user** `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc exists but no Auth user. Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). Do not auto-delete; investigate first.
- **Node.js 20 Functions runtime** deprecated 2026-04-30, decommission 2026-10-30 — migration to Node 22 is a separate ticket. Not blocking; CLAUDE.md locks v1 runtime for current track.
- **`firebase-functions` SDK** at 4.9.0 — upgrade to ≥5.1.0 has breaking changes; schedule as own ticket post-pilot.

---

## Where we left off

**Branches table — total users per branch + role breakdown — BUILD COMPLETE, HOLD for human review (PR #TBD, `{TBD}`, HUMAN-MERGE, 2026-06-19).** The Tenant Admin **Branches** table showed "N agents" per branch; it now shows the **total active users** in each branch (all roles) with a compact per-role breakdown. `BranchesPanel` drops the `role==='agent'` filter from its per-row count — the count is now total active users keyed by `branchId` (mirroring the existing active-only semantics), plus a secondary breakdown line (`2 agents, 1 UM, 1 BM, 1 SM`) built from the same already-loaded `getAllUsers` data; column header `Agents → Users`; `data-testid="branch-user-count-{id}"`. **Pure client display — no new query, no rules change, no denormalized counter.** GATE (does the count capture non-agent members incl. the assigned BM?) PASS: `doCreateUser` stamps `branchId` on every user doc regardless of role ([functions/index.js:191](functions/index.js:191)) and the smoke seed stamps it on all 5 tenant-scoped roles, so the branchId-keyed total includes managers. lint 0; client 3335/3335 Vitest (+4 BranchesPanel cases: all-roles total, breakdown order, active-only exclusion, cross-branch isolation); build clean. **Smoke: [TBD]** (both themes, axe no-new; asserts `smoke_branch` total > agent-only count via the testid).

**Prior:** **Daily Capture v2 — Phase 5 (manager days-worked + weekend marker) COMPLETE (PR #692, `25535d4`, HUMAN-MERGE, 2026-06-19) — ⚠️ functions deploy still pending.** Gives a manager two emergent per-agent signals beside the API/target outcome they already see. Both aggregator twins (ESM `src/lib/schema/dailyActivity.aggregator.js` + CJS `functions/aggregators/dailyToWeekly.js`, byte-identical math — GATE 2 PASS, not divergent) now emit three scalars onto the weekly submission, derived in-place from the per-day docs (each carries its own `date`): `daysWorked` = distinct logged dates (mirrors the agent strip's `isLogged: docDates.has(date)` predicate — doc-existence, NOT a new non-empty-value rule, per §11); `weekendWorked` = a logged entry on the opening Sunday (day 0) or Saturday (day 6), day-of-week via the noon-UTC anchor (UTC-4-safe, matches `getSundayOf`); `weekendApi` = the `totalProductionCredit` basis (NB.api + PPP.apiIncrease + LMPS credit) restricted to weekend-day entries. `extractFields` passes the three through null-preserving (absent → `—`, never coerced to 0, so a weekly-mode agent who never logs daily reads `—` not "0 days"). `MasterSheet` renders three columns immediately after the API/target column — **Days Wkd** (number/`—`) · **Weekend** (`CalendarCheck` info badge w/ Nexus primary token + `sr-only` "Worked weekend", `—` otherwise) · **Wknd API** (currency/`—`) — with CSV (`Yes`/`No`/`—`, currency `—`-safe) and `data-testid` hooks (`days-worked-${id}`, `weekend-marker-${id}` with `data-weekend` state). **GATE 1 PASS:** no submission `hasOnly()`/validator — fields are purely additive, no rules change. lint 0; client 3339/3339 Vitest (+8 emergent-signal cases); functions 279 (+9 parallel twin cases); build clean. **Smoke: 28/28 both themes.** Functions deploy (`firebase deploy --only functions`) required post-merge — the cron twin is touched.

**Next:** DCv2 Phases 1a/1b/2/2.1/2.2/3a/3b/4/5 all shipped (#684–#692). ⚠️ Phase 5 needs `firebase deploy --only functions` (cron twin touched) before the cron path emits the new fields. No further DCv2 phases queued — next track dispatcher-assigned (pilot prep / SEC-9b per CLAUDE.md § Current Phase).


---

## How to update this file

At the end of each session, update in this order:

1. **Top table** — bump `Last updated`, `Current main HEAD`, active/next track, two-strike state, stash status.
2. **Recently shipped** — add the merged PR at the top, drop the oldest if the list is over 5.
3. **Active follow-ups** — add new tickets, mark resolved ones (or remove). Update the "Next action" column if priorities shifted.
4. **Locked decisions** — add new decisions only. Never delete a locked decision; if it's overturned, mark `~~struck~~` with a note explaining why and when.
5. **Pending operational state** — clear resolved items, add new ones (stashes, dangling worktrees, uncommitted verification artifacts).
6. **Where we left off** — overwrite with a 2–3 paragraph note covering: what shipped this session, what's pending review, what blocks the next move.

Before banking a finding as a locked decision or follow-up, state what would falsify it (Methodology Rule 23). Unfalsifiable-at-time findings are recorded as provisional, not settled.

Treat this file as part of every PR's review surface. If a PR introduces a new locked decision, the PR description references the CONTEXT.md update and the diff is part of the PR.
