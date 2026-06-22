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
| Last updated | **PR #721 Money Needs group-header mobile stacking (rev-3) — post-merge fill (2026-06-21).** #721 `befd313` **fix(money-needs): stack ExpenseGroupAccordion header on mobile** — header now `flex-col` mobile / `sm:flex-row` desktop; mobile line 1 = full label (no `truncate`, `[text-wrap:pretty]`) + chevron, line 2 = count + `TTD …/yr` muted sub-row; desktop single-row unchanged; toggle + `min-h-[44px]` tap target unchanged; presentation-only, token-only. 18/18 component tests; both-theme smoke **33/33** (group-header 7/7 + #720 8/8 + #718 18/18). **Prior:** PR #719 PM-2 My Production section for producing managers (2026-06-21). **Prior:** PR #720 Money Needs calc-modal label fix (2026-06-21). |
| Current main HEAD | `befd313` (PR #721 Money Needs group-header mobile stacking rev-3 — **last WORK squash**, HUMAN-MERGE 2026-06-21). **Prior:** `dbece70` (PR #719 PM-2 My Production section, 2026-06-21). **Prior:** `7f3fc95` (PR #720 Money Needs calc-modal label fix, 2026-06-21). |
| Active track | **PR #721 Money Needs group-header mobile fix SHIPPED (2026-06-21).** `ExpenseGroupAccordion` header stacks on mobile (full group label no longer truncated to ~3 chars; count + `TTD …/yr` total move to a muted line 2); desktop single-row unchanged; presentation-only/token-only. 18/18 tests; smoke 33/33. **Prior:** PR #719 PM-2 My Production section SHIPPED (2026-06-21). **Prior:** PR #720 Money Needs calc-modal label fix SHIPPED (2026-06-21). **Still pending:** Block 2 **#11 role-aware shortcut** (build-and-hold — recon complete). **Wizard v3 fast-path Phase 1** — implementation committed locally (`23002ff`) but NOT yet on its own branch; needs disentangling from the deleted PR #721 fix-branch before PR (see Where-we-left-off). **Operator action (from #717):** `firebase deploy --only firestore:rules` if not yet run. |
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
| [#721](https://github.com/Kelsean868/agencytrack/pull/721) | `befd313` | **fix(money-needs): stack ExpenseGroupAccordion header on mobile (rev-3)** (HUMAN-MERGE, 2026-06-21). README rev-3 addendum (after #718 rows, #720 calc-modal). Presentation-only/token-only — no data-model/service/prop/contract/flag change. The accordion group header was one `justify-between` row ([dot+label] · count · `TTD …/yr` · chevron); `shrink-0` metrics starved the label on mobile (group names truncated to ~3 chars, "Bus…"/"Sav…"). Header now `flex-col` mobile / `sm:flex-row` desktop: mobile line 1 = dot + full label (`flex-1 min-w-0`, no `truncate`, `[text-wrap:pretty]`) + chevron pinned right; line 2 = `{filled} of {total} filled` + `TTD …/yr` as muted sub-row; desktop single row unchanged; `min-h-[44px]` + toggle logic unchanged. `CalcFedLineRow`/`LineItemRow`/`SubCalcLineItems`/`FloatingCalcModal`/`moneyNeedsService` untouched. 18/18 component tests (16+2: header stacks + full label, toggle still opens/closes); lint 0; build clean; hex-grep token-only. **Both-theme smoke 33/33** (group-header 7/7 + #720 calc-modal 8/8 + #718 floating-calc 18/18, both viewports); axe NO-NEW. Gemini: line-2 wrapper `<div>`→`<span>` (button phrasing-content) IMPLEMENTED (`f65a513`). |
| [#719](https://github.com/Kelsean868/agencytrack/pull/719) | `dbece70` | **feat(pm2): My Production section for producing managers (UM/BM)** (HUMAN-MERGE, 2026-06-21). New "My Production" nav section in `ManagerDashboard` with 7 flat own-data screens (Weekly Report · Goals · Game Plan · Money Needs · History · Commission · Policies), role-gated to `unit_manager`/`branch_manager` via the `roles` property. New `useMyProduction` hook mirrors AgentDashboard's `loadCoreData`/hierarchy/policies pattern scoped to the manager's own `uid` (no new Firestore fields; reuses PM-1 `canAccessOwn` rules from #717). Goals tab mounts the full agent composite (GapAnalysisPanel + DerivedIncomePanel + AwardsReachPanel + MdrtTracker); DailyFAB + DailyCaptureV2 overlay on any `mp-*` tab when `loggingMode` is daily/hybrid; Weekly Report → WizardForm full-screen early return; standalone `policy-ledger` nav absorbed into `mp-policies`. **Gemini 3× IMPLEMENT** (G1 destructured `policies`/`loadPolicies` deps; G3 hierarchy-effect `active` cleanup; G5 `loadPolicies` concurrency guard); G2 DISAGREE (same promise-chain pattern as AgentDashboard); G4 OBSOLETE. 18 component tests; 3486 suite. **Hardened smoke 83/83**: admin-SDK GROUND TRUTH gate (foil.unitId===UM.uid → UM manages; foil.branchId===BM.branchId → BM manages; foil has submitted $7,777 doc) · UM write-read-verify value-level ("3.3K" in mp-history + "TTD 3,333" in SubmissionViewer via own-uid getDraft) · UM+BM dual-form no-leak sweep ("7,777" full + "7.8K" abbreviated, 0 appearances across all 7 tabs × 2 viewports × 2 themes). |
| [#720](https://github.com/Kelsean868/agencytrack/pull/720) | `7f3fc95` | **fix(money-needs): desktop calc-modal LineItemRow label truncation (#718 addendum)** (HUMAN-MERGE, 2026-06-21). `stacked` prop added to `LineItemRow` so `SubCalcLineItems` renders Description full-width on its own line inside `FloatingCalcModal` (~480px — fixed numeric columns leave only ~89px in a flat row; stacking gives label the full ~478px per smoke L1). Flat column header removed from `SubCalcLineItems` (stacked rows don't align to it; fields self-labelled via placeholder, same as mobile). Main-panel responsive layout unchanged from #718; `FloatingCalcModal` shell/width unchanged. 16 component tests (1 new modal-stacked test); 3471/3471 suite; lint 0; build clean; hex-grep empty. Modal-label smoke **8/8**: L1 label 478px ✅ L2 stacks Δy=50 ✅ L3 no gap ✅ L4 main-panel flat Δy=0 ✅ L5 mobile stacks ✅ L6 axe both themes ✅ L7 0 console errors ✅. #718 regression smoke 18/18. Gemini: no inline comments (interim commit reviewed; post-merge backstop: absent). |
| [#718](https://github.com/Kelsean868/agencytrack/pull/718) | `744d7df` | **fix(money-needs): calc-fed row card layout + manual row mobile stacking** (HUMAN-MERGE, 2026-06-21). Presentation repair of the two `MoneyNeedsPanel.jsx` row components, layered on #716. Calc-fed lines → **bordered cards**: empty (amount 0) = teal `border-primary bg-primary/5` card with a full-width "Build with calculator →" CTA (no inline input until filled — the one intended interaction change); filled = plain `border-border bg-surface` card, value-first amount input, outlined Recalculate, Reset only when overridden. Long labels ("Professional/industry expenses", "Debt reduction (non-mortgage)") render in full via `text-pretty` (no truncation). Manual rows stack on mobile (label full-width, then amount · frequency · annual · delete with `flex-wrap`). All handlers, `onOpenCalc`/`calcKey.split('.')[0]`, `FloatingCalcModal`, `moneyNeedsService` unchanged; no new tokens (hex-grep empty). 13 component tests (2 updated + 5 new layout/state); 3468 suite. Calc-row+floating-calc smoke **18/18** both viewports + both themes (long-label-no-truncate, empty-CTA, count-once delta, both car lines prefill, persistence, modal shape, focus trap+return, axe NO-NEW). Smoke-helper selector fixed (`55e893b`) for the new card DOM — verification code only. Gemini G1 (mobile flex-wrap, high) IMPLEMENTED; G2/G3 (`\|\| ''` null-safety, med) OUT-OF-SCOPE → LOW FU (data model guarantees numeric `amount`). |
| [#717](https://github.com/Kelsean868/agencytrack/pull/717) | `0270ac0` | **feat(rules): extend self-access to producing managers (PM-1)** (HUMAN-MERGE, 2026-06-21). `canAccessOwn` extended to `(isAgent() \|\| isProducingManager())` — UM + BM own-reads on submissions, policies, policies/history, settlements. Own-create/write self-arms added for goals (read + write self-arm), weeklyPlans (create/update/delete), moneyNeeds create, yearPlan create, monthlyPlan create. `dailyActivity`/`leaderboard` unchanged; `prospectInfo` deferred. All `canManage` team-access arms diff-verified byte-identical to main. New `tests/rules/pm1-deny-matrix.test.mjs`: **51/51** emulator cases (UM own→ALLOW, BM own→ALLOW, agent regression→unchanged, SM/TA self-arm→DENY; 4 pre-existing canManage-breadth ALLOWs documented — BM policies/history tenant-wide, settlements flat canManage with no unit/branch field). Gemini 2× IMPLEMENT (date correctness `PLAN_WEEK`/`PLAN_WEEK_2`); 1× OUT-OF-SCOPE (IPv6 parsing — FU across all rules tests). **Operator action required:** `firebase deploy --only firestore:rules`. |
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

**PR #721 Money Needs group-header mobile fix shipped (2026-06-21).** The last visible mobile defect in the Money Needs Worksheet series is closed: `ExpenseGroupAccordion`'s header packed [dot + group label] · `{filled} of {total} filled` · `TTD …/yr` · chevron into one `justify-between` row, and the `shrink-0` metrics starved the label on narrow screens — group names truncated to ~3 chars ("Bus…", "Sav…"). The header now stacks: `flex-col` on mobile (line 1 = dot + full label with `[text-wrap:pretty]` and no `truncate`, chevron pinned right; line 2 = the count + annual total as a muted sub-row), `sm:flex-row` single row on desktop unchanged. Toggle/open logic and the `min-h-[44px]` tap target are untouched; presentation-only, token-only. 18/18 component tests; both-theme production smoke 33/33 (new group-header 7/7 + #720 calc-modal 8/8 + #718 floating-calc 18/18, both viewports); axe NO-NEW. Gemini flagged the line-2 wrapper had to be a `<span>` (a `<button>` permits only phrasing content) — implemented in `f65a513`.

**Prior:** PR #719 PM-2 My Production section (UM/BM 7-screen own-data nav in `ManagerDashboard`, hardened smoke 83/83); PR #720 calc-modal label truncation; PR #718 calc-fed row card layout. **PR #717 PM-1 producing-manager self-access rules — operator `firebase deploy --only firestore:rules` still required if not yet run** (the PM-2 screens read through these rules; not live until deployed).

**⚠ Carry-forward — Wizard v3 fast-path Phase 1 branch entanglement.** A parallel session built and committed Wizard v3 Phase 1 (`23002ff` — 13 files: WeekConfirmView mount + Confirm/Edit callbacks, AgentDashboard `openWizardForWeek` routing, DailyCaptureV2 reviewed-week hint, WizardForm confirm screen, 4 test files, + its own CONTEXT/FOLLOW_UPS edits) **on top of the PR #721 fix-branch instead of its own branch off `main`.** It is local-only/unpushed — `origin/main` and the (now auto-deleted) remote fix-branch never carried it; PR #721 merged clean from remote `f65a513`. The commit still lives on the local `fix/money-needs-group-header-mobile` branch: **do NOT delete that local branch and do NOT push it** until `23002ff` is re-homed onto a fresh `feat/wizard-v3-phase1` branch off `origin/main` (cherry-pick, then `git reset --hard f65a513` the fix-branch). Routing review is done: **V1** — the Sunday "Review & submit" deep-link can fire for an empty completed week (no `weekDocs.length` gate on `SundayConfirmView`), so the static-synthetic Option A would mis-route it to Confirm; the committed code's dynamic `aggregatedFromDaily: weekDocs.length > 0` hint (a B-equivalent) is correct. **V2** — `WeekConfirmView` displays from `formData`, seeded off the real reviewed-week draft via `getDraft(weekStarting)`, never from the routing hint, so `daysWorked:1` cannot leak into the display. Recommendation stands: **B** (committed approach already realizes it).

**Next:** re-home + PR the Wizard v3 Phase 1 work; Block 2 **#11 role-aware shortcut** (build-and-hold — recon complete, recruiting → `MonthlyRecruitingTab`, mobile pencil = `DailyFAB`); or dispatcher-assigned (pilot prep / SEC-9b per CLAUDE.md § Current Phase). **Producing-manager follow-up (banked PR #719):** BM own-data write-seeding for the smoke (BM screens verified via no-leak sweep + heading-render fallback; own-data value-level read deferred since BM shares `useMyProduction`'s code path).


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
