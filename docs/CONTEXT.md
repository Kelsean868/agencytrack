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
| Last updated | **Runs 5-7 promoted staging → production (2026-07-15, PR #858 merge `10670bd7`, 82 commits).** Fable Run 5 (Company Config slice 1: diff-only config substrate, 46-item real-defaults registry, 12-section registry-driven tenant-admin surface, live-wired Activity Standards + Feature Flags + Awards & Clubs, `configAudit`/`featureFlags`-allowlist rules) + Run 5 rulings fast-follow + Run 6 (Organization crash fix, campaign persistency-gate registry rows) + Run 7 (full Tier-0 systemic sweep, **SEC-012** kiosk degraded-names fix, WizardForm draft-load guard, seeder residue fix) shipped from `staging` to `main` as a **merge commit** — history preserved, no squash. Backend delta was **rules-only** (three additive arms, flag-reviewed safe): `configAudit` create-only collection; `featureFlags` diff-scoped allowlist guard; `managerActivityStandardOverrides` read-only list arm. No index or functions changes. Old-frontend config-write health check passed. Prod verification passed on `portal.agencytrack.app`: 12 sections render, flags fail-closed, kiosk real names, consoles clean — **note:** a first verification pass mistakenly targeted the non-canonical `agencytrack.vercel.app` alias and produced a false-crash/rollback scare before being corrected; the canonical host (`portal.agencytrack.app`, CONTEXT.md § App host) passed every check cleanly (HIGH follow-up banked to hard-pin verification tooling — FOLLOW_UPS.md). Rollback anchor: `20a64a33` (pre-promotion main tip, PREPROMOTION_MAIN_SHA — keep 24-48h). **Staging re-baseline is pending — now three promotions behind** (Nexus v2/#849, Runs 3+4/#853, Runs 5-7/#858), never done across any of them. Prior batch: Runs 3+4 + polish promotion (PR #853, `0d5662ef`, 2026-07-10, 45 commits) — archived to `docs/CONTEXT-history.md` this cycle per the cap. |
| Current main HEAD | `10670bd7` (PR #858 **merge** commit — Runs 5-7 promoted staging→prod, 2026-07-15; **NOT squashed**, 82 commits, history preserved). Rollback anchor: `20a64a33` (pre-promotion main tip). **Prior:** `0d5662ef` (PR #853 merge — Runs 3+4 + polish promoted, 2026-07-10). `2c2932f3` (PR #849 merge — Nexus v2 Runs 1+2 promoted, 2026-07-09/10). _(`5283ab03`/PR #839 staging environment setup + earlier detail archived to `docs/CONTEXT-history.md` per the 3-entry Rule 16 cap.)_ |
| Active track | **Nexus v2 + Runs 1-7 are now live in production.** The design-conformance backlog `docs/audits/design-conformance-2026-07-07.md` (PR #836) is **SUPERSEDED by [`docs/audits/design-conformance-2026-07-12.md`](docs/audits/design-conformance-2026-07-12.md)** — a full Rule-17 revalidation against staging HEAD `e65fe143` that found ~76% of the old ~92 MISSING findings already shipped across Runs 1–5 (the systemic §1–§5 contract debt is largely paid down). The 2026-07-12 doc's §4 STILL-VALID backlog (~24 open + ~26 partial-residuals) is what remains, **and its Tier-0 systemic sweep (§1 four-states/§2 motion/§4 focus-trap/§5 dense-table) SHIPPED this promotion (Run 7)** — the backlog's remaining blocker is its 14-item NEEDS-RULING operator-decision list (FOLLOW_UPS.md § Design-conformance backlog), unchanged. **Company Config v2 is now IN PROGRESS, not just planned** — Slice 1 shipped this promotion (Run 5): the 12-section registry-driven tenant-admin surface, diff-only config substrate, 3 sections live-wired (Targets & Minimums, Activity Standards, Awards & Clubs) + fail-closed Feature Flags; Tier 1 build-out for the remaining read-only sections, Tier 2 (ESM/CJS `gamificationConfig` drift fix), and Tier 3 rules work are still ahead (FOLLOW_UPS.md § Company Config v2). Runs 6-7 additionally shipped SEC-012's kiosk degraded-names fix (real names from submission docs) and a WizardForm draft-load silent-overwrite guard (see Recently shipped). **Staging re-baseline is queued but not started — now three promotions behind** (Nexus v2, Runs 3+4, Runs 5-7); staging's own tip predates all three; the next autonomous/Fable build run against staging needs this re-baseline first, and it should not be deferred again. 6 new follow-ups banked this cycle (prod-verification tooling must hard-pin `portal.agencytrack.app` — HIGH, caused a rollback scare this promotion; investigate the stray `agencytrack.vercel.app` deployment; `featureFlags` triple-copy Tier-2 note; `t1-compliance-scope` VH seed gap carried forward; Run-7 ranked next-list carried forward; Run-7 DECISIONS-NEEDED noted empty — see FOLLOW_UPS.md). **Owner-owned, not yet scheduled:** EFF-004 functions deploy (see Pending operational state), EFF-002 Phase 2 + Rollup `manualChunks`, EFF-003/006/010/012-014/016/017, SEC-001..006/PRIV, App Check, dep CVEs. |
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
| [#858](https://github.com/Kelsean868/agencytrack/pull/858) | `10670bd7` (merge, not squashed) | **Runs 5-7 promotion: staging → production (82 commits).** Fable Run 5 (Company Config slice 1: diff-only config substrate — `configService`/`configAuditService`/`ConfigProvider`+`useConfig`, forward-only; 46-item real-defaults registry; the 12-section registry-driven tenant-admin surface with five-state row grammar, ⌘F palette, history drawer, draft/save lifecycle, mobile drill-in; live-wired Activity Standards + Feature Flags + Awards & Clubs; Targets & Minimums read-only + legacy-editor drawer; `configAudit` append-only rules arm + `featureFlags` allowlist guard) + Run 5 rulings fast-follow (override-count indicator, palette-value honesty) + Run 6 (Organization-section crash fix, campaign persistency-gate band rows in the Recognition registry, new VH legs) + Run 7 (full Tier-0 systemic sweep — four-states/swallow-disposition incl. the dead-error-card reconnect fix, focus-trap verify, dense-table, motion; **SEC-012** kiosk degraded-names fix — real agent names sourced from kiosk-readable submission docs, zero new read surface, no rules widening; WizardForm draft-load silent-overwrite guard; week-rollover seeder residue bug fix) shipped from `staging` to `main` as a **merge commit** — history preserved, no squash. **Backend delta was rules-only** (three additive arms, flag-reviewed safe): `configAudit` create-only collection; `featureFlags` allowlist (diff-scoped guard on `config/settings` — evaluates only changed flag keys, empty-diff passes); `managerActivityStandardOverrides` read-only list arm (TA/PA). No index or functions changes. Old-frontend config-write health check passed (Activity Standards save/reload both directions, console clean). Prod verification passed on `portal.agencytrack.app`: all 12 Company Config sections render, feature flags fail-closed (no stray `featureFlags` field), kiosk shows real agent names, consoles clean. **Note:** a first verification pass mistakenly ran against `agencytrack.vercel.app` (non-canonical alias) and produced false crash reports / a rollback scare before being corrected to the canonical `portal.agencytrack.app` host, where every check passed cleanly — banked as a HIGH follow-up to hard-pin verification tooling (FOLLOW_UPS.md). **Staging re-baseline still pending** — now three promotions behind (Nexus v2/#849, Runs 3+4/#853, Runs 5-7/#858) without ever re-baselining. |
| [#853](https://github.com/Kelsean868/agencytrack/pull/853) | `0d5662ef` (merge, not squashed) | **Runs 3+4 + polish promotion: staging → production (45 commits).** Fable Run 3 (seeder env-file guard, `t2-financing-k9-k7` first-paint hardening, MasterSheet contactsMade→personsReached column collapse, WAR owner review-status pill C3, My WAR hero, UM Unit Aggregate hero parity, filing-streak milestones 5/10/25/52wk C4, pin de-emphasis v1, planner appointment edit-in-place, WAR week-selector navigation-trap fix) + Fable Run 4 (8-stage funnel-edition Master Sheet rebuild with pure `funnelModel.js`, filters panel with `funnelFilters.js`, FunnelMeetingScene sheet-in-the-room, streak-celebration skin-only reskin, planner recurrence — series create/postpone-one/dimmed-retained via extended `validApptWrite()`, 1-on-1 takeover recon doc) + a follow-on polish batch (pin de-emphasis v2 — filled star zone-gated to the Pinned section only, Settings "Default Master Sheet preset" repurposed to "Default RANK BY") shipped from `staging` to `main` as a **merge commit** — history preserved, no squash. **Backend delta was rules-only** (+8/-1 lines): `validApptWrite()` extended with 5 optional recurrence keys (`seriesId`/`repeatRule`/`daysOfWeek`/`seriesPos`/`seriesTotal`), guard-if-present pattern, `hasAll` untouched — old-frontend appointment writes verified unaffected by the new optional fields. No index or functions changes. Phase 3 prod verification passed: feature flags still fail-closed (no stray `featureFlags` field), funnel Master Sheet renders with correct KPI sums, Planner recurrence full round-trip (create series → postpone one instance → dimmed-retained, series intact) verified live, Meeting Mode funnel scene renders, consoles clean. Full run logs: `docs/fable-run3-progress.md` + `docs/fable-run4-progress.md`; polish PR [#852](https://github.com/Kelsean868/agencytrack/pull/852); tenant-config audit correction [#851](https://github.com/Kelsean868/agencytrack/pull/851) (separate branch, still open). **Staging re-baseline still pending** — staging's own tip (`063dd12e`) predates this merge. |
| [#849](https://github.com/Kelsean868/agencytrack/pull/849) | `2c2932f3` (merge, not squashed) | **Nexus v2 promotion: staging → production (Runs 1+2, 96 commits).** The full Nexus v2 redesign batch (tokens/reskin, motion pop-in fixes, mobile nav v2, design-docs reconciliation, staging setup, plus final polish PRs #845–#848 including the wheel/trackpad scroll + single-line nav fix and the hero-card conformance recon) shipped from `staging` to `main` as a merge commit — history preserved, no squash. Backend deployed pre-merge from the staging worktree: Firestore indexes, +221 lines of rules (`cro` role/Arm E, `appointments`, `recruitingCandidates`, WAR reviewer arm, `weeklyPlans` field rename), all 26 Cloud Functions, and an unconditional prod kiosk IAM grant. VH suite 33/33 effective at the promoted tip; Phase 3 prod verification (flags fail-closed, click-throughs, drag-reorder, consoles, motion-by-eyeball) passed. Stale `prospectInfo` DESC index deleted post-merge. **Staging now trails main** (`24fa445f`) pending a Phase 4.5 re-baseline. Full runbook: `docs/runbooks/` Nexus v2 promotion docs (PR #845/#846). |
| [#839](https://github.com/Kelsean868/agencytrack/pull/839) | `5283ab03` | **chore: staging environment setup (isolated from prod)** — repo-side config + operator runbook for an isolated `agencytrack-staging` Firebase project so autonomous work can run without any ability to reach prod. `.firebaserc` staging alias, `.env.staging.example` (flags `VITE_VALIDATE_KIOSK_TOKEN_URL` as mandatory — without it the kiosk falls back to prod's CF), 3 guarded scripts: `verify-isolation.mjs` (the safety gate — static config/leak checks always run, live Firestore write-read-delete round trip behind `--live`), `seed-staging.mjs` (synthetic `staging_test` tenant, aborts unless the credential's `project_id` is `agencytrack-staging`), `deploy-staging.ps1` (staging-only guarded deploy, aborts if the active project resolves to prod). Isolation is structural — project-scoped service-account credentials can't authenticate against prod by construction — and holds as long as the staging SA is never granted IAM on the prod project. **Operator completed the console setup (project, Firestore, auth, Vercel env) and ran `verify-isolation.mjs --live` — isolation VERIFIED live**, clearing the gate for the imminent Fable autonomous build run against staging. CC does not deploy (Rule 19) — Parts A/E of the runbook are operator-only. |
| [#834](https://github.com/Kelsean868/agencytrack/pull/834) + [#835](https://github.com/Kelsean868/agencytrack/pull/835) | `cf4d4625` / `77d86749` | **feat: mobile nav reorder v2 + More sheet v2.** #834 moves Profile out of the bottom nav into the More drawer (injected for every role) and centers the FAB in the v2 5-slot layout (`2 tabs · center ＋ · 2 tabs · More`); sign-out deliberately stays inside the Profile screen, not the drawer. #835 upgrades the drawer from a flat overflow list to the designed surface per the redesign addendum: mono-uppercase **grouped sections** mirroring the desktop sidebar (`navSections.buildSectionMap` fills-forward section labels across the full role nav so a filtered-out lead item doesn't orphan its section), an auto **Frequent** row (`useFrequentNav` — localStorage-only per-user top-3 most-visited, deliberately not Firestore-synced), and a fixed-header/scrolling-catalog/fixed-footer layout ending in a filled primary **Done** button. Pure frontend, no `functions/`/rules/tokens/desktop-nav changes. 4300/4300 tests (+19 new, incl. `useFrequentNav`). |
_(#824–#833 motion pop-in program — the row this cycle replaced — archived to `docs/CONTEXT-history.md`. #827+828+836+837+838 design-docs-reconciliation batch, EFF-004/#805, EFF-002/#804, EFF-Phase1/#802, SEC-012/#801, and the #794–#799 autonomous-run program archived in earlier post-merge syncs. #805's functions-deploy-pending status carries forward unchanged in § Pending operational state, not lost.)_

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
- **⚠️ Staging branch is now BEHIND `main` by THREE promotions (Nexus v2/#849, Runs 3+4/#853, Runs 5-7/#858) — re-baseline has never happened.** Staging's tip at the Runs 5-7 merge was `cfdd0a64` (the staging-side parent of merge commit `10670bd7`); prod/main is now `10670bd7`. Re-baseline staging from main before dispatching any further Fable/autonomous work against staging — do not assume staging reflects any promoted state, this drift is now compounding across three cycles. This is a separate step from the `agencytrack-staging` Firebase-project isolation setup above (git-branch drift, not Firebase-project drift).
- **Prod CRO user not created.** The promotion deployed the `cro` role + rules/Arm E backend support, but no CRO account exists in production yet — deferred as an operator business decision, not a technical blocker.

---

## Where we left off

**Runs 5-7 promoted staging → production (PR #858 merge `10670bd7`, 2026-07-15).** Fable Run 5 (Company Config slice 1: diff-only config substrate — `configService`/`configAuditService`/`ConfigProvider`+`useConfig`; 46-item real-defaults registry with 36 parity tests; the 12-section registry-driven tenant-admin surface with five-state row grammar, ⌘F palette, history drawer, draft/save lifecycle, mobile drill-in; live-wired Activity Standards + Feature Flags + Awards & Clubs; `configAudit` append-only + `featureFlags` allowlist rules) plus a Run 5 rulings fast-follow (override-count indicator, palette-value honesty) plus Run 6 (Organization-section crash fix, campaign persistency-gate registry rows, two new VH legs) plus Run 7 (full Tier-0 systemic sweep — four-states/swallow-disposition incl. the dead-error-card reconnect, focus-trap verify, dense-table, motion; **SEC-012** kiosk degraded-names fix — real names sourced from kiosk-readable submission docs, zero new read surface, no rules widening; WizardForm draft-load silent-overwrite guard; week-rollover seeder residue bug fix) shipped as an 82-commit merge commit, history preserved, no squash. Backend delta was **rules-only** (three additive arms, flag-reviewed safe): `configAudit` create-only collection; `featureFlags` diff-scoped allowlist guard (empty-diff passes); `managerActivityStandardOverrides` read-only list arm (TA/PA). No index or functions changes this cycle. Old-frontend config-write health check passed (Activity Standards save/reload both directions, console clean). Prod verification passed on `portal.agencytrack.app`: all 12 Company Config sections render without an error boundary, feature flags still fail-closed (all 3 shells `NOT SET → OFF`, no stray `featureFlags` field), kiosk shows real agent names (not the degraded "Agent" fallback), consoles clean throughout.

**Verification mishap this promotion (bank the lesson, don't repeat it):** the first prod-verification pass targeted `https://agencytrack.vercel.app` — a non-canonical alias, not the locked App-host invariant (`portal.agencytrack.app`, CONTEXT.md § App host) — and produced false crash reports that triggered a rollback scare before the wrong-URL mistake was caught and corrected. Every check then passed cleanly against the real canonical host. Banked as a HIGH follow-up (FOLLOW_UPS.md § Prod-verification tooling) to hard-pin `portal.agencytrack.app` and reject `*.vercel.app` in verification tooling going forward; a second follow-up asks someone to confirm what the stray `agencytrack.vercel.app` deployment actually is and whether to retire it.

**Open threads from this promotion:** (1) staging is now **three promotions behind main** (Nexus v2/#849, Runs 3+4/#853, Runs 5-7/#858) — re-baseline has never happened across any of them, not done in this sync; (2) Company Config v2 is IN PROGRESS not just planned — Slice 1 shipped, Tier 1 build-out for the remaining 8 read-only sections + Tier 2 (needs the ESM/CJS `gamificationConfig` drift fix first) + Tier 3 rules work are still ahead; (3) the design-conformance backlog's Tier-0 systemic sweep is DONE but its 14-item NEEDS-RULING operator-decision list is untouched and still blocks sequencing past it; (4) the SEC-012 kiosk fix closed the "real names" half of a previously-banked follow-up but roster-only panels (photos/celebrations/compliance) still degrade — needs a CF-written branch-roster aggregate (FOLLOW_UPS.md); (5) 6 new follow-ups banked — prod-verification URL hard-pin (HIGH), stray `agencytrack.vercel.app` deployment investigation, `featureFlags` triple-copy Tier-2 consolidation note, the `t1-compliance-scope` VH seed gap (carried Run 6→7, still needs a 2nd `unit_manager` fixture), the Run-7 ranked next-list (Persistency KPI card, kiosk roster parity, campaign proof export, Team Dashboard #6 remainder, build-map next-window candidates), and a note that Run 7 banked no new DECISIONS-NEEDED (Run 6's 5 were all closed this run). **Next:** operator re-baselines staging from main before dispatching further Fable work (now genuinely overdue); sequence the Company Config v2 Tier 1/2/3 rollout; work the design-conformance 14-item NEEDS-RULING list to unblock the rest of that backlog; separately, EFF-004's `firebase deploy --only functions` remains PENDING from an earlier, unrelated session.

**Runs 3+4 + polish promoted staging → production (PR #853 merge `0d5662ef`, 2026-07-10).** Fable Runs 3+4 (funnel-edition Master Sheet rebuild + `funnelModel.js`, filters panel + `funnelFilters.js`, FunnelMeetingScene, streak-celebration reskin, planner recurrence, 1-on-1 takeover recon) plus a follow-on polish batch (pin de-emphasis v2, Settings "Default RANK BY") shipped as a 45-commit merge commit, history preserved, no squash. Backend delta was **rules-only**: `validApptWrite()` extended with 5 optional recurrence keys (`seriesId`/`repeatRule`/`daysOfWeek`/`seriesPos`/`seriesTotal`), guard-if-present pattern, `hasAll` untouched — old-frontend appointment writes verified unaffected; no index or functions changes this cycle. Phase 3 prod verification passed: feature flags still fail-closed, funnel Master Sheet renders with correct KPI sums, Planner recurrence full round-trip (create series → postpone one → dimmed-retained, series intact) verified live, Meeting Mode funnel scene renders, consoles clean.

**Open threads from this promotion:** (1) staging is now behind main (`063dd12e` vs `0d5662ef`) — re-baseline is pending, not done in this sync; (2) 3 Run-4 operator rulings recorded as settled in FOLLOW_UPS.md (funnel FLAGGED-A/B mappings kept as built, Settings preset repurpose shipped in the polish batch); (3) 16 new follow-ups banked — recurrence `ENDS=Never` + edit-this-and-all-future (share composite-index work), Master Sheet STATUS/LEVEL filters, unit friendly names, a converted-service-calls Company Config toggle (do not build until ruled), pre-promotion manual checks not done this cycle (celebration reskin reduced-motion+dark, funnel projection-scene axe, filters-popover dark contrast), the 1-on-1 takeover's 10 open design questions, an MDRT naming collision, a stale financing-ruleset code comment, the Node-20 decommission deadline (already tracked, not duplicated), the post-Gemini-sunset reviewer decision (already tracked, refreshed), Vercel preview env-scoping confirmation, Vitest Windows worker-contention serialization, a new validity-SHA standing rule for recon docs, and **Company Config v2** as the next major track (every business-policy constant tenant-configurable, 3-tier plumbing, grounded in `docs/audits/tenant-config-audit-2026-07-10.md`). PR #851 (tenant-config audit §4.3 correction) remains open on its own docs branch, separate from this promotion. **Next:** operator re-baselines staging from main before dispatching further Fable work; sequence the newly-banked FUs, with Company Config v2 as the next major track; separately, EFF-004's `firebase deploy --only functions` remains PENDING from an earlier, unrelated session.

**Nexus v2 promoted staging → production, Runs 1+2 (PR #849 merge `2c2932f3`, 2026-07-09/10).** The full redesign (96 commits) is now live in prod, backend-first: indexes, +221 lines of rules (`cro` role/Arm E, `appointments`, `recruitingCandidates`, WAR reviewer arm, `weeklyPlans` field rename), all 26 functions, and the prod kiosk IAM grant were deployed from the staging worktree before the merge landed. VH suite 33/33 effective; Phase 3 prod verification (flags fail-closed, agent/admin click-throughs, drag-reorder persistence, clean consoles, motion accepted by eyeball) passed; stale index cleaned up post-merge. **Open threads from this promotion:** (1) staging is now behind main (`24fa445f` vs `2c2932f3`) — Phase 4.5 re-baseline is queued, not done; (2) no prod CRO user exists yet (operator decision, deferred); (3) PR #848's hero-card conformance recon narrowed part of the #836 design-conformance MISSING list to 7 concrete build items (Daily Capture anchor hero, Prospect Prep hero — feature not built at all, shared Financing self-view hero, UM Team Reports hero-class gap, My WAR hero, Money Needs hero flag-flip, Meeting Mode opening-slide hero) — banked to FOLLOW_UPS.md this cycle as Run-3 candidates. Eight new follow-ups banked from this session (seeder env-file foot-gun, VH flaky leg, MasterSheet stale key, index-file drift, stale prod IAM binding, Node 20 deadline reminder, tier0-smoke branch rebase, motion-verifier prod creds) — see FOLLOW_UPS.md. **Next:** operator re-baselines staging from main before dispatching the next autonomous run; sequence the design-conformance backlog (now against live prod) starting with the systemic §1–§5 contract sweep; separately, EFF-004's `firebase deploy --only functions` remains PENDING from the prior session (unrelated to this promotion — no functions/ delta in the #824–#839 batch, but this promotion's OWN function/rules/index deploy already occurred as part of Phase 2 above).

_(Post-merge catch-up through PR #839/`5283ab03` "Where we left off" paragraph moved to `docs/CONTEXT-history.md` — archived 2026-07-15 when the Runs-5-7 promotion/#858 entry above exceeded the 3-entry cap. EFF-004/#805 archived 2026-07-10 when the Runs-3+4+polish promotion/#853 entry exceeded the cap; its functions-deploy-PENDING status carries forward unchanged in § Pending operational state below. EFF-002/#804 + SEC-012/#801 + prior "Autonomous-run polish program #794–#799" + Fork B3/#790 + Window-3 serial run/#787–#789 + Fork B1/#787 + Clarity/#786 + PR-GPM1 Team Plans Reader/#785 + the Orchestrated-window 2026-07-02 recap already there.)_

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
