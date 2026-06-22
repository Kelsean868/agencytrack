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
| Last updated | **PR #727 Nav redesign PR-2 — post-merge fill (2026-06-22).** #727 `98d8aed` **feat(nav): PR-2 — ★ Pinned model (prefs/app persistence + rules)** — per-user ★ Pinned zone (desktop star pin/unpin; mobile read-only), per-role seeds, first Firestore-persisted user pref (owner-only `prefs/app`, merge-write). `userPrefsService` + `usePinnedNav` (localStorage-first → Firestore reconcile → **per-user** mirror `agencytrack-pinned-nav:{uid}`, namespaced per dispatcher ruling). lint+build+3559 tests; userPrefs emulator deny-matrix 11/11; preview smoke 9/9 (agent + UM + mobile pinned-action), axe 0 serious/critical; Gemini 7 comments all resolved (4 HIGH mobile onAction, HIGH shared-key→namespaced, 3 MED tests). **Deploy-gate CLOSED (2026-06-22):** `firebase deploy --only firestore:rules` deployed; prod Firestore round-trip verified write→mirror-clear→reload→read-back, 9/9 PASS. **Prior:** PR #726 Nav redesign PR-1 — post-merge fill, #726 `b7aa372` (2026-06-22). **Prior:** PR #724 producing-manager fast-path — post-merge fill, #724 `cdc5fcb` (2026-06-22). |
| Current main HEAD | `98d8aed` (PR #727 Nav redesign PR-2 — **last WORK squash**, HUMAN-MERGE 2026-06-22). **Prior:** `b7aa372` (PR #726 Nav redesign PR-1, 2026-06-22). **Prior:** `cdc5fcb` (PR #724 producing-manager fast-path, 2026-06-22). |
| Active track | **Nav redesign PR-3 — Quick-Add menu — IN FLIGHT (branch `feat/nav-pr3-quickadd`, PR #729).** Desktop pencil FAB → role-aware Quick-Add popover; mobile center ＋ → sheet; amber dot relocated to BottomNav fab; Meetings + manager log-today deferred actions from PR-1 landed. Lint 0 · build clean · **3576/3576** tests · 17 QuickAddMenu tests added · 6 FastPath tests updated. Holding for smoke. **Prior: Nav redesign PR-2 — ★ Pinned model (prefs/app + rules) — SHIPPED (2026-06-22, PR #727 `98d8aed`, HUMAN-MERGE).** Adds the per-user ★ Pinned zone (desktop Sidebar star pin/unpin; MobileNavDrawer read-only), per-role seeds (agent: daily-log/wizard/policy-ledger/goals/planner · PM: mp-report/mastersheet/monthly-recruiting/mp-goals/planner — "Log Today" dropped, no manager route), and the first Firestore-persisted user pref: owner-only `tenants/{tid}/users/{uid}/prefs/app` `{ pinnedNav, updatedAt }` (merge-write; PR-4 menuLayout shares the doc — no PR-4 rules change). New `userPrefsService.js` + `usePinnedNav` hook (localStorage-first → Firestore reconcile → **per-user** mirror `agencytrack-pinned-nav:{uid}`). lint+build+3559 tests; userPrefs emulator deny-matrix 11/11; preview smoke 9/9 (agent ★ zone seeds, pin/unpin+mirror, reload-persist, UM seeds, mobile pinned-action onAction), axe 0 serious/critical; Gemini 7/7 resolved. **Deploy-gate CLOSED (2026-06-22):** `prefs/{prefId}` rule deployed to prod; Firestore round-trip verified (write→mirror-clear→reload→read-back, 9/9 PASS — `smoke-nav-pr2.mjs` prod run). **Prior:** **Nav redesign PR-1 — navConfig + Sidebar groups + scope chips + Planner SOON — SHIPPED (2026-06-22, PR #726 `b7aa372`, HUMAN-MERGE).** Centralizes agent + producing-manager (UM/BM) sidebar nav into `shell/navConfig.js` via `getNavConfig(role)`; renders section groups (agent: Today/Planning/Tools/Recognition · PM: My Production/Planning/My Team/Recognition), MINE/TEAM/BOTH scope chips, Money Needs child-indent, Planner `SOON` (added to `COMING_SOON_TABS`); Game Plan `New` badge removed; Daily Log shows for daily/hybrid agents only. **Producing-manager mapping is route-faithful (dispatcher Option-2 ruling 2026-06-22)** — every item points at an existing tabId, `roles` gating mirrors the shared `NAV_ITEMS` byte-for-byte (team-wars/agent-of-month/kiosk BM-only), no destination lost; render-switch + shared `NAV_ITEMS` untouched. SM/TA/PA nav unchanged. lint+build+3544 tests; preview smoke 23/23 (agent light+dark, UM, BM, mobile), axe 0 serious/critical; Gemini 1 medium → IMPLEMENT (immutability). **Next: PR-2 (★ Pinned zone) / PR-3 (Quick-Add) / PR-4 (menu-layout) — banked in FOLLOW_UPS.** **Prior:** **PR #724 producing-manager fast-path SHIPPED (2026-06-22)** — UM/BM My Production daily-review "Review & submit" routes to the Wizard v3 Confirm screen; resolves the banked UM/BM fast-path FU. **Still pending:** Block 2 **#11 role-aware shortcut** (build-and-hold — recon complete). **Operator action (from #717):** `firebase deploy --only firestore:rules` if not yet run. |
| Next track | **Feedback-run remaining (main green):** Block 2 **#11 role-aware shortcut** (build-and-hold — recon complete, all target flows exist incl. recruiting → `MonthlyRecruitingTab`; mobile floating pencil = `DailyFAB`). · **Daily Capture v2 Phase 5 build complete (manager days-worked + weekend, PR #692); Phase 4 + Phase 3 series also complete.** No further DCv2 phases queued — next track dispatcher-assigned (pilot prep / SEC-9b per CLAUDE.md § Current Phase). ~~submission-branchid Slice 2 — SHIPPED (PR #655).~~ ~~Onboarding Wizard Slice C — SHIPPED (PR #648).~~ HIGH FU: manager tenure-confirmation surface (banked PR #649). **Task #7:** Functions S3b — persistency nudge CF + leaderboardAggregate crash fix (BUILD-AND-HOLD; brief must land on `origin/main` per Rule 10 before dispatch). **Task #7:** Functions S3b — persistency nudge CF + leaderboardAggregate crash fix (BUILD-AND-HOLD; brief must land on `origin/main` per Rule 10 before dispatch). Queue 3 (Goals v3 recon — PR #621, HOLD — Kyron product calls). Queues 5/7/8/11 BUILD-AND-HOLD pending dispatcher. **Producing-manager LOW FU (banked from PR #631 smoke):** BM self-edit drawer toggle (positive UI case) not exercisable via A11Y test env — A11Y BM has empty roster + BM's own entry not in team panel. Verified via: emulator rules 5/5 PASS + leg-1 REST write PASS + leg-9 SM-no-toggle PASS + code review. Manual verify when a BM account with managed users is available. **Gemini FUs from this batch (LOW):** PR #619 — focus-trap always-mounted pattern in `RecommendLockDrawer` (hook may not engage on open; needs mount/unmount rework); PR #619 smoke — extra unused browser page + hardcoded empty capture report; PR #628 — consider `dark:text-surface` vs `dark:text-[--color-bg]` (verify equivalence in tailwind.config.js). **Prior:** Goals Slice 2 hardening follow-up items (handleDrawerSave silent-error gap, axe on drawer, dark-mode smoke — all addressed in PR #619 except focus-trap always-mounted pattern). **Prior:** Money Needs default-items verification (HOLD). |
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
### Awards ruleset — render consumers use `getMergedAwardsRuleset`; admin editor stays on raw `getAwardsRuleset` (Option A, PR #709 `2aa1572`)

- **Two accessors, by design.** `getMergedAwardsRuleset` deep-merges the stored `awardsRuleset_{year}` doc onto `DEFAULT_RULESET_2026` (missing → DEFAULT; partial → gaps backfilled; null/undefined key → default) so render/compute consumers never destructure a missing field and crash. `getAwardsRuleset` is **raw** (stored doc as-is, DEFAULT only on missing-doc).
- **Render consumers use the merged accessor:** `YearPlanModal`, `AgentDashboard`, `ManagerAwardsPanel` — and transitively everything they feed (`AgentAwardsPanel`, `HomeV2`, `BmAtRiskPanel`, `AgentReportDocument` via `generateAgentPDF`; `AwardsReachPanel` uses DEFAULT directly).
- **The admin editor `AwardsRulesetPanel` MUST stay on raw `getAwardsRuleset`.** It loads the stored doc, lets the admin edit it, and round-trips it back via `setAwardsRuleset`. Merging at its read boundary would show DEFAULT-backfilled values and **silently normalize a partial doc to complete on save** — a write-path data-integrity hazard. A **contract-lock test** (`awardsRulesetService.test.js`) pins `getAwardsRuleset` raw on a partial doc.
- **Falsification:** overturned if a render consumer is found that round-trips the ruleset into a write (none today — only the admin editor writes), or if a consumer deliberately branches on a ruleset key being *absent* (none — all assume presence). Surface, do not bank.

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

- **Test agent (sole A11Y agent):** `kelsean+smokeagent@gmail.com` — email in `.env.local` as `A11Y_AGENT_EMAIL`, password as `A11Y_AGENT_PASSWORD`. UID `vh6Lf55NhDgIjQ8yiLMvQyjCNbq2`, tenant `tatillife_smoke`, role `agent`, branch `smoke_branch`. **Logging mode = hybrid:** `loggingMode` is unset on the user doc, which resolves to **hybrid** (daily-capable via DCv2), NOT weekly — don't misread the unset field as weekly mode. This is the account the exploration walk authenticates as. (Supersedes the prior `kelsean@gmail.com` / `J0j4uBqzTPcfm1IlGCPyDzo27RP2` entry, which predated the `tatillife_smoke` smoke-tenant migration — PR #674.)
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
| [#724](https://github.com/Kelsean868/agencytrack/pull/724) | `cdc5fcb` | **feat(pm): producing-manager fast-path — daily-review → Confirm** (HUMAN-MERGE, 2026-06-22). Wires producing managers' (UM/BM) My Production daily-review "Review & submit" to the same Wizard v3 fast path agents got in #722/#723 (was routing to the date-picker / full path). `ManagerDashboard.jsx` only: new dedicated `showMpWizard` host (mirrors the agent's `showWizard`) + `openMpWizardForWeek(week, draftHint)` calling the real `resolvePath(mpLoggingMode, draftHint)` → `initialScreen='confirm'`/`initialStep=10` (fast) or `1`/`null` (full); the `showMpDailyModal` `onReviewSubmit` now threads `(week, draftHint)` from `DailyCaptureV2` into the host instead of `setActiveTab('mp-report')`. `goal`/`floors` threaded from `useMyProduction` (company `weeklyActivityFloors`; no tenure-API override — DEFAULT fallback is honest). `mp-report` direct-nav + `showWizard` mounts unchanged (agent parity: direct entry stays full-path). No rules/functions/schema/hook changes; `getDraft` is uid-generic. 6 new RTL tests (real `resolvePath` drives routing) + existing 18 My Production green; full suite green; lint 0; build clean. Live manager-Confirm leg Sunday-gated → deferred smoke banked (2026-06-28). Gemini absent (clean). |
| [#723](https://github.com/Kelsean868/agencytrack/pull/723) | `d982762` | **feat(wizard): Wizard v3 fast-path Phase 2 polish** (HUMAN-MERGE, 2026-06-22). Four polish items completing the v3 fast path. (1) **`useSeededTargets` seeding fix:** `parseFloat(data?.dials ?? data?.coldCalls)` — the daily-aggregated draft carries `dials` (fast path), weekly `INITIAL_DATA` has only `coldCalls` (full path read `undefined`→floor); `??` fixes the full path without regressing the fast path; closes the #698 Gemini-backstop FU. (2) **Fast-path back-nav:** new `cameFromConfirm` state → Back from step 10 returns to the Confirm screen instead of full-path step 9; full-path 10→9 regression-guarded. (3) **Confirm points readout:** static points-earned-vs-floor strip via pure `computePoints`/`sanitize` + `mapFloorToPoints` (no intra-week pace / daily-docs fetch); "Floor met ✓" toggles at boundary; `WeekSoFarPanel` intentionally not added (dispatcher ruling). (4) **Stepper type-then-click test** proving `IntStepper` `bump()`'s `base()` commits the live typed draft. **Gemini 1× IMPLEMENT** (`62e5d5e`): reset `cameFromConfirm` via `useEffect` when `step<10` (stale-shortcut edge case after descending below 10) + phase-rail-descent regression test. lint 0; **full suite 3516/3516**; build clean. Smoke: bundle-health + console-clean GREEN on preview; Confirm surfaces (points readout + back-nav) **Sunday-gated → skip-not-fail** (RTL-covered by `WizardFormV2ConfirmScreen.test.jsx`; day-aware `smoke-wizard-confirm-phase2.mjs` re-runs live on Sunday). FOLLOW_UPS: #698 FU resolved (Rule-11 diagnosis refinement); "Target Dials cold-only vs total" product Q banked. No rules/functions/money/auth. |
| [#722](https://github.com/Kelsean868/agencytrack/pull/722) | `687ecb9` | **feat(wizard): Wizard v3 fast-path Phase 1 — mount the Confirm screen** (HUMAN-MERGE, 2026-06-21). Daily/hybrid agents confirm their daily-aggregated week before Rate → Goals → Submit: new `screen='confirm'` in `WizardForm` (via an `initialScreen` prop) mounts `WeekConfirmView` (#696, previously unmounted) as the fast-path entry; "Looks good →" → step 10 (Rate). `AgentDashboard.openWizardForWeek` routes `path==='fast'` → `initialScreen='confirm'`. **Phase 1.2 premise corrected** (dispatcher-authorized): `onReviewSubmit` routes on the REVIEWED (completed) week's real aggregation hint (`{aggregatedFromDaily: weekDocs.length>0, daysWorked}`) passed through from `DailyCaptureV2` — NOT `currentWeekSub`, which on Sunday (the only day the deep-link appears) is the new/empty current week → would regress the fast path; the `:540` unlock-banner site does pass `currentWeekSub` (self-consistent). **Empty-state-flash fix:** confirm render gated on a `draftLoaded` flag (spinner until `getDraft` settles, then `WeekConfirmView` mounts with data; flag flipped in-band with the then/catch setters to not perturb fake-timer autosave RTL tests). Three #696 FUs: (a) steppers hold raw string while focused (partial-decimal entry); (b) social platform breakdown under one expandable headline; (c) edit-button active-state accent. New `setByPath` for nested-key Confirm edits. **3507/3507 suite; lint 0; build clean.** Preview smoke **6/6** (Sunday deep-link): loader-gate (no empty flash) · Confirm screen · seeded data (Dials 13) · "Looks good →" → step 10 · 0 console errors. Gemini: clean review, no inline comments. FUs banked: UM/BM fast-path entry; stepper type-then-click test coverage. Agent-scoped. |
| [#721](https://github.com/Kelsean868/agencytrack/pull/721) | `befd313` | **fix(money-needs): stack ExpenseGroupAccordion header on mobile (rev-3)** (HUMAN-MERGE, 2026-06-21). README rev-3 addendum (after #718 rows, #720 calc-modal). Presentation-only/token-only — no data-model/service/prop/contract/flag change. The accordion group header was one `justify-between` row ([dot+label] · count · `TTD …/yr` · chevron); `shrink-0` metrics starved the label on mobile (group names truncated to ~3 chars, "Bus…"/"Sav…"). Header now `flex-col` mobile / `sm:flex-row` desktop: mobile line 1 = dot + full label (`flex-1 min-w-0`, no `truncate`, `[text-wrap:pretty]`) + chevron pinned right; line 2 = `{filled} of {total} filled` + `TTD …/yr` as muted sub-row; desktop single row unchanged; `min-h-[44px]` + toggle logic unchanged. `CalcFedLineRow`/`LineItemRow`/`SubCalcLineItems`/`FloatingCalcModal`/`moneyNeedsService` untouched. 18/18 component tests (16+2: header stacks + full label, toggle still opens/closes); lint 0; build clean; hex-grep token-only. **Both-theme smoke 33/33** (group-header 7/7 + #720 calc-modal 8/8 + #718 floating-calc 18/18, both viewports); axe NO-NEW. Gemini: line-2 wrapper `<div>`→`<span>` (button phrasing-content) IMPLEMENTED (`f65a513`). |
| [#719](https://github.com/Kelsean868/agencytrack/pull/719) | `dbece70` | **feat(pm2): My Production section for producing managers (UM/BM)** (HUMAN-MERGE, 2026-06-21). New "My Production" nav section in `ManagerDashboard` with 7 flat own-data screens (Weekly Report · Goals · Game Plan · Money Needs · History · Commission · Policies), role-gated to `unit_manager`/`branch_manager` via the `roles` property. New `useMyProduction` hook mirrors AgentDashboard's `loadCoreData`/hierarchy/policies pattern scoped to the manager's own `uid` (no new Firestore fields; reuses PM-1 `canAccessOwn` rules from #717). Goals tab mounts the full agent composite (GapAnalysisPanel + DerivedIncomePanel + AwardsReachPanel + MdrtTracker); DailyFAB + DailyCaptureV2 overlay on any `mp-*` tab when `loggingMode` is daily/hybrid; Weekly Report → WizardForm full-screen early return; standalone `policy-ledger` nav absorbed into `mp-policies`. **Gemini 3× IMPLEMENT** (G1 destructured `policies`/`loadPolicies` deps; G3 hierarchy-effect `active` cleanup; G5 `loadPolicies` concurrency guard); G2 DISAGREE (same promise-chain pattern as AgentDashboard); G4 OBSOLETE. 18 component tests; 3486 suite. **Hardened smoke 83/83**: admin-SDK GROUND TRUTH gate (foil.unitId===UM.uid → UM manages; foil.branchId===BM.branchId → BM manages; foil has submitted $7,777 doc) · UM write-read-verify value-level ("3.3K" in mp-history + "TTD 3,333" in SubmissionViewer via own-uid getDraft) · UM+BM dual-form no-leak sweep ("7,777" full + "7.8K" abbreviated, 0 appearances across all 7 tabs × 2 viewports × 2 themes). |
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

**PR #723 Wizard v3 fast-path Phase 2 polish shipped (2026-06-22).** Four polish items complete the v3 fast path. (1) **`useSeededTargets` seeding fix:** the step-11 Target-Dials suggestion read `data?.dials`, which only the daily-aggregated draft (fast path) carries — weekly `INITIAL_DATA` has only `coldCalls`, so the full path read `undefined` and always fell back to the floor. Now `parseFloat(data?.dials ?? data?.coldCalls)` (+ dep) seeds the full path without regressing the fast path; closes the #698 Gemini-backstop FU (the FU's plain-swap suggestion would have *regressed* the fast path — Rule-11 diagnosis refinement recorded in the RESOLVED note). (2) **Fast-path back-nav:** a new `cameFromConfirm` state makes Back from step 10 return to the Confirm screen instead of decrementing to full-path step 9; full-path 10→9 is regression-guarded. (3) **Confirm points readout:** a static points-earned-vs-floor strip on the Confirm screen via the pure `computePoints`/`sanitize` + `mapFloorToPoints` helpers (deliberately NOT `computeWeekToDatePoints`/`computePaceState` — those need an elapsed-days cursor + a daily-docs fetch WizardForm lacks; pace is meaningless at end-of-week confirmation). `WeekSoFarPanel` intentionally not added (dispatcher ruling — it would duplicate WeekConfirmView's production section). (4) **Stepper type-then-click test** pins that `IntStepper` `bump()`'s `base()` commits the live typed draft.

**Gemini 1× IMPLEMENT (`62e5d5e`).** Flagged an in-family edge case on item 2: if the agent descends below step 10 (phase rail / Review Edit·Step) then walks back up to 10, the stale `cameFromConfirm` would wrongly send Back to Confirm. Fixed with a `useEffect` that resets the flag whenever `step < 10`, plus a phase-rail-descent regression test. Applied pre-first-report (no Rule 20 re-report needed beyond the SHA bump).

Verification: lint 0; **full suite 3516/3516**; build clean. Smoke ran **green** on the preview — bundle-health (the single-chunk bundle containing the WizardForm edits boots without runtime error) + console-clean. The Confirm-screen surfaces (points readout + back-nav) are **Sunday-gated** — the Confirm deep-link only appears on Sunday (`AgentDashboard.jsx:483`) and the merge landed on a Monday — so those two legs are **skip-not-fail** per the banked state-gated-smoke rule, RTL-covered by `WizardFormV2ConfirmScreen.test.jsx` (renders the real `initialScreen='confirm'` path through real `computePoints`/`mapFloorToPoints`). The day-aware `scripts/verification/smoke-wizard-confirm-phase2.mjs` (untracked) auto-runs the full Confirm assertions when executed on a Sunday — a clean Rule-13 deferred-verification path if a live Confirm smoke is wanted.

**Prior:** PR #722 Wizard v3 fast-path Phase 1 — `WeekConfirmView` mounted as the fast-path Confirm entry (`initialScreen='confirm'`), Phase 1.2 routes on the reviewed-week aggregation hint, empty-state-flash gated on `draftLoaded` (2026-06-21). **Prior:** PR #721 Money Needs group-header mobile stacking (rev-3, 2026-06-21). **PR #717 PM-1 producing-manager self-access rules — operator `firebase deploy --only firestore:rules` still required if not yet run** (PM-2 screens read through these rules; not live until deployed).

**Next:** Wizard v3 fast path is complete (Phases 1+2). Dispatcher-assigned next: Block 2 **#11 role-aware shortcut** (build-and-hold — recon complete, recruiting → `MonthlyRecruitingTab`, mobile pencil = `DailyFAB`); or pilot prep / SEC-9b per CLAUDE.md § Current Phase. **Wizard FUs still open:** extend the fast-path Confirm entry to producing managers (UM/BM); "Target Dials = cold-only vs total" product Q (banked this PR, head-of-sales call). **Producing-manager follow-up (banked PR #719):** BM own-data write-seeding for the smoke.


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
