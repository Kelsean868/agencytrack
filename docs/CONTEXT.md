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
| Last updated | **PR #731 Nav redesign PR-4 — Menu-layout preference — post-merge fill (2026-06-23).** #731 `fa8f06d` **feat(nav): PR-4 — menu-layout preference (workspace/both + My Work⇄My Team toggle)** — `workspace`/`both` layouts + `WorkspaceToggle`; `menuLayout` in `prefs/app` via `useMenuLayout` (no rules change); agents clamped to `pinned`. Persistent Recognition group below the toggle (Decision A); My Production + Planning sub-headers preserved (Decision B). Invariant unit test load-bearing. lint 0; build; **3613/3613** (+37); smoke **14/14 PASS**; axe **0-new** (disabled-card `opacity-60` AA fix `8cfb299`). Gemini DISAGREE: late-`uid` `useState` paint (consumers mount post-auth; matches shipped `usePinnedNav`). **Final nav-redesign slice — PR-1→PR-4 sequence COMPLETE.** **Prior:** PR #729 Nav redesign PR-3 — Quick-Add menu, #729 `48e5a89` (2026-06-22). **Prior:** PR #727 Nav redesign PR-2 — ★ Pinned zone, #727 `98d8aed` (2026-06-22). |
| Current main HEAD | `fa8f06d` (PR #731 Nav redesign PR-4 — Menu-layout preference — **last WORK squash**, HUMAN-MERGE 2026-06-23). **Prior:** `48e5a89` (PR #729 Nav redesign PR-3 — Quick-Add menu, 2026-06-22). **Prior:** `98d8aed` (PR #727 Nav redesign PR-2, 2026-06-22). |
| Active track | **Nav redesign COMPLETE — PR-1→PR-4 all shipped.** Next track dispatcher-assigned (pilot prep / SEC-9b per CLAUDE.md § Current Phase). **PR-4 — Menu-layout preference — SHIPPED (2026-06-23, PR #731 `fa8f06d`, HUMAN-MERGE).** `workspace`/`both` layouts + the My Work ⇄ My Team toggle (`WorkspaceToggle`); `menuLayout` in `prefs/app` via `useMenuLayout` (no rules change); agents clamped to `pinned` (resolver + disabled Settings cards + structural). Persistent Recognition group below the toggle (Decision A); My Production + Planning sub-headers preserved (Decision B). Invariant unit test load-bearing. 14/14 smoke PASS; axe 0-new; Gemini DISAGREE (late-`uid` paint — consumers mount post-auth, matches `usePinnedNav`). **Prior: Nav redesign PR-3 — Quick-Add menu — SHIPPED (2026-06-22, PR #729 `48e5a89`).** Desktop pencil FAB → role-aware Quick-Add popover; mobile center ＋ → bottom sheet; Meetings + manager log-today from PR-1 landed (Decision #6). **Prior: Nav redesign PR-2 — ★ Pinned zone — SHIPPED (2026-06-22, PR #727 `98d8aed`).** |
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
| [#734](https://github.com/Kelsean868/agencytrack/pull/734) | `{TBD}` | **fix(money-needs): double-tax bug — playground send-path + PAYESummary display** (HUMAN-MERGE, 2026-06-{TBD}). Two bugs in one PR (two commits, A+B). Bug 1 (commit A): `handleSendToPlayground` stores `{ value: gross, preTaxAlreadyApplied: true }` — Commission Playground skips gross-up on flag (old: bare number → re-grossed 1,090,000 → 1,453,333). Backward-compat: bare number → legacy path. `preTaxAlreadyApplied` flag flows MoneyNeedsPanel → localStorage → `decomposeFromIncome`. Bug 2 (commit B): PAYESummary headline = `totalAnnualPreTax` ("Income you must earn"); subtext = `totalAnnualAfterTax` ("After-tax take-home"). 5 new flag tests (`goalDecomposition.test.js`) + Bug 2 describe (`MoneyNeedsPanel.test.jsx`); 3623/3623; lint 0; build. Smoke L1b PASS both themes (localStorage injection → playground reads 1,090,000 ≠ 1,453,333). |
| [#731](https://github.com/Kelsean868/agencytrack/pull/731) | `fa8f06d` | **feat(nav): PR-4 — menu-layout preference (workspace/both + My Work⇄My Team toggle)** (HUMAN-MERGE, 2026-06-23). Final nav-redesign slice (4 of 4). Two alternative presentations of the PR-1 producing-manager nav, selectable in Settings, persisted to the existing `prefs/app` doc — **no firestore.rules change** (PR-2 owner-only rule permits `menuLayout`). `useMenuLayout` (localStorage-first / Firestore-reconcile, mirror `agencytrack-menu-layout:{uid}`) **clamps agent→pinned on read**; `getWorkspaceGroups` partitions the shipped item set route-faithfully (My Production + Planning sub-headers preserved — Decision B; persistent Recognition group with `leaderboard` once below the toggle — Decision A; Daily Log + Meetings PR-3 actions injected). `WorkspaceToggle` (aria-pressed, 44px, focus-visible, token colors). ProfileScreen 3 radio cards (agents' workspace/both disabled). **Load-bearing invariant unit test:** workspace∪team routable destinations == pinned destinations, per role. lint 0; build; **3613/3613** (+37). **Smoke 14/14 PASS** (UM layout-switch + persistence round-trip + no-regression + agent-lock forced-mirror clamp). **Axe 0-new** (disabled-card `opacity-60`-below-AA fixed `8cfb299`; remaining `.ml-2` = pre-existing `ProfileScreen:305` bio counter). Gemini DISAGREE: late-`uid` `useState` paint (consumers mount post-auth; matches shipped `usePinnedNav`). 2 LOW FUs banked. |
| [#729](https://github.com/Kelsean868/agencytrack/pull/729) | `48e5a89` | **feat(nav): PR-3 — Quick-Add menu (role-aware popover + sheet)** (HUMAN-MERGE, 2026-06-22). Desktop pencil FAB → role-aware Quick-Add popover (`agent`/`producingManager`/`manager` configs via `quickAddConfig.js`); mobile center ＋ → bottom sheet (auto-detected from `window.innerWidth < 768`); floating pencil hidden on mobile (`hidden md:flex`); amber dot relocated to `MobileBottomNav` fab (`item.dot`). Meetings (`start-meeting` → `handleStartMeeting`) and manager log-today (→ `setShowMpDailyModal`, Decision #6) — both deferred from PR-1 — now land here. SOON items disabled + non-activatable. Focus-trapped dialog (`role="dialog" aria-label="Quick add"`). 17 QuickAddMenu unit tests + 6 ManagerDashboardFastPath test updates; lint 0; build; **3576/3576** tests. **Smoke 21/21 PASS** (agent desktop 1280×900 + agent mobile 390×844 + PM-UM desktop, zero console errors). Gemini DISAGREE: isMobile resize listener (no SSR, short-lived mount, resize during interaction not a real scenario, resize listener breaks RTL). No rules/functions/schema/money change. |
| [#724](https://github.com/Kelsean868/agencytrack/pull/724) | `cdc5fcb` | **feat(pm): producing-manager fast-path — daily-review → Confirm** (HUMAN-MERGE, 2026-06-22). Wires producing managers' (UM/BM) My Production daily-review "Review & submit" to the same Wizard v3 fast path agents got in #722/#723 (was routing to the date-picker / full path). `ManagerDashboard.jsx` only: new dedicated `showMpWizard` host (mirrors the agent's `showWizard`) + `openMpWizardForWeek(week, draftHint)` calling the real `resolvePath(mpLoggingMode, draftHint)` → `initialScreen='confirm'`/`initialStep=10` (fast) or `1`/`null` (full); the `showMpDailyModal` `onReviewSubmit` now threads `(week, draftHint)` from `DailyCaptureV2` into the host instead of `setActiveTab('mp-report')`. `goal`/`floors` threaded from `useMyProduction` (company `weeklyActivityFloors`; no tenure-API override — DEFAULT fallback is honest). `mp-report` direct-nav + `showWizard` mounts unchanged (agent parity: direct entry stays full-path). No rules/functions/schema/hook changes; `getDraft` is uid-generic. 6 new RTL tests (real `resolvePath` drives routing) + existing 18 My Production green; full suite green; lint 0; build clean. Live manager-Confirm leg Sunday-gated → deferred smoke banked (2026-06-28). Gemini absent (clean). |
| [#723](https://github.com/Kelsean868/agencytrack/pull/723) | `d982762` | **feat(wizard): Wizard v3 fast-path Phase 2 polish** (HUMAN-MERGE, 2026-06-22). Four polish items completing the v3 fast path. (1) **`useSeededTargets` seeding fix:** `parseFloat(data?.dials ?? data?.coldCalls)` — the daily-aggregated draft carries `dials` (fast path), weekly `INITIAL_DATA` has only `coldCalls` (full path read `undefined`→floor); `??` fixes the full path without regressing the fast path; closes the #698 Gemini-backstop FU. (2) **Fast-path back-nav:** new `cameFromConfirm` state → Back from step 10 returns to the Confirm screen instead of full-path step 9; full-path 10→9 regression-guarded. (3) **Confirm points readout:** static points-earned-vs-floor strip via pure `computePoints`/`sanitize` + `mapFloorToPoints` (no intra-week pace / daily-docs fetch); "Floor met ✓" toggles at boundary; `WeekSoFarPanel` intentionally not added (dispatcher ruling). (4) **Stepper type-then-click test** proving `IntStepper` `bump()`'s `base()` commits the live typed draft. **Gemini 1× IMPLEMENT** (`62e5d5e`): reset `cameFromConfirm` via `useEffect` when `step<10` (stale-shortcut edge case after descending below 10) + phase-rail-descent regression test. lint 0; **full suite 3516/3516**; build clean. Smoke: bundle-health + console-clean GREEN on preview; Confirm surfaces (points readout + back-nav) **Sunday-gated → skip-not-fail** (RTL-covered by `WizardFormV2ConfirmScreen.test.jsx`; day-aware `smoke-wizard-confirm-phase2.mjs` re-runs live on Sunday). FOLLOW_UPS: #698 FU resolved (Rule-11 diagnosis refinement); "Target Dials cold-only vs total" product Q banked. No rules/functions/money/auth. |
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

**PR #731 Nav redesign PR-4 — Menu-layout preference shipped (2026-06-23, squash `fa8f06d`) — the nav redesign (PR-1→PR-4) is now COMPLETE.** Producing managers (UM/BM) can choose `pinned` (default, PR-2 ★ Pinned zone + full nav), `workspace` (My Work ⇄ My Team toggle), or `both` (★ Pinned above the toggle) in Settings; `menuLayout` persists to the existing `prefs/app` doc via `useMenuLayout` (localStorage-first/Firestore-reconcile, mirror `agencytrack-menu-layout:{uid}`) — **no firestore.rules change** (PR-2 owner-only rule permits it). **Agents are clamped to `pinned`** three ways: resolver returns `pinned` for `role==='agent'` regardless of stored value; ProfileScreen disables the workspace/both cards; AgentDashboard has no toggle render path. `getWorkspaceGroups` partitions the shipped producingManager item set route-faithfully (no route redefined) — My Production + Planning sub-headers preserved in My Work (Decision B); persistent Recognition group with `leaderboard` (scope BOTH) once below the toggle in both states (Decision A); Daily Log (`log-today`) + Meetings (`start-meeting`) PR-3 actions injected. **Load-bearing invariant unit test:** workspace∪team routable destinations == pinned destinations, per role. lint 0; build; **3613/3613** (+37); **smoke 14/14 PASS** (layout-switch, both-pinned-above-toggle, no testid collision, Firestore persistence round-trip, no-regression My WAR + Settlements, agent-lock forced-mirror clamp); **axe 0-new** (disabled-card `opacity-60`-below-AA fixed in `8cfb299`).

**Gemini disposition (pre-merge):** DISAGREE — late-`uid` `useState` paint. Gemini flagged that `useMenuLayout`'s lazy `useState(readMirror(uid))` could go stale if `uid` resolves after first render. Disagreed: the only consumers (Agent/ManagerDashboard) mount **post-authentication**, so `user.uid` is present at first mount; the pattern mirrors the shipped `usePinnedNav` (PR-2); the reconcile effect re-runs on `[uid]` change as a backstop. Banked LOW FU to harden both hooks together if ever desired.

**2 LOW FUs banked** (FOLLOW_UPS.md): (1) `useMenuLayout`+`usePinnedNav` late-`uid` paint hardening; (2) pre-existing `ProfileScreen:305` bio-counter `text-ink-muted/60` contrast (not PR-4).

**Next:** nav redesign sequence is done — **next track dispatcher-assigned** (pilot prep / SEC-9b per CLAUDE.md § Current Phase). **Sunday-gated deferred smoke (2026-06-28):** producing-manager fast-path Confirm leg — `smoke-wizard-confirm-phase2.mjs`, ready to run against preview on any Sunday. **Separate in-flight branch:** `ci/glm-reviewer` (`ce9e5a7`, operator's GLM-5.2 PR-reviewer CI workflow) — its `gemini-review` check ran green on PR #731; not yet merged to main.


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
