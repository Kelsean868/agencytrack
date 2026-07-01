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
| Last updated | **K9 SHIPPED (PR #767, `d5c7b2a3`, 2026-07-01).** First subject-facing financing view — `FinancingSelfView.jsx` (read-only, own uid) mounted in `AGENT_NAV` `financing` + `PRODUCING_MANAGER_NAV` `mp-financing` "My Production". SHOWN/PRIVATE contract enforced: numbers-only projection, `adjustmentPct`/`suggestedFinancing`/notes/audit absent from DOM, `managerFinancing` relabeled "Your draw", `statusHistory` split to `{from→to,at}`. 5 field-projection tests (4043/4043 suite). Subject-signed-in smoke 23/23 PASS both themes. No rules/functions/indexes added — all `canAccessOwn` arms pre-existed K1. **Key regression prevented:** CodeRabbit suggested removing the per-year recon `.catch(() => null)`; subject-signed-in smoke proved this breaks every financed agent (absent-year GET returns PERMISSION-DENIED under `canAccessOwn` w/ null resource) → DISAGREE + documented + reverted. **Prior: K7 cleanup SHIPPED (PR #764, `fa5854a8`, 2026-06-26).** Confirmed-basis notify guard in `FinancingRiskPanel`; live-fire CF verification script; data-safety CRITICAL fix. **Prior: K7 termination-risk monitor SHIPPED (PR #762, `8dc91d1e`, 2026-06-26).** `financingMissEngine.js` + `notifyFinancingAdjustment` CF + `FinancingRiskPanel.jsx`. |
| Current main HEAD | `d5c7b2a3` (PR #767 K9: read-only financing self-view agent + financed-UM own half, 2026-07-01). **Prior:** `fa5854a8` (PR #764 K7 cleanup: confirmed-basis notify guard + live-fire script, 2026-06-26). **Prior:** `8dc91d1e` (PR #762 K7 termination-risk monitor + clause-5.3 notify duty, 2026-06-26). |
| Active track | **K9 SHIPPED (PR #767, `d5c7b2a3`, 2026-07-01).** `FinancingSelfView.jsx` — read-only, own uid, SHOWN/PRIVATE contract, subject-signed-in smoke 23/23 PASS. **Next: K10** (UM unit-management half — `unitId` stamp on financing docs, unit-scope rules arm, backfill migration; financed-UM sees own agents' financing roster). **K9 CodeRabbit DISAGREE banked:** per-year recon `.catch(() => null)` is LOAD-BEARING — absent-year GET returns PERMISSION-DENIED (not null) under `canAccessOwn` with null resource; removing it breaks every financed agent. Confirmed by subject-signed-in smoke leg that unit tests cannot catch. **Carried K-track FUs:** garnish incentive-payments ledger source (K6 MEDIUM); RollForwardCheck (LOW); `getOwnPolicies→getPoliciesByAgent` rename (LOW); K3 staff `'exclude'` path (gated on A.4); K7 CF-side cooldown gap (LOW). **K8** (New-Agent Validation Dashboard + policy-ledger drill-down) also queued. Or **dispatcher-assigned** (pilot prep / SEC-9b per CLAUDE.md § Current Phase). |
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
| [#767](https://github.com/Kelsean868/agencytrack/pull/767) | `d5c7b2a3` | **feat(k9): read-only financing self-view (agent + financed-UM own half)** — `FinancingSelfView.jsx` (read-only, own uid). SHOWN/PRIVATE field-projection contract: `adjustmentPct`/`suggestedFinancing`/notes/audit absent from DOM; `managerFinancing` relabeled "Your draw"; `statusHistory` split to `{from→to,at}` only. Two nav mounts: `AGENT_NAV` financing tab + `PRODUCING_MANAGER_NAV` `mp-financing` in "My Production". No rules/functions/indexes added — all `canAccessOwn` arms pre-existed K1. 5 field-projection contract tests; 4043/4043 full suite; subject-signed-in smoke 23/23 PASS both themes. **Key regression caught by smoke:** CodeRabbit suggested removing the per-year recon `.catch(() => null)` — smoke proved this breaks every financed agent (absent-year `financingReconciliation` GET returns PERMISSION-DENIED under `canAccessOwn` with null `resource.data`) → DISAGREE documented + reverted. UM unit-management half deferred to K10. |
| [#764](https://github.com/Kelsean868/agencytrack/pull/764) | `fa5854a8` | **fix(k7-cleanup): confirmed-basis notify guard + live-fire script + horizon FUs** — `FinancingRiskPanel` now filters `findAdjustmentFlags` to `CONFIRMED_BASES` before surfacing the >10% notify affordance (panel-CF gate parity; provisional months no longer surface a dead-end Notify). Live-fire CF verification script committed + cataloged in SMOKES.md. Data-safety CRITICAL fix in script (`originalConfig` null tri-state guard + loud restore-error logging). FOLLOW_UPS: provisional-flag LOW FU RESOLVED (Rule-11 drift note — panel-level fix vs FU's engine-level suggestion); pilot-prep CodeRabbit codebase audit FU banked; script-hardening LOW FU banked. lint 0; vitest 4038/4038 (+2 regression tests); build; hex clean. |
| [#762](https://github.com/Kelsean868/agencytrack/pull/762) | `8dc91d1e` | **feat(k7): termination-risk monitor + clause-5.3 notify duty (Track K)** (HUMAN-MERGE — money/legal-duty math + a Cloud Function + new config doc; **operator pre-merge: `firebase deploy --only functions`** ONLY — K7 adds ZERO `firestore.rules`, so NO rules deploy, NO Rule-23/24 ruleset-verify leg). **Phase-1 Rule-17 catch (dispatcher-accepted):** the brief over-specified the rules surface — the existing wildcard `config/{docId}` block already covers `config/financingConfig` (read: same-tenant signed-in; write: tenant_admin/platform_admin), and every CF write is Admin-SDK or reuses existing CF-only rules (`nudges` `create:if false`, `auditNudges` `read,write:if false`) → `firestore.rules` byte-unchanged vs origin/main. **`src/lib/financingMissEngine.js`** (pure, mirrors K5/K6): `computeMonthlyMiss` (confirmed-basis verdict — `basisSource ∈ {submitted-final,settled-confirmed}`, miss = `actualAPI < validatingAPI` on the LEDGER MONTH's stored `validatingAPI`), `computeConsecutiveMisses` (CD#4 — meet resets, pending HOLDS/no-op, amber-at-2 / critical-at-3 = 7.2c condition met), `isAdjustmentNotifyFlag` (>0.10 confirmed cut), `findAdjustmentFlags`. FLAG ONLY — no `financingStatus` change, no `LEGAL_TRANSITIONS` touch, no `terminated` state. **`src/services/financingConfigService.js`** — `config/financingConfig.notifyRecipientUid` get(default null)/set(actor); mirrors goalsService. **`functions/financing/notifyFinancingAdjustment.js`** (NEW CF) — BM+ gate (UM excluded), resolves the recipient server-side from config (unset → structured `{success:false,reason:'no-recipient'}`, not a throw), agent-subject scope-check (defense-in-depth), atomic batch (bell `notifications` + tenant-scoped `auditNudges` who/when/payload + `nudges` deterministic cooldown `{agentId}_financing.adjustment.notify_{month}`) + non-fatal `mail/`; reuses `buildMailDoc`/transport, does NOT call `sendComplianceNudge` (its `targetInScope` rejects a tenant-level recipient for a BM caller). New email template pair `financing-adjustment-notify.{txt,html}`. **`src/services/financingNotifyService.js`** — client CF wrapper + deterministic-ID cooldown read (24h). **`FinancingRiskPanel.jsx`** — 6th FinancingTab subview (Terms·Ledger·Proration·Take-Home·Reconciliation·Risk); consecutive-miss monitor (miss-dots, amber/critical, CONFIRMED-BASIS badge, 7.2c condition-met callout) + >10% flag card + manager-confirmed Notify affordance (24h cooldown · disabled "no recipient configured" when unset); BM+ gated; Nexus tokens both themes 44px. lint 0; vitest **3988/3988** (+66: 43 engine · 12 config · 11 panel); functions jest **328/328** (+21 CF); build; hex clean (token-only; email-template hex is the established exemption); `firestore.rules` unchanged → emulator regression is a no-op. **Known gap (Rule 22):** seeded write-read-verify + the live CF fire + axe-both-themes are the **deploy-gated Phase 6 smoke** (CF not live pre-merge; Rule 19 — CC cannot deploy). **FU banked:** `cro`-role buildout (config uid re-points cleanly); K8 roster reuses this engine. |
| [#756](https://github.com/Kelsean868/agencytrack/pull/756) | `ecad6b1` | **feat(k6): reconciliation event + 6.2 garnish + wind-down clocks (Track K)** (HUMAN-MERGE — money math + new collection + status transitions; **operator pre-merge: `firebase deploy --only firestore:rules`** additive carve-out, doubles as the Phase 6 deploy). **New collection `/tenants/{tid}/financingReconciliation/{agentId}_{year}`** (composite doc ID; one record per agent-year) — the year-1 wind-down event. **`src/lib/financingReconciliation.js`** (pure, mirrors K4/K5): `computeReconciliation` (service-gated waiver per CD#7 — `serviceMet = serviceMonths >= 12`, `waiverApplied = serviceMet ? Σ financingPaid[m1–3] : 0`; `closingBalance` AUTHORITATIVE from K2 `runningBalance`; `reconciledPosition = closingBalance − waiverApplied`; `outcome` owing>0/surplus≤0; `surplusPaid`; `nextStatus`; **`totalOffsets = totalFinancingDrawn − closingBalance`** derived so the worksheet reconciles to the authoritative balance — Rule 9), `computeGarnishProjection` (display-only trailing avg of `garnishCommissionRate × netCommission + bonusOffset`; incentives omitted — Decision 6 / FU), `computeWindDownClocks` (24-mo term · 12-mo service · 3-mo waiver window · 6× ceiling). **`financingService.js`** `reconcileFinancing` (writes record FIRST, then drives `transitionFinancingStatus` reconciling→terminal — mockup error-state rule) + `getFinancingReconciliation`. **`firestore.rules`** additive `match /financingReconciliation/{docId}` — read `canAccessOwn(resource.data.agentId)`\|\|`canManage`; write BM/SM/TA + PA (UM excluded); coarse U2 validation (outcome/triggeredBy enums, money numbers — closingBalance/reconciledPosition may be negative, waiverApplied/surplusPaid ≥0, serviceMet/garnishStarted bool); no key-allowlist; delete denied. **`src/config/financingRuleset/2026.js`** `garnishCommissionRate: 0.10` (Rule 9 — contract 6.2 rate, configurable). **`FinancingReconciliationPanel.jsx`** — 5th FinancingTab subview; status-driven (on_financing begin-reconciliation w/ early-election 6.5b checkbox · reconciling worksheet+outcome · post_financing_repayment garnish projection + manager-confirmed mark-cleared · cleared record); wind-down clocks; Nexus tokens both themes 44px. lint 0; vitest **3908/3908** (+ new lib + service tests); build; hex clean; **emulator rules K6 22/22 · K2 26/26 · K1 15/15**. **Known gap (Rule 22):** seeded write-read-verify + axe-both-themes is the **deploy-gated Phase 6 morning smoke** (rules not live pre-merge; Rule 19 — CC cannot deploy). **FU banked:** garnish incentive-payments ledger source; skipped-month-blocking (CD#10, mockup "Blocked" state — out of brief-enumerated K6 scope); standalone Terms-screen DerivedTermsPanel (optional). |
| [#757](https://github.com/Kelsean868/agencytrack/pull/757) | `e2404be` | **fix(fu-h1): financing resilience — SettlementPanel nullish guard + 3-panel race tests + basisBadge dev-warn (Track K hardening)** (HUMAN-MERGE — money-adjacent `SettlementPanel`; **no rules, no deploy**). **Re-scoped at Phase 1 (dispatcher-confirmed):** the banked "SettlementPanel latest-request guard parity" premise did **not** hold — `SettlementPanel.loadData` is **tenantId-keyed** (unit-wide agent list + settlement history); agent selection is a **save-target form field only**, triggering no per-agent fetch, so the agentId-keyed stale-resolution money-write hazard the 3 financing panels guard **does not exist** there. **Decision 1 (SP guard) DROPPED — N/A, not "fixed."** Shipped: **(D2)** `(userList ?? [])` nullish guard on `SettlementPanel.loadData` (parity w/ financing panels); **(D3)** focused latest-request-race tests for the 3 panels that DO carry the `latestAgentReqRef` guard — new `FinancingTermsSetup.test.jsx` + `MonthlyStatementEntry.test.jsx`, appended case in `FinancingProrationPanel.test.jsx` (existing file had none); **(D4)** `FinancingBasisBadge` dev-only `console.warn` on unexpected `basisSource` (`import.meta.env.DEV`), unchanged production fallback (GLM nit). lint 0; full suite 3876/3876 (+5); build; hex clean. Banked LOW FU: `SettlementPanel.loadData` weak non-agentId overlap race (no money hazard). Carried: `FinancingTermsSetup` nullish-guard parity (1-token, out of locked D2 scope). |

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

**K9 — SHIPPED (PR #767, `d5c7b2a3`, 2026-07-01).** First subject-facing financing surface. `FinancingSelfView.jsx` (read-only, `{ tenantId, subjectUid }`) mounted in two places: agent's `AGENT_NAV` "Financing" tab and financed-UM's `PRODUCING_MANAGER_NAV` "My Production" `mp-financing` tab — same component, UM's own uid. SHOWN/PRIVATE field-projection contract: numbers-only view; `adjustmentPct` (clause-5.3 trigger ratio), `suggestedFinancing`, manager notes, all audit attribution, `statusHistory byName/role/note` absent from the DOM; `managerFinancing` relabeled "Your draw"; `statusHistory` renders `{from→to, at}` only. `getProjectedBonus` powers the take-home projection. For financed agents in a reconciled status (`post_financing_repayment`, `cleared`, `reconciling`), reconciliation figures (drawn, waiver, closing balance, outcome) are SHOWN; recon audit (`reconciledByName`, `triggeredBy`) absent. Absent-year recon reads are caught per-year (`.catch(() => null)`) — this is LOAD-BEARING: the `financingReconciliation` `allow get` rule keys on `resource.data.agentId` which is null for a missing doc → PERMISSION-DENIED, not null. No rules / functions / indexes added — all `canAccessOwn` arms were live from K1. 5 field-projection contract tests; 4043/4043 full suite; build; subject-signed-in smoke 23/23 PASS (agent leg + UM leg, both themes, value-level SHOWN + innerHTML PRIVATE-absence). UM unit-management half (managing the unit's financed agents) deferred to K10 — requires `unitId` stamp on financing docs + unit-scope rule + backfill migration. **Next: K10** (UM financing roster) or **K8** (New-Agent Validation Dashboard) — dispatcher-assigned.

**Prior — K7 cleanup — SHIPPED (PR #764, `fa5854a8`, 2026-06-26).** `FinancingRiskPanel.jsx` now filters `findAdjustmentFlags` output to `CONFIRMED_BASES` before surfacing the >10% notify affordance — matching the CF gate exactly. Provisional months (`submitted-provisional`) no longer show a dead-end Notify button. Two regression tests added (provisional-only → no affordance; confirmed + later provisional → confirmed is active duty). Live-fire verification script (`verify-financing-notify-k7-live.mjs`) committed from main worktree into `scripts/verification/` + cataloged in SMOKES.md. Data-safety CRITICAL fix in that script: `originalConfig` initialized to `null` (not `undefined`) so a pre-load setup failure never triggers a live-config delete; restore failures now emit `console.error` with MANUAL CHECK REQUIRED context instead of being silently swallowed. FOLLOW_UPS: provisional-flag LOW FU RESOLVED; pilot-prep CodeRabbit audit FU banked; script-hardening LOW FU banked (config-mutation window + ENOENT).

**Prior — K7 termination-risk monitor + clause-5.3 notify duty — SHIPPED — Phase 6 CF verification 10/10 PASS (PR #762, `8dc91d1e`, 2026-06-26).** FLAG ONLY (no `LEGAL_TRANSITIONS` change). `financingMissEngine.js`, `notifyFinancingAdjustment` CF (BM+-gated, transport reuse, NOT `sendComplianceNudge`), `FinancingRiskPanel.jsx` (6th FinancingTab subview). K7 ships ZERO `firestore.rules` changes — existing wildcard `config/{docId}` covers the config doc; Phase 6 = `firebase deploy --only functions` only. NEGATIVE legal-integrity proof: fabricated `adjustmentPct:0.99` on ≤10% ledger → CF returns `condition-not-met`, ZERO artifacts.


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
