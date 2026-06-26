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
| Last updated | **FU-H1 financing resilience SHIPPED (PR #757, `e2404be`, 2026-06-25).** SettlementPanel nullish guard (`(userList ?? [])`) + focused latest-request-race tests for all 3 guarded financing panels (new `FinancingTermsSetup.test.jsx` + `MonthlyStatementEntry.test.jsx`, appended `FinancingProrationPanel.test.jsx`) + `FinancingBasisBadge` dev-only `console.warn` on unexpected `basisSource`. Re-scoped at Phase 1: SettlementPanel guard parity premise did NOT hold (loadData is tenantId-keyed). lint 0; 3876/3876; build. **Prior: K5 validation-schedule proration + manager override SHIPPED (PR #754, `12a026c`, 2026-06-25).** **Prior: K4 take-home waterfall SHIPPED (PR #753, `fe4588a`, 2026-06-25).** |
| Current main HEAD | `e2404be` (PR #757 FU-H1 financing resilience — **last WORK squash**, 2026-06-25). **Prior:** `12a026c` (PR #754 K5 proration + manager override, 2026-06-25). **Prior:** `fe4588a` (PR #753 K4 take-home waterfall, 2026-06-25). |
| Active track | **FU-H1 SHIPPED (PR #757, `e2404be`, 2026-06-25).** Financing resilience hardening: SettlementPanel nullish guard; 3-panel race tests (`FinancingTermsSetup`, `MonthlyStatementEntry`, `FinancingProrationPanel`); `FinancingBasisBadge` dev-warn. SettlementPanel latest-request guard N/A (no per-agent load path). **Next: K6 (DerivedTermsPanel clocks: 24mo/12mo/waiver) or dispatcher-assigned.** **Prior: K5 SHIPPED (PR #754, `12a026c`, 2026-06-25).** **Prior: K4 SHIPPED (PR #753, `fe4588a`, 2026-06-25).**
| Next track | **K6** (DerivedTermsPanel clocks: 24mo/12mo/waiver — carried from K2/K5; brief TBD). **K7** (`adjustmentPct` consumer: notify-Sales-Admin duty for >10% downward cut — carried from K5). RollForwardCheck (unblocked by K4+K5 data — LOW FU). **K3 staff `'exclude'` path** needs a ledger staff-flag before it can function (banked FU, gated on A.4). Or **dispatcher-assigned** (pilot prep / SEC-9b per CLAUDE.md § Current Phase), or the **`yearPlanAllocation.js` orphan** standalone dead-code FU (banked PR-U2, FOLLOW_UPS.md). **Then:** **Feedback-run remaining (main green):** Block 2 **#11 role-aware shortcut** (build-and-hold — recon complete, all target flows exist incl. recruiting → `MonthlyRecruitingTab`; mobile floating pencil = `DailyFAB`). · **Daily Capture v2 Phase 5 build complete (manager days-worked + weekend, PR #692); Phase 4 + Phase 3 series also complete.** No further DCv2 phases queued — next track dispatcher-assigned (pilot prep / SEC-9b per CLAUDE.md § Current Phase). ~~submission-branchid Slice 2 — SHIPPED (PR #655).~~ ~~Onboarding Wizard Slice C — SHIPPED (PR #648).~~ HIGH FU: manager tenure-confirmation surface (banked PR #649). **Task #7:** Functions S3b — persistency nudge CF + leaderboardAggregate crash fix (BUILD-AND-HOLD; brief must land on `origin/main` per Rule 10 before dispatch). **Task #7:** Functions S3b — persistency nudge CF + leaderboardAggregate crash fix (BUILD-AND-HOLD; brief must land on `origin/main` per Rule 10 before dispatch). Queue 3 (Goals v3 recon — PR #621, HOLD — Kyron product calls). Queues 5/7/8/11 BUILD-AND-HOLD pending dispatcher. **Producing-manager LOW FU (banked from PR #631 smoke):** BM self-edit drawer toggle (positive UI case) not exercisable via A11Y test env — A11Y BM has empty roster + BM's own entry not in team panel. Verified via: emulator rules 5/5 PASS + leg-1 REST write PASS + leg-9 SM-no-toggle PASS + code review. Manual verify when a BM account with managed users is available. **Gemini FUs from this batch (LOW):** PR #619 — focus-trap always-mounted pattern in `RecommendLockDrawer` (hook may not engage on open; needs mount/unmount rework); PR #619 smoke — extra unused browser page + hardcoded empty capture report; PR #628 — consider `dark:text-surface` vs `dark:text-[--color-bg]` (verify equivalence in tailwind.config.js). **Prior:** Goals Slice 2 hardening follow-up items (handleDrawerSave silent-error gap, axe on drawer, dark-mode smoke — all addressed in PR #619 except focus-trap always-mounted pattern). **Prior:** Money Needs default-items verification (HOLD). |
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

### Game Plan unification — `yearPlan` 3-line canonical · `.allocation` retired · rail 4→3 (PR-U1, Direction 1.5, 2026-06-24)

- **`yearPlan/{year}` stays the canonical loop store; its line taxonomy moved 4-line → 3-line.** `LINE_KEYS = ['life','ah','general']` (shared, exported from `yearPlanService.js`); `general` subsumes the legacy `property`+`motor` lines. `targetAPI` stays the canonical per-line field. Every reader (hub `yearPlanTotalAPI` in `GamePlanV2/index.jsx`, `ReviewCommitModal` `LINE_META`, the monthly anchor) adopts the shared 3-line keys. This was a **bounded reader change, NOT additive** — writing a `general` key into the old 4-key store would be silently dropped by every reader → a money undercount (the §0 fix).
- **The merged Money Needs + Allocator surface writes `yearPlan` directly** via the one-directional adapter `allocationToYearPlan()` (`src/lib/moneyNeedsAllocation.js`): allocator commission → `yearPlan.lines[k].targetAPI = lineAPI`, `general` always carried; additive per-line `rate` + `products[]` (≤4, life/general only). **Round-trip invariant:** Σ`targetAPI` (enabled keys) === allocator `totalAllocatedAPI` (visible keys).
- **`.allocation` write is CUT** (the decoupled `moneyNeeds.allocation` anti-collision field is retired). The `.allocation` *reader*/hydration path + dead `saveAllocation`/`normalizeAllocation` are removed in **PR-U2** (the allocator now seeds from worksheet targets via `seedAllocation`). `yearPlanAllocation.js` (orphaned, test-only importer) defer-banked to a standalone dead-code FU (FOLLOW_UPS.md).
- **`YearPlanModal` retired** (file + test deleted); hub mount + `onOpenYearPlan` wiring removed. **Rail collapsed 4 steps → 3:** Money Needs (merged) · Monthly · Review & Commit. `yearPlanFilled` (the merged write) is Step-1's completion signal; `TOTAL_STEPS = 3`.
- **`firestore.rules`: PR-U1 needed none; PR-U2 added coarse additive field constraints (Option 2).** `yearPlan` `create`+`update` now run a shared `validYearPlanLine`/`validYearPlanLines` validator — per-known-line `rate ∈ [0,1]` and `products` list ≤4 (both guarded by `'x' in line`, so additive/not-required). Keys stay permissive (taxonomy enforced in the data layer's `LINE_KEYS`, not duplicated). `create` still gates `status=='draft'` + `request.auth.uid == uid` (producing managers may create only their OWN yearPlan — verified by rules-unit-tests). Merge requires a manual `firebase deploy --only firestore:rules` (Rule 19, operator).
- **Migration run state (corrected PR-U2):** **Arm A applied 2026-06-24, A=0 verified** (all 4-key `yearPlan` docs folded 4-key→3-key, total-preserving). **Arm B** seeded `yearPlan` from the 2 stranded `.allocation` docs (those docs now have a `yearPlan`); the residual `.allocation` **field** (B=2) is deleted in **PR-U2** via `functions/scripts/delete-stranded-allocation.cjs` (operator post-merge: dry-run → `--apply`, field-level `FieldValue.delete()`, only where the agent has a `yearPlan` doc — re-verified per-doc). `migrate-yearplan-3line.cjs` is **not re-run** by U2 (12 Jest tests pin its award-neutrality/idempotency; U2 adds a log-only committed-→-zero `⚠ REVIEW` guard for future dry-runs).
- **Two known false-positives (bank; do not chase):** (1) `probe-yearplan-prod-state.cjs` `§2.6 VERDICT` is `.allocation`-**presence**-based (clean only when `A==0 && B==0`), so it reports "MIGRATION REQUIRED — Arm B" while the residue persists — a false positive (Arm B already ran; B=2 are residual fields, not unmigrated data). After the U2 delete script `--apply`, expect **B=0** and the verdict reads **CLEAN CUT**. (2) The empty **committed** `yearPlan` doc `LOJDZrAN…` folds to a **zero** total — a test artifact, not real production loss; U2's migration `⚠ REVIEW` guard surfaces this class on any future dry-run instead of a silent `(preserved)`.
- **Falsification (Rule 23):** overturned if a consumer is found that reads `yearPlan.lines.property`/`.motor` **outside the Game Plan loop** (none today — the `policies` product-line domain and the money-needs worksheet `firstYearCommissionsTargets` are separate schemas), or if a non-owner write path to `yearPlan` is found (none — `create`/`update` are `request.auth.uid == uid`), or if real 4-key `yearPlan` / un-residual `.allocation` prod data exists (operator gate). Surface, do not bank.

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
| [#757](https://github.com/Kelsean868/agencytrack/pull/757) | `e2404be` | **fix(fu-h1): financing resilience — SettlementPanel nullish guard + 3-panel race tests + basisBadge dev-warn (Track K hardening)** (HUMAN-MERGE — money-adjacent `SettlementPanel`; **no rules, no deploy**). **Re-scoped at Phase 1 (dispatcher-confirmed):** the banked "SettlementPanel latest-request guard parity" premise did **not** hold — `SettlementPanel.loadData` is **tenantId-keyed** (unit-wide agent list + settlement history); agent selection is a **save-target form field only**, triggering no per-agent fetch, so the agentId-keyed stale-resolution money-write hazard the 3 financing panels guard **does not exist** there. **Decision 1 (SP guard) DROPPED — N/A, not "fixed."** Shipped: **(D2)** `(userList ?? [])` nullish guard on `SettlementPanel.loadData` (parity w/ financing panels); **(D3)** focused latest-request-race tests for the 3 panels that DO carry the `latestAgentReqRef` guard — new `FinancingTermsSetup.test.jsx` + `MonthlyStatementEntry.test.jsx`, appended case in `FinancingProrationPanel.test.jsx` (existing file had none); **(D4)** `FinancingBasisBadge` dev-only `console.warn` on unexpected `basisSource` (`import.meta.env.DEV`), unchanged production fallback (GLM nit). lint 0; full suite 3876/3876 (+5); build; hex clean. Banked LOW FU: `SettlementPanel.loadData` weak non-agentId overlap race (no money hazard). Carried: `FinancingTermsSetup` nullish-guard parity (1-token, out of locked D2 scope). |
| [#754](https://github.com/Kelsean868/agencytrack/pull/754) | `12a026c` | **feat(k5): validation-schedule proration + manager override (Track K)** (HUMAN-MERGE — money math + ledger write; operator rules deployed pre-merge via additive carve-out). **`src/lib/financingProration.js`** (pure, K3 reuse) — basis machine (M1–3→`submitted-final`; M4+ past closed→`settled-confirmed`; M4+ current/future→`submitted-provisional`); `monthlyGross` wraps K3 `computeApiChain`; `computeSuggestedFinancing` (min-ratio capped at 100%); `computeAdjustmentPct` (null until confirm; denominator=`currentMonthlyFinancing` per CD#5). **`setFinancingProration`** — forward-create pattern (`setDoc` new / `setDoc(ref,core,{merge:true})` existing K2 doc). **`firestore.rules`** restructured: `validProrationFields()` (conditional-presence optional fields; `basisSource` enum guard) + `hasAnyStatementField()` (statement-core-conditional). **`FinancingProrationPanel.jsx`** (~410 lines) — third tab in FinancingTab; basis badge; confirm form (ceiling guard vs `agreedMonthlyFinancing`); `adjustmentLabel()` (sign-aware: below-current→`−X%`, above→`+X%`). Provisional months (M4+ current) → read-only banner, no confirm form, no determination stored. lint 0; vitest 82/82 financing-suite (23 lib + 6 panel + 26 emulator rules + 27 service); build; hex-clean; **seeded write-read-verify 9/9 PASS** (forward-create green; managerFinancing 1500 persisted ≠ suggested 2000; adjustmentPct 0.25 stored; provisional negative ✓; axe 0 both themes). **Gemini**: race + double-negative 2/2 IMPLEMENTED in-PR. **GLM** late (post-merge): Warning co-constraint → DISAGREE (U2 permissive posture; banked LOW FU for K7); Nit `getOwnPolicies` rename → ALREADY-RESOLVED (banked FU). |
| [#753](https://github.com/Kelsean868/agencytrack/pull/753) | `fe4588a` | **feat(k4): take-home waterfall + K3 adapter (Track K)** (HUMAN-MERGE — pure UI + pure calc; **no rules, no deploy, no Firestore writes**). **`src/lib/financingTakeHome.js`** — pure take-home calc (tax-first sequence locked §2.1/A.1: `tax = gross × 25%` → `net = gross − tax` → `financingPortion = isOwing ? net × 50% : 0` → `takeHome = net − financingPortion`; OWING_STATUSES = `on_financing`|`post_financing_repayment`; 14 exhaustive tests covering all 4 status branches, one-step equivalence, boundary/NaN/custom-ruleset). **`src/lib/financingProjectedBonus.js`** — thin K3 adapter (per-agent, current-quarter, projected-only; agreement-relative quarters 1–4 × years 1–2; Q1 submitted-basis `proposedAPI`; Q2+ settled-basis `settledAPI`; date filtering via `monthKeyFromTimestamp` UTC-safe; persistency passed as 0–1 fraction **no normalization**; 12 adapter tests). **`src/config/financingRuleset/2026.js`** — `taxRate: 0.25` + `financingPortionRate: 0.50` added. **`TakeHomeWaterfallView.jsx`** — waterfall bar chart (`role="img"` + `aria-label`; 5-bar: gross/−tax/net/−financing/take-home; proportional height) + result band + accessible breakdown table + agent selector + projected/actual toggle (actual = placeholder "data available after quarter settles"). **`FinancingTab.jsx`** — third SUBVIEWS tab `{ id: 'takehome', label: 'Take-Home' }`. lint 0; vitest 3833/3833 (+26); build; hex-grep clean; **smoke 12/12 PASS** (value assertions: gross=$15,000 tax=$3,750 net=$11,250; owing fin=$5,625 th=$5,625 @ 37.5%; cleared th=$11,250 @ 75%; axe 0 violations both themes — 3 ResultBand/BreakdownTable contrast fixes in same branch `c8fa359`). |
| [#751](https://github.com/Kelsean868/agencytrack/pull/751) | `83a491d` | **feat(k3): financing bonus engine (pure module) + ruleset (Track K)** (HUMAN-MERGE — money math; **no rules, no deploy, no UI, no Firestore writes**). **New `src/lib/financingBonusEngine.js`** (pure, awards-engine pattern: zero Firebase/env/side-effects, ruleset passed in) — the contract API chain + quarterly/annual bonus figures, consumed by K4/K8 (which feed it data; K3 fetches nothing). Exports: `creditWeight` (A.3 credit filter), `computeApiChain` (Gross 1.2 / Net-for-Persistency 1.4 / Net-for-Production 1.5 + LSD/inc-PPP credit tracking), `computeQuarterGate` ($37,500 gross + 95/90% persistency; **Q1 submitted-basis exception, no persistency test**), `resolveRateTier` (150K–200K→25% / >200K→30%, maxGross inclusive), `computeFinancingBonus` (orchestrator → `{gross, netPersistency, netProduction, gates, consistencyBonus, productionBonus, rateTier, livesQualified, totalBonusRate, annualQualifyingAmount, annualGateMet, annualAdjustment}`). **`src/config/financingRuleset/2026.js`** `DEFAULT_FINANCING_RULESET_2026` (all TTD/% configurable; A.1 confirmed 2026). **Contract-math (Phase 1) verified vs authoritative addendum:** quarterly base = **Net-for-Persistency** (A.2, supersedes spec §4 Net-for-Production); annual-adjustment base = Net-for-Production (1.8); replacement/spia **0%** (A.3); persistency **passed-in** (A.5). **Staff (A.4 OPEN):** config `staffPolicyTreatment:'count'` default (product-owner position; no ledger flag needed); `'exclude'` declared-but-inert until a ledger staff-flag exists (banked FU). **61 exhaustive tests** (every credit type incl. staff count/exclude + self/family; gate boundaries; Q1 exception; persistency Y1/Y2 boundaries; consistency/production Y1/Y2; annual adjustment incl. max-out + lives </≥80; rate-tier boundaries incl. exact $200K; worked example: $60K qtr → $9K+$9K bonuses, $180K annual → $12,500 adjustment [reconciled by hand at dispatcher review]; **payable-bonus $0 floor on negative base** ×3; zero/negative/string edges; + Gemini-hardening: string quarter/year coercion + explicit-null param guards). **Payable bonuses (consistency/production/annualAdjustment) floor at `Math.max(0, …)`** — a negative Net-for-Persistency yields $0, never a negative figure (contract never pays a negative; K4 waterfall safety); raw bases (gross/netPersistency/netProduction) stay unclamped. lint 0; vitest 3807/3807 (+61); build. **No smoke (pure-module waiver — justified: zero runtime/UI/Firestore surface).** **Rule 21:** Gemini 5/5 IMPLEMENTED in-PR (`83a491d` — int-parse `quarter`/`yearInAgreement` fixes a latent string-`'2'` money-logic bug; nullish guards on all 5 fns); GLM unavailable (fetch failed — backstop at post-merge). **Dispatcher review:** worked example reconciled to $12,500 ✓; bonuses floored at $0; $200K tier boundary confirmed as-built (150K–200K inclusive = 25%). |
| [#749](https://github.com/Kelsean868/agencytrack/pull/749) | `6cabcc6` | **feat(k2): financing monthly ledger + statement entry + basis badge + 6× ceiling (Track K)** (HUMAN-MERGE; **operator pre-merge: `firebase deploy --only firestore:rules`** — additive carve-out, doubles as the Phase 6 deploy). **New collection `/tenants/{tid}/financing/{agentId}_{YYYY_MM}`** (composite doc ID; one doc per agent-month) — the agent's monthly statement entered manually: `financingPaid`/`netCommission`/`bonusOffset`/`runningBalance`+`notes`. **`runningBalance` stored AUTHORITATIVE** (never derived; MAY be negative = surplus owed to agent). **`firestore.rules`:** additive `match /financing/{docId}` — read `canAccessOwn(resource.data.agentId)`\|\|`canManage` (settlements composite-ID shape, NOT K1's `{agentId}` path-var); write BM/SM/TA + PA (UM excluded); coarse U2 validation (numerics, `month` YYYY_MM, `runningBalance` may be negative); no key-allowlist; delete denied. **`financingService.js`** ledger methods (`getFinancingMonth`/`setFinancingMonth`/`listFinancingMonths`) + pure helpers (`financingMonthIndex`/`deriveBasisSource`/`financingCeiling`/`detectSkippedMonths`); `monthKeyFromDate`/`monthsBetweenKeys`/`enumerateMonthKeys` in `dateInputs`. **`FinancingBasisBadge`** (3-state, render-derived: months 1–3 submitted-final, 4+ settled-confirmed; provisional reserved K5). **6× ceiling = 6 × `currentMonthlyFinancing`** (contract 2.4/6.3 — corrects design-spec §6 + mockup; K1 agreed-field hint fixed, Rule 9). **Skipped-month flag** informational (no interpolation; carry→K6). **Mount:** new `FinancingTab` container (segmented Terms·Monthly Ledger) at `ManagerDashboard:489`; K1 `FinancingTermsSetup` unchanged. lint 0; vitest 3743/3743 (+33); build; hex clean; **emulator rules 19/19**. RollForwardCheck + lift-agent-selection deferred (FU). **Known gap (Rule 22):** preview write-read-verify is deploy-gated (rules not live pre-merge) — Phase 6. |
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

**K5 validation-schedule proration + manager override SHIPPED (PR #754, `12a026c`, 2026-06-25).** Track K's proration layer — the pure module + service write + UI + rules restructure. `src/lib/financingProration.js` implements the basis machine (M1–3 → `submitted-final`; M4+ past closed → `settled-confirmed`; M4+ current/future → `submitted-provisional`, read-only), reuses K3's `computeApiChain` for the credit-filtered `actualAPI` Gross, and computes `adjustmentPct = (currentMonthlyFinancing − managerFinancing) / currentMonthlyFinancing` (null until manager confirms; denominator = `currentMonthlyFinancing` per CD#5). `setFinancingProration` in `financingService.js` uses a forward-create pattern — `setDoc` on new docs (proration before any statement exists), `setDoc(ref, core, {merge:true})` onto existing K2 docs. `FinancingProrationPanel.jsx` (~410 lines) mounts as the third tab in `FinancingTab` (four subviews: Terms · Ledger · Proration · Take-Home); basis badge; confirm form (ceiling guard vs `agreedMonthlyFinancing`); `adjustmentLabel()` sign-aware display (`−X%` for below-current, `+X%` for above). `firestore.rules` restructured with `validProrationFields()` (conditional-presence optional fields, `basisSource` enum guard) + `hasAnyStatementField()` (statement-core-conditional). Wrong-branch incident recovered via dedicated `agencytrack-k5` worktree; K4 PR #753 unaffected. Rebase conflict resolved (FinancingTab 4-subview union). 23 lib tests + 6 panel tests + 26 emulator rules cases (was 19) + 27 service tests.

**Phase 6 seeded write-read-verify 9/9 PASS against live rules (deployed pre-merge, additive carve-out).** Fixture: `smoke_k4_owing` agent, financingTerms eff 2026-06-01, agreed/current $2,000, validating $37,500, + $50,000 nb_ordinary policy in 2026_06 → `actualAPI=$50,000`, `ratio=100%` (capped), `suggested=$2,000`. Confirmed: `managerFinancing=1500` persisted (≠ suggested 2000); `adjustmentPct=0.25` stored = (2000−1500)/2000; reload verified; provisional month (2026-10) read-only, no determination stored. Fixture cleaned up (tatillife_smoke 0/0/0/0).

**Next: K6 (DerivedTermsPanel clocks: 24mo/12mo/waiver)** or **K7 (adjustmentPct consumer: notify-Sales-Admin duty for >10% downward cut)** or **dispatcher-assigned**. Open K-track FUs: RollForwardCheck (unblocked by K4+K5 data — LOW), lift-agent-selection into FinancingTab (LOW UX), `getOwnPolicies`→`getPoliciesByAgent` rename (LOW), GLM co-constraint warning (LOW, carry to K7 — FOLLOW_UPS.md), K3 staff `'exclude'` ledger-flag (gated on A.4), K3 live-data wiring (K8).


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
