# AgencyTrack — CONTEXT.md

> **What this is:** Living project state. Read by Claude Code at the start of every session. Captures locked decisions, active follow-ups, and where we left off.
>
> **What this is not:** A replacement for `CLAUDE.md`. CLAUDE.md is the static rulebook (code style, domain rules, design system, stack). CONTEXT.md is the dynamic state. **Where they conflict, CONTEXT.md wins — it's newer.**
>
> **Maintenance:** Update at the end of each session. Anything you'd otherwise have to re-explain in a kickoff prompt belongs here.

---

## Current state — top of file for fast reading

| Field | Value |
|---|---|
| Last updated | `2026-05-21` |
| Current main HEAD | `3478ef0` ([#252](https://github.com/Kelsean868/agencytrack/pull/252) — Track I build step 1: Track F taxonomy confirmations) |
| Active track | Track I build step 1 shipped (PR [#252](https://github.com/Kelsean868/agencytrack/pull/252), `3478ef0`). Lifted F3 BOA + policyType provisional flags via head-of-sales-confirmed taxonomy. Next: **I1 (Manager WAR foundation)** — implement `managerWeeklyReports` per Track I spec §2. |
| Next track | **I1 — Manager WAR foundation** (per `docs/AgencyTrack_TrackI_ManagerWAR_DesignSpec.md` §2: `managerWeeklyReports/{managerId}_{weekStartISO}`, 7 tracked activities, JFW auto-counted from Track F joint-calls). Open items §10 first (head-of-sales activity standards, provisional-license rule). |
| Queued | I1 (Manager WAR foundation); F2.2 (email-to-BM on joint-call submit via mail/ Trigger-Email queue + CF); `needCovered` taxonomy confirmation (Track H/G); BOA-teardown FU (backfill + rule cleanup). Workshop §3.5 Tenant-Admin floors editor; Expected/Actual relabel sweep; true telephone-contacts wizard field. Track F deferred items (delete/archive, isPinned, peer-BM scope, full drill-down route). Two LOW housekeeping FUs from #244: CLAUDE.md "lint + build" → "lint + test + build" doc drift; vitest global firebase stub for systemic test-isolation prevention. Track D deferred behind workshop arc. |
| Two-strike counter | 0/2 — clean. |
| Stash pending | No |

---

## Locked decisions — do not re-litigate

These are settled across all future sessions. If a session audit surfaces a reason to revisit, treat as a **surprise-stop** — surface in chat, do not unilaterally override.

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
| [#252](https://github.com/Kelsean868/agencytrack/pull/252) | `3478ef0` | Track I build step 1 — Track F taxonomy confirmations (head-of-sales 2026-05-21). `prospectingSource`: `BOA` → `bank-referral` (canonical) — selectable form option swaps; rule additive (adds `'bank-referral'` to both create + update `prospectingSource in […]` allowlists on `prospectInfo`, keeps `'BOA'` for transition); display superset `PROSPECTING_SOURCE_LABELS` keeps the `BOA` label so legacy docs render as "Bank Referral (BOA)". New exported `POLICY_TYPES` enum (8 Tatil product categories: Critical Illness / Final Expense / Term Life / Whole Life / Universal Life / Endowment / Pension-Annuity / Mortgage-Credit Life); `ProspectInfoPanel` free-text policyType input → `<select>` in both add and edit forms; `ProspectInfoTab` displays enum labels (legacy free-text values still render verbatim via fallback). No `needCovered` change (still provisional). No CF / no index change. Additive rule deployed pre-merge from feature worktree (`agencytrack-2a610`). Tests: service unit (11 → 19) with 3 new PROSPECTING_SOURCES + 2 PROSPECTING_SOURCE_LABELS + 2 POLICY_TYPES suites; rules emulator (15 → 17) with 8a `bank-referral` ALLOW + 8b legacy `BOA` ALLOW; component (panel 5 → 7, tab 5 → 7) with legacy-BOA-label + enum-policyType rendering and free-text-fallback regression. Lint 0; build green; full suite 834/834 green; env-unset parity 834/834 green. **Lifts both F3 provisional flags** (BOA enum + policyType free-text); BOA-teardown banked as separate FU. **First Track I PR; next is I1 (Manager WAR foundation).** |
| [#250](https://github.com/Kelsean868/agencytrack/pull/250) | `4fb54a7` | Track F F2.1 — BM notification on joint-call submit. Best-effort client-side in-app notification to the agent's branch manager on joint-call create. `resolveBmInfo` helper resolves `agent.branchId → branches/{id}.managerId`; writes `manager_alert` notification doc if `bmUid && bmUid !== authorUid`; failure wrapped in try/catch — save never blocked. Self-notification skip + no-BM skip. Notification body is alert-only ("Joint call logged for {agentName}") — no observation/coaching detail. No CF. No rule change (existing `allow create: if canManage(tenantId)` covers the client write). No UI change (existing `NotificationDrawer` renders the doc). **Track F arc COMPLETE** (F1 #242, F2 #244, F3 #246, F3.1 #248, F2.1 #250). 4 new unit tests: BM resolved + doc shape; self-skip; no-BM skip; failure swallowed. Lint 0; build green; suite green; env-unset parity green. |
| [#248](https://github.com/Kelsean868/agencytrack/pull/248) | `4281991` | Track F F3.1 — Observation↔Prep link. Adds optional `prospectInfoId` field to the `jointCalls` doc (F2) — stored on the manager's observation only, NEVER on the agent's prep (prevents leaking "a manager observed this" back to the agent). Rule change: `prospectInfoId` added to the `affectedKeys().hasOnly([...])` update allowlist; create rule unchanged (`hasAll`, additive). Service: `addJointCall` + `updateJointCall` in `jointCallsService.js` each accept optional `prospectInfoId`; stored as trimmed string. UI: `JointCallsTab.jsx` loads the agent's prospect-info preps via `getProspectInfo` on mount; optional "Link to prospect prep" selector in the add form + `CallCard` edit form (hidden when no preps); linked-prep summary (name · date) with link icon on the observation card in view mode. Agent's `ProspectInfoPanel.jsx` and `ProspectInfoTab.jsx` unchanged — no leak path. Tests: 4 new `jointCallsService` unit tests (prospectInfoId persists/omitted on add, persists/cleared on update); `JointCallsTab.test.jsx` extended with `prospectInfoService` mock (F2/F3 CI lesson proactively applied) + 4 F3.1 component tests (selector visible/hidden, prospectInfoId passed through, linked-prep card summary renders); emulator rules test extended 11→13 cases (12a: author sets prospectInfoId → ALLOW; 12b: agent reads call with prospectInfoId → DENY — F2 boundary re-confirmed). Additive rule deployed pre-merge. Smoke: manager logs observation → links prep → reload → prospectInfoId persists + linked summary renders; agent prep view unchanged (no observation info); jointCall direct read as agent → 403 PERMISSION_DENIED. |
| #246 | `cded72f` | Track F F3 — Prospect-Info (agent-authored joint-call prep). **Completes Track F (F1 #242, F2 #244, F3 #246).** New `prospectInfo` subcollection under `/tenants/{tid}/users/{agentId}/` with **OPPOSITE privacy direction from F1/F2**: agent owns/reads/edits OWN; managers in scope READ; managers do NOT write. SUBMISSIONS-style rule shape (NOT rank-based, NOT agent-excluded): `get`/`list` allow if `request.auth.uid == path agentId` OR manager-in-scope (UM via denormalized `agentUnitId == request.auth.uid`, BM/SM/TA/PA tenant-scoped); `create`/`update` agent-only with path-bound `request.auth.uid == agentId`; `delete: if false`. Schema: `clientName` (trim 120), `clientAge` (parseFloat), `clientOccupation` (trim 120), `prospectingSource` enum (11 values — **PROVISIONAL**, also feeds Track H §3.3 Source-of-Prospect taxonomy when Track H lands), `appointmentType` enum (2nd-interview / closing-interview), `objections` enum multi-select (no-money / no-need / no-hurry / no-confidence), `policyType` (free text — no existing product taxonomy in `src/`, flagged for Track G/H refinement), `intendedAppointmentDate` (REQUIRED — appointment-binding per §0 guardrail; NOT a prospect pipeline / CRM), denormalized `agentUnitId` for UM scope, `createdBy` (= `agentId`), `createdAt` / `updatedAt`. New `src/services/prospectInfoService.js` (addProspectInfo / updateProspectInfo / getProspectInfo + reusable `PROSPECTING_SOURCES` / `APPOINTMENT_TYPES` / `OBJECTIONS` exports). One composite index added: `prospectInfo (agentUnitId ASC, intendedAppointmentDate DESC)` for UM scope; BM+ paths use the auto-built single-field index on `intendedAppointmentDate`. UI: **new agent-facing top-level NAV tab "Joint-Call Prep"** in AgentDashboard (first agent-facing Track F surface — placed between Career and Awards); `ProspectInfoPanel.jsx` hosts the create form + own-prep list + per-card inline edit. Manager surface: **third read-only tab "Prospect Info"** added to `CoachingNotesModal.jsx` (Notes | Joint Calls | Prospect Info) — `ProspectInfoTab.jsx` is pure read (no form below the list, mirrors the no-write rule). 15 emulator rules tests green covering the full SUBMISSIONS-style matrix: agent reads/writes OWN ALLOW, agent reads/writes ANOTHER agent DENY (cross-agent boundary), UM read own-unit ALLOW + other-unit DENY (scope), BM/SM/TA read in-tenant ALLOW, UM/BM create-or-update DENY (manager-write blocked), delete DENY for everyone. F2 CI test-isolation lesson applied proactively: `CoachingNotesModal.test.jsx` extended with surgical `vi.mock` of `prospectInfoService` to prevent `auth/invalid-api-key` from the transitive `prospectInfoService → firebase.js` import chain. 11 service unit tests + 7 manager-tab component tests + 6 agent-panel component tests; full suite 812/812 green; lint 0; build green; env-unset suite **cded72f**. Rules + index deployed pre-merge (additive). Smoke cded72f. F3.1 observation↔prep link deferred. |
| #244 | `6694f30` | Track F F2 — Joint-Call Observation Log. New `jointCalls` subcollection under `/tenants/{tid}/users/{agentId}/` mirrors F1's privacy model exactly (rank-based read; UM=1 → PA=5; agent EXCLUDED — no `canAccessOwn`; UM scoped to `agentUnitId == uid`). Structured field set: `appointmentDate`/`appointmentTime`, `appointmentKept` bool (conditional `nextMeetingDate`), `meetingType` enum (`demonstration` / `observation` / `collaboration`), `needCovered` enum (**PROVISIONAL** — 9 values: `income_protection`, `mortgage_or_debt`, `education_funding`, `retirement_planning`, `final_expenses`, `wealth_accumulation`, `critical_illness_or_health`, `business_protection`, `other`; flagged in FOLLOW_UPS for Track H/G design-time confirmation), `comments` (free text, trim+2000 cap), `saleMade` bool, `coachingMinutes` (parseFloat), `trainingIdentified` (free text + 1000 cap). New `src/services/jointCallsService.js` with `addJointCall` / `getJointCalls` / `updateJointCall` / `getRoleRank` / `MEETING_TYPES` / `NEEDS_COVERED`. CRITICAL list-query lesson from F1 carried through: `orderBy('authorRoleRank','asc')` FIRST, then `orderBy('createdAt','desc')` — guards against `FAILED_PRECONDITION`. Two composite indexes added: `jointCalls (agentUnitId ASC, authorRoleRank ASC, createdAt DESC)` for UM scope, `jointCalls (authorRoleRank ASC, createdAt DESC)` for BM+. Firestore rule block uses `jcRoleRank()` / `jcUMScopeOk()` / `jcUMScopeOnWrite()` helpers; `affectedKeys.hasOnly([...])` enforces field-shape allowlist on update; `delete: if false`. UI: `CoachingNotesModal.jsx` extended in place with tab strip (Notes default | Joint Calls); new `JointCallsTab.jsx` hosts form + list + per-card inline edit. Tab strip uses `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`. 15 service unit tests + 7 tab unit tests; existing F1 modal test 7/7 unaffected (Notes is default tab). Emulator rules tests 13/13 green (mirrors F1 matrix: UM rank/scope, BM/SM rank, AGENT DENY critical, non-author update DENY, author update ALLOW). Smoke cded72f. Rules + indexes deployed pre-merge (additive). F2.1 BM notification (tenant-scoped CF + `branches/{id}.managerId` resolution) deferred — existing `createNotification` CF is legacy top-level and needs reworking. F3 Prospect-Info form next. Smoke against prod preview before merge: 7/8 pass (BM POSITIVE log+reload confirmed; desktop console 0 errors; mobile 390×844 visible; UM RANK leg DENY confirmed; agent NEGATIVE-UI confirmed; agent NEGATIVE direct-read **HTTP 403 PERMISSION_DENIED** via Firestore REST — critical privacy boundary holds at rules level, not just UI; 1 dark-mode-mobile MasterSheet navigation timeout = known F1-banked harness gap, not a regression). CI failure on initial push was a test-isolation false-green-local — `CoachingNotesModal.test.jsx` mocked `coachingNotesService` but not the transitive `jointCallsService` import chain; surgical mock added in same branch (commit `cdb6aa7`); CI green on retry. Two LOW FUs banked: CLAUDE.md "lint + build" → "lint + test + build" doc drift; vitest global firebase stub for systemic prevention. |
| #242 | `d5102e5` | Track F F1 — Coaching Notes. New `coachingNotes` subcollection under `/tenants/{tid}/users/{agentId}/` with rank-based manager-chain privacy model (agent EXCLUDED — no `canAccessOwn` branch). `authorRoleRank` denormalized on each note (UM=1, BM=2, SM=3, TA=4, PA=5); read/update predicate enforces `callerRank >= authorRoleRank`. UM scope-restricted to `agentUnitId == request.auth.uid`; BM+ tenant-scoped. Peer-BM exclusion deferred (no branch-scoped infra). New `src/services/coachingNotesService.js` (addCoachingNote, getCoachingNotes, updateCoachingNote, getRoleRank, COACHING_CATEGORIES). New `CoachingNotesModal.jsx` (category badge, NoteCard with inline edit, loading/empty/error states, 44px touch targets, Nexus tokens, aria-modal). MasterSheet: Notes icon button per row (hover-visible, `e.stopPropagation()`). 9 service unit tests + 5 modal unit tests. Emulator rules tests 13/13 green (UM rank-allow/deny/scope, BM rank-allow/deny, SM all-allow, AGENT DENY critical). `firebase.json` `singleProjectMode: false` added. Deferred to follow-up: hard-delete, archive, `isPinned`, full per-agent route (F3+). |
| #240 | `4134d2c` | Track J1 — Tenure-based Company Floor + per-agent weekly API derivation. Extends `config/companyMinimums` with a `tenureApiFloors` block (6 bands from the head-of-sales slide 2026-05-19: m<12 → 150K / 12–24 → 200K / 25–36 → 250K / 37–48 → 300K / 49–60 → 400K / m>60 → 500K) plus a `tenureApiFloorsProvisional: true` marker signalling the numbers await head-of-sales confirmation. New `src/utils/tenureFloors.js` (pure resolver: `monthsOfService`, `resolveAnnualAPIFloor`, `resolveWeeklyAPIFloor`; whole months from ISO `contractStartDate`; missing/invalid → flat 200K / 4,800 fallback). `getCompanyMinimums()` shallow-merges defaults; `getGoalHierarchy()` resolves `companyFloor.api` per-agent (reads user doc for `contractStartDate`); `setGoals()` enforces the resolved floor on personal commitment writes. AgentDashboard pre-resolves `weeklyActivityFloors.api` per-agent before passing to `WeeklyStandardCard` (other 9 floors unchanged). CareerPortal Goals Overview "Minimum" column + GoalsPanel below-floor warnings + status chips + auto-expand all use per-agent floor. New idempotent Admin SDK seed script (`scripts/seed/seed-tenure-api-floors.mjs`); seeded `tatillife_south` (existing `annualAPI`/`annualApps`/`persistency`/`weeklyActivityFloors`/`updatedBy`/`updatedAt` preserved via merge). 25 boundary + fallback unit tests on the resolver; 3 service tests for `getGoalHierarchy` resolution; full suite 749/749 green. Career-level numbers UNCHANGED — board-signed `Sales_Career.pdf` remains authoritative; the head-of-sales slide's divergent career-level draft (300/300/500/700) is explicitly disregarded. |
| #238 | `1b05eb7` | Weekly Activity Floors (workshop §3.5 quick-win, floors portion) — extends `config/companyMinimums` with a `weeklyActivityFloors` block (10 keys from Tatil workshop 2026-05-19 Appendix A: callsMade 60 / contactsMade 40 / appointmentsScheduled 20 / interviewsKept 15 / factFindsCompleted 10 / closingInterviewsKept 10 / applicationsSubmitted 1 / clientsSold 1 / api 4800 / referralsNewLeads 100). `getCompanyMinimums()` shallow-merges defaults; `setCompanyMinimums()` `merge: true` preserves the block. New idempotent Admin SDK seed script (`scripts/seed/seed-weekly-activity-floors.mjs`); seeded `tatillife_south` (existing `annualAPI`/`annualApps`/`persistency` preserved). New `WeeklyStandardCard` component on AgentDashboard: 10 rows, Expected vs Actual, per-row Met/Close/Below status (green ≥ floor / amber ≥ 70% / red). Actuals via `extractFields` using canonical keys: `totalTelAttempts` (#1), `telContacts` → `qualifiedApproaches` fallback (#2), `appointmentsSet` (#3), `ffiConducted+ciConducted` (#4), `ffiConducted` (#5), `ciConducted` (#6), `applicationsSold` (#7), `livesSold` (#8), `apiSold` (#9), `totalNewNames` (#10). Row #2 surfaces a tap-to-expand footnote ("currently uses qualified approaches as a proxy") so the resolution is not hidden. Brief mapping table corrected in-PR (`telephoneDials`/`telephoneContacts` from earlier brief draft do not exist in extractFields; Phase 1 Rule 12 stop → dispatcher authorized Option A canonical keys). 28 new unit tests; full suite 718/718 green. |
| #236 | `58ebb2c` | Workshop-driven roadmap revision — commits `docs/AgencyTrack_Workshop_Roadmap_Revision.md` (analysis of Tatil Life manager workshop 2026-05-19) and registers its scope across CLAUDE.md (Track I row + reference line), CONTEXT.md (new Workshop-Driven Roadmap Revision section), and FOLLOW_UPS.md (6 banked items: Track I planned, Track F extension planned, Track H schema decision logged, quick-win minimums + relabel, social/CPD smalls, RESOLVED workshop decisions). Docs-only; zero code; smoke waived per pure-docs carve-out. |
| #235 | `0b8d04d` | Phase 7-8 docs integration — single reference line in CLAUDE.md above Build Phase History header pointing to `docs/phase7-8-PRD.md` + `docs/phase7-8-implementation.md` (recommended order D → E → G → F → H, ~36–46 PRs); new `## Phase 7-8 Planned Tracks` section in CONTEXT.md listing all 5 tracks (Awards Expansion / Daily Reporting Polish / Manager Drill-down + Coaching Notes / Money Needs Worksheet / Policy Ledger MVP); new `## Phase 7-8 Pre-Track Verifications` subsection in FOLLOW_UPS.md banking PH7-8-Q1 through PH7-8-Q5 (5 LOW-tier items, each resolves in its track's design pass). Brief-authoring stress test: 4 Rule 17 source-verify catches by CC during dispatch (design-v2-PRD anchor non-existent; loose vs `^##` header grep; Track D/E global namespace collision in Build Phase History table — Edit 2 dropped entirely; FOLLOW_UPS.md uses flat `##` not `### LOW` parent — header inline-corrected per Rule 17 sub-bullet). All four caught at execution time, zero strikes. CI flake on KioskModeTab.toast test (1026ms vs 1000ms waitFor timeout on slow runner) — passed clean on local main run and CI retry. |
| #234 | `7507ac1` | Phase 7-8 design docs trio shipped ahead of integration PR: `docs/phase7-8-PRD.md` (772 lines, 5-track design spec D–H), `docs/phase7-8-implementation.md` (297 lines, PR-by-PR breakdown with recommended sequence D → E → G → F → H, ~36–46 PRs total), `docs/briefs/pr-phase7-8-docs-integration-kickoff.md` (269 lines, kickoff brief for the integration PR). Covers Track D (Awards Expansion + Ruleset Config), Track E (Daily Reporting Polish), Track F (Manager Drill-down + Coaching Notes), Track G (Money Needs Worksheet), Track H (Policy Ledger MVP). Five pre-track verification follow-ups (PH7-8-Q1 through Q5) staged in the kickoff brief — banking deferred to the integration PR per the brief's scope. Pilot remains postponed indefinitely. |
| #233 | `29f79cc` | Retroactively archived mobile-fu4-cosmetics kickoff brief (orphaned from pre-Rule-10 era, 222 lines from `origin/docs/mobile-fu4-cosmetics-brief` tip `9fec5fe`) to `docs/archive/briefs/`. Mirrors PR #211 archive pattern. Branch deletion follow-on in Phase 7. |
| #231 | `5be20e7` | Rule 17 brief-completeness sub-bullet — banks PR #229's two Rule 9 extensions as methodology learning for briefs introducing new Firestore collections (rules + CF + index + smoke query shape as a single architectural unit). |
| #229 | `0fdebc0` | Resend invite server-side + audit log — new `resendInviteEmail` CF reuses `createUser`'s `mail/` template path (`password-reset.txt` / `.html` + `'Welcome to AgencyTrack — set your password'` subject); new `auditInviteResends` collection mirrors `auditAdminCreations` pattern (`allow write: if false`; reads scoped to tenantId for tenant_admin/branch_manager/sales_manager, unrestricted for platform_admin). `userService.resendInvite(uid)` wrapper mirrors `callUpdateUser` httpsCallable pattern. `UserManagementPanel.jsx` swapped from `sendPasswordReset(email)` → `resendInvite(uid)`; warning toast added for `emailQueued: false` returns. Closes both #215 LOW FUs in single PR (Path B). Additive CF + rules + composite index deploy. Three Rule 17 brief-authoring drift catches at Phase 1 (in-scope Rule 9 adaptations): `buildMailDoc` is 5-arg not 4 (subject required); `createUser` wrapper lives in `agentManagementService.js` not `userService.js` (mirror is `callUpdateUser`); rules file uses inline `getRole() == 'X'` not helper functions. Two in-PR Rule 9 fixes after operator smoke surfaced gaps: (1) smoke audit query missing `tenantId` filter required by Firestore rule constraint at query-validation time (commit `848c16c`); (2) `auditInviteResends` composite index `(tenantId ASC, actorUid ASC, targetUid ASC, timestamp DESC)` added to `firestore.indexes.json` (commit `cd2ef7b`) — brief Phase 4 under-specified the index requirement when introducing a new collection + non-trivial query (banked as methodology note: briefs touching new collections + composite queries should enumerate implied index adds upfront). |
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

**What shipped:** Track I build step 1 — Track F taxonomy confirmations (PR [#252](https://github.com/Kelsean868/agencytrack/pull/252), `3478ef0`). Head-of-sales decisions 2026-05-21 lifted two F3 provisional flags: `prospectingSource` BOA → `bank-referral` (canonical; label "Bank Referral (BOA)"), and `policyType` free-text → 8-category `POLICY_TYPES` enum (Tatil products). Rule change additive (`bank-referral` added to both create+update allowlists; `BOA` kept for transition) — deployed pre-merge from feature worktree. Selectable form options now offer `bank-referral`; display label superset `PROSPECTING_SOURCE_LABELS` keeps `BOA` rendering as "Bank Referral (BOA)" so legacy docs don't show raw values. Both add and edit forms in `ProspectInfoPanel` swapped from text input to `<select>`. Suite 834/834; env-unset 834/834; rules 17/17. **First Track I PR.**

**Next move:** **I1 — Manager WAR foundation** (`managerWeeklyReports/{managerId}_{weekStartISO}`, 7 tracked activities, JFW auto-counted from Track F joint-calls). Per spec §10 open items: confirm head-of-sales activity standards (JFW count, one-on-ones, recruiting, training) and provisional-license window with compliance before build. Alternative: F2.2 (email-to-BM via mail/ Trigger-Email queue + CF) or workshop §3.5 fast-follows.

**Previous session — Track F F2.1 BM notification on joint-call submit (PR [#250](https://github.com/Kelsean868/agencytrack/pull/250), `4fb54a7`).** Best-effort client-side in-app notification to the agent's branch manager when a manager logs a joint-call observation. No CF needed — the existing `allow create: if canManage(tenantId)` rule covers the client write. **Track F arc COMPLETE** (F1 #242, F2 #244, F3 #246, F3.1 #248, F2.1 #250).

---

## How to update this file

At the end of each session, update in this order:

1. **Top table** — bump `Last updated`, `Current main HEAD`, active/next track, two-strike state, stash status.
2. **Recently shipped** — add the merged PR at the top, drop the oldest if the list is over 5.
3. **Active follow-ups** — add new tickets, mark resolved ones (or remove). Update the "Next action" column if priorities shifted.
4. **Locked decisions** — add new decisions only. Never delete a locked decision; if it's overturned, mark `~~struck~~` with a note explaining why and when.
5. **Pending operational state** — clear resolved items, add new ones (stashes, dangling worktrees, uncommitted verification artifacts).
6. **Where we left off** — overwrite with a 2–3 paragraph note covering: what shipped this session, what's pending review, what blocks the next move.

Treat this file as part of every PR's review surface. If a PR introduces a new locked decision, the PR description references the CONTEXT.md update and the diff is part of the PR.
