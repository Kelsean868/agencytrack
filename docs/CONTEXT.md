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
| Last updated | **Nexus v2 promoted staging → production (2026-07-09/10, PR #849 merge `2c2932f3`).** Runs 1+2 of the Nexus v2 redesign (96 commits) went live in prod. Backend deployed first from the staging worktree: Firestore indexes (declined deletion of `prospectInfo` DESC + `jointCalls` composites), rules (+221 lines — `cro` role + Arm E, `appointments`, `recruitingCandidates`, WAR reviewer arm, `weeklyPlans.contactsMade→telContacts`), all 26 Cloud Functions redeployed (only logic delta: CREATION_MATRIX + `cro`), and the prod kiosk IAM grant (appspot SA → `serviceAccountTokenCreator`, unconditional). Verification-hygiene (VH) suite ran clean at the promoted staging tip (`24fa445f`): 32/32 clean + `t2-financing-k9-k7` cleared 3/3 isolated re-runs after an initial first-paint flake (33/33 effective). Phase 3 prod verification passed: feature flags fail-closed (`persistencyV2`/`policyLedgerCampaignLens`/`awardsProvenance` shells absent, no stray `featureFlags` field), agent + admin click-throughs clean, drag-reorder persisted, consoles clean incl. Financing/Report, motion accepted by eyeball (the `motion-verifier` script itself was skipped — `A11Y_*` creds unset in the promotion session). No prod CRO user was created (deferred operator decision). Post-merge cleanup: the stale `prospectInfo` DESC index (`CICAgNirolEK`) was deleted from the prod console. **Staging is now BEHIND main** (still at `24fa445f`) — a re-baseline (Phase 4.5) is a separate pending step, not done in this sync. Prior batch: Post-merge catch-up through PR #839 (`5283ab03`, 2026-07-08, 15 PRs #824–#839 — motion pop-in solved/field-verified, mobile nav v2, design-docs reconciliation, staging environment stood up) — archived to `docs/CONTEXT-history.md` this cycle per the cap. |
| Current main HEAD | `2c2932f3` (PR #849 **merge** commit — Nexus v2 Runs 1+2 promoted staging→prod, 2026-07-09/10; **NOT squashed**, merge commit, history preserved). Rollback anchor: `f595458a` (pre-promotion main tip, PR #846). **Prior:** `5283ab03` (PR #839 chore: staging environment setup, 2026-07-08). `9dcae1a3` (PR #805 EFF-004 YTD-reducer v2 fix — functions/ change, MERGED; **`firebase deploy --only functions` still PENDING**, see § Pending operational state). _(PR #804 `2b13bdd4` + earlier detail archived to `docs/CONTEXT-history.md` per the 3-entry Rule 16 cap.)_ |
| Active track | **Nexus v2 is now live in production** — the design-conformance backlog (`docs/audits/design-conformance-2026-07-07.md`, PR #836) is the active build map against a *shipped* redesign rather than a staging preview: ~92 MISSING findings, ~30 NEEDS-RULING (operator product calls pending), recommended sequence: systemic §1 four-states/§2 motion/§4 focus-trap/§5 dense-table contracts first, then nav (drag-reorder, ⌘K palette, admin ＋ FAB — all currently absent), then deliverables, then net-new surfaces (CRO, Meeting Mode v2, Kiosk v2, Settings v2). **Staging re-baseline (Phase 4.5) is queued but not started** — staging sits at `24fa445f`, behind prod's `2c2932f3`; the next autonomous/Fable build run against staging needs this re-baseline first. PR #848's hero-card conformance recon narrows part of the MISSING list to 7 concrete build items (see Recently shipped + FOLLOW_UPS.md). **Owner-owned, not yet scheduled:** EFF-004 functions deploy (see Pending operational state), EFF-002 Phase 2 + Rollup `manualChunks`, EFF-003/006/010/012-014/016/017, SEC-001..006/PRIV, App Check, dep CVEs. |
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
| Orphan cleanup | UID `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc with no Auth user | No | Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). **Also the sole null-unitId agent in `tatillife_south`** (#785 Phase 0.4 probe) — silently absent from every UM roster surface; resolve jointly per FOLLOW_UPS § null-unitId data fix (operator investigation first). |

---

## Recently shipped

| PR | SHA | Description |
|---|---|---|
| [#849](https://github.com/Kelsean868/agencytrack/pull/849) | `2c2932f3` (merge, not squashed) | **Nexus v2 promotion: staging → production (Runs 1+2, 96 commits).** The full Nexus v2 redesign batch (tokens/reskin, motion pop-in fixes, mobile nav v2, design-docs reconciliation, staging setup, plus final polish PRs #845–#848 including the wheel/trackpad scroll + single-line nav fix and the hero-card conformance recon) shipped from `staging` to `main` as a merge commit — history preserved, no squash. Backend deployed pre-merge from the staging worktree: Firestore indexes, +221 lines of rules (`cro` role/Arm E, `appointments`, `recruitingCandidates`, WAR reviewer arm, `weeklyPlans` field rename), all 26 Cloud Functions, and an unconditional prod kiosk IAM grant. VH suite 33/33 effective at the promoted tip; Phase 3 prod verification (flags fail-closed, click-throughs, drag-reorder, consoles, motion-by-eyeball) passed. Stale `prospectInfo` DESC index deleted post-merge. **Staging now trails main** (`24fa445f`) pending a Phase 4.5 re-baseline. Full runbook: `docs/runbooks/` Nexus v2 promotion docs (PR #845/#846). |
| [#839](https://github.com/Kelsean868/agencytrack/pull/839) | `5283ab03` | **chore: staging environment setup (isolated from prod)** — repo-side config + operator runbook for an isolated `agencytrack-staging` Firebase project so autonomous work can run without any ability to reach prod. `.firebaserc` staging alias, `.env.staging.example` (flags `VITE_VALIDATE_KIOSK_TOKEN_URL` as mandatory — without it the kiosk falls back to prod's CF), 3 guarded scripts: `verify-isolation.mjs` (the safety gate — static config/leak checks always run, live Firestore write-read-delete round trip behind `--live`), `seed-staging.mjs` (synthetic `staging_test` tenant, aborts unless the credential's `project_id` is `agencytrack-staging`), `deploy-staging.ps1` (staging-only guarded deploy, aborts if the active project resolves to prod). Isolation is structural — project-scoped service-account credentials can't authenticate against prod by construction — and holds as long as the staging SA is never granted IAM on the prod project. **Operator completed the console setup (project, Firestore, auth, Vercel env) and ran `verify-isolation.mjs --live` — isolation VERIFIED live**, clearing the gate for the imminent Fable autonomous build run against staging. CC does not deploy (Rule 19) — Parts A/E of the runbook are operator-only. |
| [#834](https://github.com/Kelsean868/agencytrack/pull/834) + [#835](https://github.com/Kelsean868/agencytrack/pull/835) | `cf4d4625` / `77d86749` | **feat: mobile nav reorder v2 + More sheet v2.** #834 moves Profile out of the bottom nav into the More drawer (injected for every role) and centers the FAB in the v2 5-slot layout (`2 tabs · center ＋ · 2 tabs · More`); sign-out deliberately stays inside the Profile screen, not the drawer. #835 upgrades the drawer from a flat overflow list to the designed surface per the redesign addendum: mono-uppercase **grouped sections** mirroring the desktop sidebar (`navSections.buildSectionMap` fills-forward section labels across the full role nav so a filtered-out lead item doesn't orphan its section), an auto **Frequent** row (`useFrequentNav` — localStorage-only per-user top-3 most-visited, deliberately not Firestore-synced), and a fixed-header/scrolling-catalog/fixed-footer layout ending in a filled primary **Done** button. Pure frontend, no `functions/`/rules/tokens/desktop-nav changes. 4300/4300 tests (+19 new, incl. `useFrequentNav`). |
| [#824](https://github.com/Kelsean868/agencytrack/pull/824)–[#833](https://github.com/Kelsean868/agencytrack/pull/833) | `f80d5ba1`…`13986687` | **Motion pop-in: verifier built, agent Game Plan SOLVED (field-verified), reusable skeleton kit harvested.** #824 built a read-only CDP/Playwright motion-jank verifier (`motion-verifier.mjs` + Python frame-diff analyzer) measuring the gap between `screen-enter` fade-end and content actually settling; first diagnostic found the pop-in is a mount-fetch loading-state defect app-wide, worst on Game Plan (36.6% late-DOM). #826 POC'd a **data-gated whole-screen entrance** for agent Game Plan (hold the fade until `!loading && !error`, 400ms cap) — datacenter-only measurement initially looked clean but field re-measurement showed the cap still fired on 100% of cold loads at Slow 4G (game-plan's critical path is ~1 Firestore round-trip). #829 (stacked on #826) added **dashboard-idle prefetch** — 3 warm `onSnapshot` listeners on the year docs, attached while the dashboard is idle so the later `getDoc` resolves from cache — and this is what actually made it field-robust: at Slow 4G, `contentReady` went from 670ms/5-of-5 cap-fires to **~23ms/0-of-5**, **0/30 visible frame-pops across the full network-latency matrix**. #831 fixed a Game Plan section-spacing regression surfaced along the way. #833 swept all 5 reachable roles (`--sweep` mode) and confirmed the pattern is pervasive (~half of data-backed tabs pop app-wide, worst on shared panels reused across roles) and that the #829 fix is **agent-only so far** — `mp-game-plan` for BM/UM still fails; full skeleton-vs-prefetch split and rollout order in `docs/audits/popin-allroles-sweep-2026-07-07.md`. #832 harvested the abandoned skeleton branch into a standalone, reduced-motion-safe **`PanelSkeleton` kit** (`src/components/ui/PanelSkeleton.jsx` — list/card-grid/metric-row/table variants) — **kit only, not yet wired into any live panel**. #830 recon'd React Query adoption for the rollout and recommended **DON'T-ADOPT now** — the pop-in is a loading-state defect that skeletons fix directly; React Query would be an optional caching layer, revisit only on a real caching trigger (see `docs/FOLLOW_UPS.md`). Net shipped to live panels from this program: the agent Game Plan gating+prefetch (#826/#829) and the spacing fix (#831) — the skeleton rollout itself remains unbuilt. |
| [#827](https://github.com/Kelsean868/agencytrack/pull/827) + [#828](https://github.com/Kelsean868/agencytrack/pull/828) + [#836](https://github.com/Kelsean868/agencytrack/pull/836) + [#837](https://github.com/Kelsean868/agencytrack/pull/837) + [#838](https://github.com/Kelsean868/agencytrack/pull/838) | `eaeb1264`…`3013c4e5` | **Design-system docs reconciled; #836 is now the active build map.** #827 reconciled the two competing DS migration-plan docs against what actually shipped (token-foundation reskin EXECUTED per `INTEGRATION.md`; per-screen port ["Track-J"] PARTLY done) — marked the stale v1 plan SUPERSEDED, extracted the still-pending Track-J list (J2 nav-group content deltas, state-design wiring, per-screen glass discipline, CRO delivery register, transactional email templates, JetBrains Mono self-host). #828 mapped all 34 canonical v2 screen mockups: 27 REDESIGN / 5 RESKIN / 2 mixed, ~2/3 shipped (16 SHIPPED / 6 PARTIAL / 12 PENDING) — corrected 5 screens the migration doc had wrongly marked Built (Master Sheet, Weekly WARs, Monthly Recruiting, Campaigns, Meeting Mode all have 0 live v2 mechanics). **#836 is the new active build map:** an app-wide feature-level *conformance* audit (does each live screen match the design's intended features/sections/states/behaviors, not just "does the component exist") found **~92 MISSING**, ~30 NEEDS-RULING (operator product calls), ~22 DELIBERATE-DIVERGENCE, ~55 COSMETIC — recommended sequence: systemic §1 four-states/§2 motion/§4 focus-trap/§5 dense-table contracts first (cheapest per-screen, biggest reliability win), then nav (drag-reorder, ⌘K palette, admin ＋ FAB all currently absent), then deliverables, then net-new surfaces (CRO, Meeting Mode v2, Kiosk v2, Settings v2). Full backlog: `docs/audits/design-conformance-2026-07-07.md`. #837 added a canonical-sources precedence note to CLAUDE.md (app rules → `screens-v2/*.html` mockups = design intent → tokens) + a new `DESIGN-FOLDER-CATALOG.md` classifying the 1,244-tracked-file mixed-generation design folder. #838 executed the salvage→verify→delete dedupe on that catalog: byte-identical duplicate folders (2 Planner handoffs, superseded Game Plan Loop handoff, 3 duplicate financing reference files) had their unique content ported forward, then were deleted; reconciled the catalog's UNCLEAR list (4 resolved, 3 new items surfaced and left open). All five PRs are docs-only — no `src/`/`functions/` changes. |
_(EFF-004/#805, EFF-002/#804, EFF-Phase1/#802, SEC-012/#801, and the #794–#799 autonomous-run program — the 5 rows this batch replaced — archived to `docs/CONTEXT-history.md` in the 2026-07-08 post-merge sync. #805's functions-deploy-pending status carries forward in § Pending operational state, not lost.)_

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
- ~~**Clarity operator activation (PR #786, 2026-07-03)**~~ **RESOLVED 2026-07-03** — operator completed all 3 steps (project created, dashboard masking set to STRICT, `VITE_CLARITY_PROJECT_ID` set Production-only + redeployed) and playback-verified the live recording with Money Needs figures masked. Clarity is live and privacy-gated as designed.
- **⚠️ EFF-004 functions deploy still PENDING (PR #805, `9dcae1a3`, merged 2026-07-05).** The MDRT-badge YTD-reducer fix (v2 `newBusiness.api` counting) is merged to `main` but not yet deployed — `firebase deploy --only functions` has not run. A live post-deploy smoke against `tatillife_smoke` proved the bug is real in production data (540,554 real v2 YTD, no `mdrt_qualified` badge) and confirmed the fix is not yet live. Operator action: `firebase deploy --only functions`, then re-run the smoke in `docs/audits/mixed-run-2026-07-05/` to confirm the badge appears. Not superseded by any PR in the #824–#839 batch (no functions/ changes in that batch).
- **Staging environment (`agencytrack-staging`) is live and isolation-verified (PR #839, 2026-07-08)** — the imminent Fable autonomous build run targets this project, not prod. Console setup steps (E — deploy rules/indexes/functions to staging; F — push a `staging` branch) may still be outstanding; confirm with the operator before assuming the environment is fully seeded for the run.
- **⚠️ Staging branch is now BEHIND `main` (as of the 2026-07-09/10 promotion, PR #849).** Staging tip is `24fa445f`; prod/main is `2c2932f3`. Re-baseline staging from main (Phase 4.5) before dispatching any further work against staging — do not assume staging reflects the promoted state. This is a separate step from the `agencytrack-staging` Firebase-project isolation setup above (git-branch drift, not Firebase-project drift).
- **Prod CRO user not created.** The promotion deployed the `cro` role + rules/Arm E backend support, but no CRO account exists in production yet — deferred as an operator business decision, not a technical blocker.

---

## Where we left off

**Nexus v2 promoted staging → production, Runs 1+2 (PR #849 merge `2c2932f3`, 2026-07-09/10).** The full redesign (96 commits) is now live in prod, backend-first: indexes, +221 lines of rules (`cro` role/Arm E, `appointments`, `recruitingCandidates`, WAR reviewer arm, `weeklyPlans` field rename), all 26 functions, and the prod kiosk IAM grant were deployed from the staging worktree before the merge landed. VH suite 33/33 effective; Phase 3 prod verification (flags fail-closed, agent/admin click-throughs, drag-reorder persistence, clean consoles, motion accepted by eyeball) passed; stale index cleaned up post-merge. **Open threads from this promotion:** (1) staging is now behind main (`24fa445f` vs `2c2932f3`) — Phase 4.5 re-baseline is queued, not done; (2) no prod CRO user exists yet (operator decision, deferred); (3) PR #848's hero-card conformance recon narrowed part of the #836 design-conformance MISSING list to 7 concrete build items (Daily Capture anchor hero, Prospect Prep hero — feature not built at all, shared Financing self-view hero, UM Team Reports hero-class gap, My WAR hero, Money Needs hero flag-flip, Meeting Mode opening-slide hero) — banked to FOLLOW_UPS.md this cycle as Run-3 candidates. Eight new follow-ups banked from this session (seeder env-file foot-gun, VH flaky leg, MasterSheet stale key, index-file drift, stale prod IAM binding, Node 20 deadline reminder, tier0-smoke branch rebase, motion-verifier prod creds) — see FOLLOW_UPS.md. **Next:** operator re-baselines staging from main before dispatching the next autonomous run; sequence the design-conformance backlog (now against live prod) starting with the systemic §1–§5 contract sweep; separately, EFF-004's `firebase deploy --only functions` remains PENDING from the prior session (unrelated to this promotion — no functions/ delta in the #824–#839 batch, but this promotion's OWN function/rules/index deploy already occurred as part of Phase 2 above).

**Post-merge catch-up through PR #839 (`5283ab03`, 2026-07-08) — CONTEXT.md/FOLLOW_UPS.md synced after a 15-PR batch.** The batch closed out four threads (detail in § Recently shipped): motion pop-in is SOLVED and field-verified for agent Game Plan (data-gated entrance + dashboard-idle prefetch, #826/#829 — 0/30 visible pops across the full network-latency matrix at Slow 4G), with the pattern confirmed app-wide by an all-roles sweep (#833) and a reusable skeleton kit harvested for the rollout (#832, not yet wired anywhere); mobile nav v2 shipped (Profile → More drawer, centered FAB, grouped sections + Frequent row + Done button, #834/#835); the design-system docs were reconciled against actual shipped state and **the design-conformance audit (#836, ~92 MISSING findings) is now the active build map**; and a **staging environment (`agencytrack-staging`) was stood up and isolation-verified live** (#839), unblocking an imminent Fable autonomous build run against staging instead of prod. React Query adoption was recon'd and explicitly deferred (DON'T-ADOPT now, #830). **Nothing in this batch touched `functions/` or `firestore.rules`** — the EFF-004 functions deploy from the prior session (PR #805) remains PENDING and is tracked in § Pending operational state, not resolved by this batch. **Next:** operator rules on the #836 NEEDS-RULING list (command palette, Persistency v2 model, Policy Ledger provenance, Settings v2 scope, etc.) to unblock sequencing the conformance backlog; confirm staging Parts E/F (deploy + branch) are complete before the Fable run starts; separately, the still-pending EFF-004 deploy needs an operator `firebase deploy --only functions` + re-smoke.

**EFF-004 YTD-reducer v2 correctness fix — MERGED, deploy PENDING (PR #805, `9dcae1a3`, 2026-07-05).** The mixed-run orchestrator's priority item (`docs/briefs/orchestrator-10h-mixed-run.md`). `onSubmissionWrite`'s YTD scan summed flat `apiSold` only, so every v2 (`newBusiness.api`) submission counted 0 → tenured v2 agents' `mdrt_qualified`/`mdrt_pace` badge YTD was undercounted. Fixed to sum via the canonical `extractTotalProductionCredit` (NB.api + PPP.apiIncrease + LMPS.apiCredit; v1 fallback), matching `leaderboard/rankingLogic.js` (ranking) + `src/hooks/useMyProduction.js` (HeroCard) — so the badge stays consistent with the leaderboard doc it is written onto. functions jest 350/350 (6 new cases), root vitest 4228/4228, lint/build clean. **⚠️ MERGED ≠ DEPLOYED:** a live post-deploy smoke against `tatillife_smoke` (Admin SDK) both **proved the bug in live data** — the smoke agent has **540,554** of real v2 YTD but no `mdrt_qualified` badge — **and detected the fix is not yet live**: a fresh v2 submission advanced `weeklyStreak` (the trigger ran) but withheld the badge, so the deployed reducer still computes the old flat-`apiSold` YTD (=0). **Awaiting operator `firebase deploy --only functions`, then a re-smoke to confirm the badge appears** (idempotent script in `docs/audits/mixed-run-2026-07-05/`; the write only touches the isolated `tatillife_smoke` tenant). Bot disposition (Rule 21): Gemini HIGH year-rollover (pre-existing `new Date().getFullYear()`) → OUT-OF-SCOPE, banked as a `weekStarting`-year money-math FU (not unilaterally extended — Rule 9); Gemini MED test-rot + CodeRabbit deploy-reminder → ALREADY-RESOLVED. **Also this run:** EFF-006 (event-driven leaderboard cron) + EFF-015 (region/memory) PARKED with recon; Lane 2 thin (0 auto-merges); Lane 3 recon → `docs/audits/mixed-run-2026-07-05/NEXT-WINDOW-BACKLOG.md` (headline: EFF-002 Phase 2 + Rollup `manualChunks`). Docs PR #806 (`5b739457`) merged. **Next:** deploy #805 + re-smoke; then brief EFF-006 → EFF-015 (after Firestore-region confirm) → EFF-002 Phase 2; land the 3 EFF-004 FUs (backfill · threshold 500k-vs-688,800 · year-attribution) + the Lane-2-banked frontend items (A11Y-101/102 modal focus is the cleanest) into `docs/FOLLOW_UPS.md`.

_(EFF-002/#804 "Where we left off" paragraph moved to `docs/CONTEXT-history.md` — archived 2026-07-09 when the Nexus v2 promotion/#849 entry above landed, exceeding the 3-entry cap. SEC-012/#801 + prior "Autonomous-run polish program #794–#799" + Fork B3/#790 + Window-3 serial run/#787–#789 + Fork B1/#787 + Clarity/#786 + PR-GPM1 Team Plans Reader/#785 + the Orchestrated-window 2026-07-02 recap already there.)_

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
