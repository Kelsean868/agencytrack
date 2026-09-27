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
| Last updated | **MX MDRT award line SHIPPED (2026-09-27), PR #984 merge `1662ac4f` (feature-branch HEAD `fee3a4ca`).** Second item of the ledger-layout autorun. The Awards-tab MDRT award now reads the real MDRT line via new `mdrtAwardThresholds()` in `src/config/mdrtThresholds/2026.js` (688,800; in-contention = 50% = 344,400), used by `awardsEngine.js` and `yearPlanProjection.js`; a stored tenant ruleset's `mdrtAward.apiThreshold` (500,000 = 6+ yr company minimum) is no longer read. Admin ruleset editor: MDRT threshold fields removed, note shown, prize still editable. Company floor row (`GapAnalysisPanel`) labelled "Company minimum (<band>)" via new `tenureBandLabel()` from the existing tenure bands. Parity test `src/config/__tests__/mdrtAwardThresholds.parity.test.js` (Awards = Home = ledger lens = 688,800, even with a 500,000 ruleset). **Banked:** brief's 3-band company minimum table vs code's 6 bands — Kyron to rule. **Gates:** lint 0/0; 422 files / 7,119 tests; build OK; CI all pass on `fee3a4ca`; CodeRabbit summary, Low risk, 0 findings. Production smoke PASS; live MDRT card reads "of TTD 688,800" (`prod-mx/`). **No deploy-gated surface touched.** **Prior:** **LX ledger layout SHIPPED (2026-09-26), PR #983 merge `869ca694` (feature-branch HEAD `1d4d4392`).** First item of the ledger-layout autorun (`docs/briefs/ledger-layout-and-l3.md`, LX → MX → L3 → FX). The Policy Ledger page now follows D1 (390) / D3 (1440) block order: new `LedgerPageHeader` (title, HO-as-of line, desktop search, Export menu; mobile Export icon), saved-view chips row replacing the old `LEDGER_FILTERS` tab strip, Counts toward selector, award card (desktop strip: tier picker, three rings incl. Persistency via new shared `src/lib/campaignPersistencyReading.js`, pace text), mobile search/filter/sort row, active chips, list (mobile grouped cards; desktop rail + table + footer). `PipelineStrip` no longer rendered (file kept). Mockup-vs-build pairs D1-390 / D3-1440 light + dark in `docs/reports/screenshots/ledger-2026-09-26/lx/`. **Partial vs mockup, banked:** policy card is the existing card (not D1 slim card); desktop rail uses chips not checkboxes; 1440 table scrolls sideways. **Gates:** lint 0/0; CI 421 files / 7,111 tests; build OK; CI all pass on `1d4d4392`; CodeRabbit rate-limited (absent). Production smoke PASS (`prod-lx/`). **No deploy-gated surface touched.** **Prior:** **L2 filter/sort/saved views/export SHIPPED (2026-09-26), PR #982 merge `6cee9c56` (feature-branch HEAD `827a2746`). Policy Ledger autorun closed: L0, L1, L2 merged; L3 NOT STARTED (3 h 30 min time box).** Pure filter predicates + sort comparators in new `src/lib/ledgerFilters.js` (one definition list drives the mobile sheet, desktop rail counts and chips); "Counts toward" filter reads the L1 `deriveAwardLens` groups; saved views via new `userPrefsService.setLedgerSavedViews` → `prefs/app.ledgerSavedViews` (cap 8, no rules change); desktop `LedgerTable` with rail beside it, sortable headers, sticky header + first column, footer counts; export of the FILTERED rows as CSV (`csvExport.js`, formula-injection safe) and a PDF head-office check sheet (`LedgerHoCheckDocument`, `@react-pdf`, lazy — verified no `vendor-pdf` request before export). **Orchestrator review round:** reverted a `vite.config.js` chunking change (outside the frontend-only merge rule) by moving the PDF from jspdf to `@react-pdf`; fixed desktop rail stacked above the table; fixed dark-mode sort radios. **Not built, banked:** Excel export (blocked by Ruling 1 `clientBundleGuard`), Needs attention / Paid-to / Next premium due (no backing field). **Gates:** lint 0/0; tests 420 files / 7,095 passing; build OK; CI all pass on `827a2746`; CodeRabbit summary (Low risk, 0 findings) then rate-limited. Production smoke PASS. **No deploy-gated surface touched.** **Prior:** |
| Current main HEAD | `1662ac4f` (PR #984 merge - MX MDRT award uses the real MDRT line, 2026-09-27). **MERGED; NO DEPLOY-GATED SURFACE - QUERIED:** `git diff --stat 869ca694..1662ac4f -- firestore.rules firestore.indexes.json storage.rules functions/` returns EMPTY. Ships via Vercel; production deploy reported success. **In-track work commits:** `977cd8c8` (fix), `3fdb8dd2` (placeholders + FU), `fee3a4ca` (merge main). **Prior:** `869ca694` (PR #983 merge - LX ledger page layout matches D1/D3, 2026-09-26). **MERGED; NO DEPLOY-GATED SURFACE - QUERIED:** `git diff --stat 01262033..869ca694 -- firestore.rules firestore.indexes.json storage.rules functions/` returns EMPTY. Ships via Vercel; production deploy reported success. **In-track work commits:** `bff4c288` (feat + pairs), `1d4d4392` (preview shots). **Prior:** `6cee9c56` (PR #982 merge - L2 filter & sort, saved views, export, 2026-09-26). **MERGED; NO DEPLOY-GATED SURFACE - QUERIED:** `git diff --stat 8bc2ab88..6cee9c56 -- firestore.rules firestore.indexes.json storage.rules functions/` returns EMPTY. Ships via Vercel; production deploy reported success. **In-track work commits:** `1c4d45fc` (feat), `5cd66938` (design-check shots), `079596de` (orchestrator fix round), `827a2746` (final preview pass). **Prior:** |
| Active track | **Ledger layout autorun 2026-09-26 (LX → MX → L3 → FX) — IN PROGRESS.** LX (#983 `869ca694`) and MX (#984 `1662ac4f`) SHIPPED. L3 (counts-toward chips) and FX (date boxes, hero legend) being built. Brief: `docs/briefs/ledger-layout-and-l3.md`. **Prior:** **Ledger layout autorun 2026-09-26 (LX → MX → L3 → FX) — IN PROGRESS.** LX (#983 `869ca694`) SHIPPED. MX (#984, MDRT award reads 688,800) open. Next: L3 counts-toward chips, then FX small fixes. Brief: `docs/briefs/ledger-layout-and-l3.md`. **Prior:** **Policy Ledger autorun 2026-09-26 — CLOSED.** L0 (#980 `0fcf215d`), L1 (#981 `72a87fd9`), L2 (#982 `6cee9c56`) SHIPPED. **L3 (counts-toward chips on every policy card + drill drawer) NOT STARTED — time box; next track.** Engine helper `awardWindowsForPolicy` is ready for it. Report: `docs/reports/autorun-2026-09-26-ledger.md`. **Prior:** |
| Queued | F2.2 (email-to-BM on joint-call submit); `needCovered` taxonomy confirmation (Track H/G); BOA-teardown FU (backfill + rule cleanup). True telephone-contacts wizard field; manager-side floor adherence roll-up (Track F adjacency). Peer-BM branch-scoped exclusion (agentBranchId denormalization — heavier FU). LOW housekeeping FU from #244: CLAUDE.md "lint + build" → "lint + test + build" doc drift (global-stub FU now RESOLVED by #264). ~~isProducingManager setter RESOLVED~~ **isProducingManager panel + script RETIRED (Slice 2.2, PR #639)** — `personalApi`/`personalApps` fields and `isProducingManager` gate removed from `ManagerWarTab`/`managerWarService`/`ManagerWarDetail`; `set-producing-manager.mjs` deleted. No setter needed; concept retired. Track D parity expansion + BM at-risk view deferred (D2+). |
| Two-strike counter | 0/3 — clean. |
| Stash pending | **Yes — 1** (pre-existing, unrelated to Run A; appears superseded — see § Pending operational state) |

---

## Locked decisions — do not re-litigate

These are settled across all future sessions. If a session audit surfaces a reason to revisit, treat as a **surprise-stop** — surface in chat, do not unilaterally override.

### Ruling D3 — the dialer is `tel:` plus a captured outcome; NO telephony bridge (2026-08-16, P0-G / PR #904)

- **DECIDED, not provisional.** The v3 dialer places calls via `tel:` and captures the agent's own account of what happened. **No Twilio, no telephony bridge, no call-routing integration.** Two independent reasons, and the second is the load-bearing one.
- **Cost** (the weaker reason): a bridge is two billed legs — roughly **TTD 2.32/min** if the agent talks through the app, **TTD 4.58/min** if it dials their mobile — about **TTD 700–1,400 per agent per month** against a 36-call weekly minimum. It charges per unit of the exact behaviour the app exists to increase.
- **Coverage** (the reason that decides it): Tatil agents call from **personal mobiles and sometimes company lines**. A bridge only ever sees calls routed through the app, so an agent who made 36 real calls from their own phone shows **ZERO**. That is the source build's worst defect in new clothing — a manager-facing screen reporting a false fact about a named agent, produced by a **coverage gap** rather than a scoping bug. **Partial evidence is worse than honest declaration:** a declared outcome covers every call; a bridge covers only the obedient ones.
- **The designed-for upgrade is Microsoft Graph PSTN call records — CONTINGENT, UNDATED, and NOT BUILT.** If Tatil moves to Teams Phone it supplies `calleeNumber`, `startDateTime`, `duration` in connected seconds and `callType` for direction, at zero marginal cost, covering company lines natively. It depends on a decision nobody has made and needs a tenant-wide `CallRecords.Read.All` grant. **Build so it can arrive; do not build it.** `applyVerification` in `src/lib/schema/callRecord.js` is that arrival point.
- **What D3 broke, and why Phase 0 has a seventh item:** `activityLedger.js` documented *"Calls carry no status — a logged call happened"* and deferred the disposition vocabulary to Phase 1.5. Both stopped being true — with no bridge, the captured outcome IS the evidence model — so **P0-G** was added after Phase 0 had been declared closed. Both docblocks are corrected in-source.
- **Two questions D3 deliberately leaves OPEN — dispatcher's to rule, do not settle by implementation:** (1) what happens when a verification **contradicts** the agent's disposition (a placeholder property currently holds the dispute open and is retired by a ruling either way); (2) what happens when a **second source disagrees with the first** (`applyVerification` is add-only, which is declining to decide).
- **Falsification (Rule 23):** overturned if Tatil commits to routing agent calls through a company-controlled system that covers personal mobiles — the coverage argument, not the cost argument, is what a Teams Phone move would answer. A cheaper bridge does **not** overturn it. Surface, do not bank.

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
| OIPA P4 | Browser upload screen - the agent-facing half of the portfolio import | **Yes, on the parser choice** | **`xlsx@0.18.5` must NOT parse agent-picked files in a browser.** It is a root devDependency for the ADMIN SCRIPT only and never reaches the bundle; its known CVEs are triggered by parsing a malicious file, which is exactly what P4 would do. Pick a maintained parser (`exceljs` is the candidate) or parse server-side in a callable. Full body in `docs/FOLLOW_UPS.md`. P4 is also the named revisit trigger for the accepted organic+imported gap below. |
| OIPA accepted gap | Organic + imported policies are never tested together in ONE tenant | No - ACCEPTED, not an open task | Both halves proven separately (imported dropped: 117 settled -> 0 in production; organic kept: 1 -> 1 in `tatillife_smoke`). Operator ruled 2026-09-16 NOT to create a test agent in `tatillife_south` - it would appear in manager rosters and leaderboards, and `isTestAccount` hides an account from the leaderboards but NOT from rosters. **Closes for free** the moment a second real agent is onboarded to the tenant. Revisit if P4 changes the filter. |
| Track J R2 | Four-window period grid + unit top-performers rail + the two branch on-pace counts (`docs/briefs/track-j-report-scopes-kickoff.md` section 3) | No | **UNBLOCKED - operator ruled 2026-09-09**, ruling written into brief section 3.1. Ready to dispatch on Fable 5.1, high effort. The agent-selectable third benchmark was cut from this slice and banked separately - see `docs/FOLLOW_UPS.md` section Agent-selectable pace benchmark. |
| Orphan cleanup | UID `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc with no Auth user | No | Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). **Also the sole null-unitId agent in `tatillife_south`** (#785 Phase 0.4 probe) — silently absent from every UM roster surface; resolve jointly per FOLLOW_UPS § null-unitId data fix (operator investigation first). |

---

## Recently shipped

| PR | SHA | Description |
|---|---|---|
| [#984](https://github.com/Kelsean868/agencytrack/pull/984) | `1662ac4f` | **fix(awards): MDRT award uses the real MDRT line (688,800), not the 6+ yr company minimum.** New `mdrtAwardThresholds()`; awardsEngine + yearPlanProjection stop reading `ruleset.mdrtAward.apiThreshold`; admin editor hides the dead fields; company floor row labelled by tenure band; parity test Awards = Home = ledger. |
| [#983](https://github.com/Kelsean868/agencytrack/pull/983) | `869ca694` | **feat(ledger): LX - page layout matches D1/D3.** New `LedgerPageHeader` (search + Export in header), view chips replace the old filter tab strip, `PipelineStrip` removed from the ledger, desktop award strip with three rings (shared `campaignPersistencyReading.js`). Mockup-vs-build pairs in `docs/reports/screenshots/ledger-2026-09-26/lx/`. Partial: card style, rail style, 1440 table side scroll (FU). |
| [#982](https://github.com/Kelsean868/agencytrack/pull/982) | `6cee9c56` | **feat(ledger): L2 - filter & sort, saved views, export.** Mobile filter sheet / desktop rail with counts, sorts, active-filter chips, saved views (`prefs/app.ledgerSavedViews`), desktop table (sticky header + first column, footer counts), CSV + PDF head-office check sheet export of the filtered rows. No Excel (Ruling 1). Autorun item L2, merged by orchestrator. |
| [#981](https://github.com/Kelsean868/agencytrack/pull/981) | `72a87fd9` | **feat(ledger): L1 - "Counts toward" award lens in the Policy Ledger.** Award selector (campaign ★, month, quarter, annual, MDRT, past periods), per-award card (ring + target tier picker + pace / ranked boxes / closed final credit), grouped list with engine reasons, HO flag where provable; target tier saved to `prefs/app.ledgerTargetTiers`. MDRT card uses 688,800 like Home. Autorun item L1, merged by orchestrator. |
| [#980](https://github.com/Kelsean868/agencytrack/pull/980) | `0fcf215d` | **feat(dashboard): L0 - two-layer rings on the live donuts.** Faint arc (settled + submitted-not-settled) behind the solid settled arc on the Home hero, Home campaign card and Campaign screen API + Applications rings; legend + "+x submitted" sub-line; new pure `pending` figures in `deriveYearProduction` and `derivePolicyLens`. Autorun 2026-09-26 item L0, merged by orchestrator. |
_(#978 P2a server integrity: #976 profile-photo Storage rules moved to `docs/CONTEXT-history.md` THIS cycle per the 5-row cap. #979 R2 Campaign screen: #972 security S0 moved to `docs/CONTEXT-history.md` THIS cycle per the 5-row cap. #977 R1 Home redesign: #971 persistency outlook derived/confirmed/estimated moved to `docs/CONTEXT-history.md` THIS cycle per the 5-row cap. #976 profile-photo Storage rules: #970 H3 moved to `docs/CONTEXT-history.md` in an earlier cycle per the 5-row cap. #974 security S2: #969 H2 moved to `docs/CONTEXT-history.md` THIS cycle per the 5-row cap. #973 security S1: #968 H1 moved to `docs/CONTEXT-history.md` in an earlier cycle per the 5-row cap. #972 security S0 does not need an archival footnote of its own — the 5-row cap holds at exactly 5 (#972/#971/#970/#969/#968) with #962 C2 moving to `docs/CONTEXT-history.md` THIS cycle to make room. #963 Persistency the entry window reaches January was archived to `docs/CONTEXT-history.md` THIS cycle per the 5-row cap, to make room for #971. #961 C1, the per-campaign persistency gate, was archived to `docs/CONTEXT-history.md` THIS cycle per the 5-row cap, to make room for #970. #960 C3, the Rule 7 credit table and the C-D10 settlement-window test, was archived to `docs/CONTEXT-history.md` THIS cycle per the 5-row cap, to make room for #969. #948 OIPA P2b the imported-policy filters and #947 OIPA P2 the importer were archived to `docs/CONTEXT-history.md` THIS cycle per the 5-row cap, to make room for #962 and #963. Note that #948 is the PR whose filter C3's C-D10 amends for the campaign path, so its body is worth retrieving from the history file before touching `excludeImported` again. Also merged this cycle and NOT given rows of their own, both docs-only under Rule 16(b): `6790f4fe` (the C2 brief amendment) and `e720015f` (the unfiltered-policies guard gap). Earlier: #945 Persistency P1 ledger derivation and #943+#944 OIPA P0 the pure parser were archived in the previous cycle, to make room for the first two campaign PRs. Also merged this cycle and NOT given a row of its own, docs-only under Rule 16(b): the Rev 2 campaign brief landed direct-to-main as `cf153fc7`. Earlier: #942 Track J R1 UM/BM production-report hero conformance, #941 Persistency P5 orphan-adoption arithmetic, #940 Persistency P4/P4b/P4c playground guards, #939 Persistency P2 vocabulary sweep and #938 Persistency P1b month-reach + denominator guard ALL archived to `docs/CONTEXT-history.md` this cycle per the 5-row cap. Also merged this cycle and NOT given a row of their own, both docs-only under Rule 16(b): **#946** (`b9f402ed`) enumerated two new members of the known test-flake family - `WizardFormV2RetirementR2` and `AwardsRulesetPanel`, both green on re-run with zero code change, neither previously in the register - and **#950** (`28974732`) banked "organic + imported policies in one tenant" as an ACCEPTED gap. The kickoff brief itself landed direct-to-main as `9bc60893`. #937 the Tatil 24-month persistency model, P1, archived to `docs/CONTEXT-history.md` this cycle per the 5-row cap. #936 medical limits move to the September 2026 schedule archived to `docs/CONTEXT-history.md` this cycle per the 5-row cap. #935 life-pipeline phase 1 slice 1A (`written` status) archived to `docs/CONTEXT-history.md` this cycle per the 5-row cap. #934 medical limits age-next-birthday fix archived to `docs/CONTEXT-history.md` this cycle per the 5-row cap. #933 medical limits headroom derivation and #931 selling-ladder production credit archived to `docs/CONTEXT-history.md` this cycle per the 5-row cap. #929 - `ingestCallActivity` feeds the selling ladder - archived to `docs/CONTEXT-history.md` this cycle per the 5-row cap. #927 slice D - Daily Capture's two-writer guard - archived to `docs/CONTEXT-history.md` in an earlier cycle. #915 call-sources slice A archived to `docs/CONTEXT-history.md` this cycle per the 5-row cap. #904 v3 P0-G call evidence model archived to `docs/CONTEXT-history.md` this cycle per the 5-row cap. #899 flake fix archived to `docs/CONTEXT-history.md` in an earlier cycle. #898 Flake Phase 0, #874 Run A promotion, #862 Run 9 promotion, #853 Runs 3+4+polish promotion archived to `docs/CONTEXT-history.md` in earlier cycles. #839 staging environment setup, #834+#835 mobile nav reorder v2 + More sheet v2, #824–#833 motion pop-in program, #827+828+836+837+838 design-docs-reconciliation batch, EFF-004/#805, EFF-002/#804, EFF-Phase1/#802, SEC-012/#801, and the #794–#799 autonomous-run program archived in earlier post-merge syncs. #805's functions-deploy-pending status carries forward unchanged in § Pending operational state, not lost.)_

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
- **Track J — V2 Redesign** — screen-by-screen port of `design_handoff_v2_app/` mockups (34 hi-fi references, README §4 token bridge). Work order per README §10: App Shell → Agent suite → Manager suite → CRO/back-office → Kiosk/Meeting → System screens → Emails. J1 (App Shell chrome restyle) shipped PR #388 (`63cb0cf`); the agent suite, manager suite, kiosk, system screens, and emails have since shipped across many slices. Per the **2026-07-07 recon** ([`docs/audits/trackj-recon-2026-07-07.md`](audits/trackj-recon-2026-07-07.md)) Track J is **~2/3 shipped** (16 shipped + 6 partial + 12 pending = 22/34 with shipped work). Current Track-J work is the **Run A conformance closeout** (Tier 3); the remaining net-new screens (Manager Dashboard, Master Sheet redesign, WARs, Campaigns, CRO, Meeting Mode, …) are still unbuilt. _(Was "J2 is next" — corrected Run A Tier 1 §5, 2026-07-24.)_
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

- **⚠️ OPERATOR ACTION — bind staging Firebase env vars to Vercel's *Preview environment*, not only the `staging` branch (banked 2026-07-26, planner week-nav / PR #875, HIGH).** Today a feature branch cut off `staging` builds against **PRODUCTION Firebase (`agencytrack-2a610`)**, because the staging env is bound to the `staging` branch specifically. Evidence (same credentials, same minute): the staging A11Y agent gets **LOGIN-OK** on `agencytrack-git-staging-…` and **AUTH-ERROR** on `agencytrack-git-<feature>-…` — the account simply does not exist in prod. **A preview driven with PRODUCTION credentials authenticates normally and reads/writes the live tenant.** This **overturns** the previously banked belief that Firebase's authorized-domains allowlist keeps previews off a live backend (that read the right symptom backwards, and its "this is good" reassurance was actively misleading). Until this is bound: never run a **mutating** smoke against a feature-branch preview; verify via `npm run build -- --mode staging` served locally (bundle must carry `agencytrack-staging`, **zero** `agencytrack-2a610`). Full finding + the code-side remedy (generalize the pre-write project guard to every mutating smoke — its own small PR) in `docs/FOLLOW_UPS.md` § Feature-branch Vercel previews are bound to PRODUCTION Firebase; hard rules restated in `CLAUDE.md` § Workflow and `scripts/verification/SMOKES.md`.
- **Orphan user** `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc exists but no Auth user. Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). Do not auto-delete; investigate first.
- **Node.js 20 Functions runtime** deprecated 2026-04-30, decommission 2026-10-30 — migration to Node 22 is a separate ticket. Not blocking; CLAUDE.md locks v1 runtime for current track.
- **`firebase-functions` SDK** at 4.9.0 — upgrade to ≥5.1.0 has breaking changes; schedule as own ticket post-pilot.
- ~~**Clarity operator activation (PR #786, 2026-07-03)**~~ **RESOLVED 2026-07-03** — operator completed all 3 steps (project created, dashboard masking set to STRICT, `VITE_CLARITY_PROJECT_ID` set Production-only + redeployed) and playback-verified the live recording with Money Needs figures masked. Clarity is live and privacy-gated as designed.
- **⚠️ EFF-004 functions deploy DONE 2026-08-26 — VERIFICATION SMOKE STILL OUTSTANDING (PR #805, `9dcae1a3`, merged 2026-07-05).** **Resolved incidentally by the PR #909 deploy**, not by anyone acting on this entry: `firebase deploy --only functions` ran from `main` at `ee5444bd` on 2026-08-26 07:35 TT, `9dcae1a3` is an ancestor of that HEAD (`git merge-base --is-ancestor` exits 0), and the deploy log records `functions[onSubmissionWrite(us-central1)] Successful update operation` — the exact function #805 changed. **A full `--only functions` deploy ships every pending functions change in the range, not just the one you came for.** Worth stating because this entry sat open for 52 days and closed as a side effect. What remains is the proof, not the fix: The MDRT-badge YTD-reducer fix (v2 `newBusiness.api` counting) is now LIVE in production — `firebase deploy --only functions` has now run. A live post-deploy smoke against `tatillife_smoke` proved the bug is real in production data (540,554 real v2 YTD, no `mdrt_qualified` badge) and confirmed the fix was not live at that time (2026-07-05). **Remaining operator action: re-run the smoke in `docs/audits/mixed-run-2026-07-05/` to confirm the badge now appears.** The deploy is no longer the blocker; the unproven claim is. Not superseded by any PR in the #824–#839 batch (no functions/ changes in that batch).
- **Staging environment (`agencytrack-staging`) is live and isolation-verified (PR #839, 2026-07-08)** — the imminent Fable autonomous build run targets this project, not prod. Console setup steps (E — deploy rules/indexes/functions to staging; F — push a `staging` branch) may still be outstanding; confirm with the operator before assuming the environment is fully seeded for the run.
- ~~**⚠️ Staging branch was DELETED on the Run 8 merge (PR #860, `ef4e7c0d`, 2026-07-16)**~~ — **RESOLVED 2026-07-26 (planner week-nav track, dispatcher-ruled).** `origin/staging` is live again at `219cf324` (== `origin/main`), clearing a debt that had run across five promotion cycles (Nexus v2/#849, Runs 3+4/#853, Runs 5-7/#858, Run 8/#860, Run 9/#862) plus the Run A promotion (#874). **The "must be a recreation, not a fast-forward" note above proved wrong on inspection:** the orphaned LOCAL `staging` ref (`a31d52d7`) was a direct ANCESTOR of `origin/main` (`git merge-base --is-ancestor`), so the fix was a pure fast-forward — no history rewritten, no commits discarded, untracked files in the worktree untouched. The `at-fable-staging` worktree therefore no longer needs repointing before the next Fable dispatch. Kept here (struck, not deleted) because the superseded instruction was actionable and wrong. See `docs/FOLLOW_UPS.md` § Staging branch re-baseline. This was always separate from the `agencytrack-staging` Firebase-project isolation setup above (git-branch drift, not Firebase-project drift).
- **⚠️ Staging branch was DELETED on the Run 8 merge (PR #860, `ef4e7c0d`, 2026-07-16) — GitHub `deleteBranchOnMerge` confirmed via `git ls-remote --heads origin` (no `staging` ref).** Re-baseline is now overdue across FOUR promotion cycles (Nexus v2/#849, Runs 3+4/#853, Runs 5-7/#858, Run 8/#860) that never re-baselined staging first, and the next re-baseline is a branch **recreation** from `main` (`git checkout -b staging origin/main && git push -u origin staging`), not a fast-forward of a stale ref — there is no stale ref anymore. The `at-fable-staging` local worktree still points at the old (now-orphaned) local `staging` branch and will need repointing before the next Fable dispatch. This is a separate step from the `agencytrack-staging` Firebase-project isolation setup above (git-branch drift, not Firebase-project drift). **NOTE (2026-07-26, not re-fixed here — scope belongs to the open PR):** the open PR #875 (`docs: bank HIGH — feature-branch previews are PRODUCTION-bound; correct 2 stale claims`, commit `0d31bded` on `feat/planner-week-nav`) already recreated `origin/staging` (now live at `219cf324`) and drafted the correction to this bullet. This fill deliberately does not duplicate that edit — let #875/#876 land it to avoid two docs commits fighting over the same lines. Do not re-run the recreation steps above; verify with `git ls-remote --heads origin` first.
- **Uncommitted stash found during this fill (2026-07-26), pre-existing and unrelated to Run A:** `stash@{0}` on a now-deleted branch (`feat/points-activity-scale`, WIP atop `69a3a23`), dated 2026-06-10. Contents: a 2-line comment/constant fix in `scripts/verification/points-activity-scale-smoke.mjs` (`EXPECTED_DELTA` 164→165). **Appears fully superseded** — the identical fix is already on `main` via a separate commit, `chore(smoke): fix EXPECTED_DELTA 164→165 in points-activity-scale smoke` (`5b0fdb89`), and the source branch no longer exists. Not dropped in this fill (destructive stash ops need explicit confirmation, not inferred from "looks redundant"); flagging for the operator to confirm-then-drop (`git stash drop stash@{0}`) rather than doing it here. Updates the top-table "Stash pending" field from a stale "No" to "Yes" — this stash predates the field's last several updates and was never previously recorded.
- **Prod CRO user not created.** The promotion deployed the `cro` role + rules/Arm E backend support, but no CRO account exists in production yet — deferred as an operator business decision, not a technical blocker.

---

## Where we left off


**CURRENT - 2026-09-27 (early morning). MX merged as `1662ac4f` (#984) - Awards-tab MDRT now 688,800 everywhere.**

The Awards tab, Home and the ledger now agree on the MDRT line (688,800), checked live in production. The 500,000 figure was the 6+ year company minimum, not MDRT. One open question for Kyron: the brief lists 3 company-minimum bands, the app uses 6 (FOLLOW_UPS "Company minimum bands: brief vs tenureFloors").

**Next:** L3 counts-toward chips, then FX (date boxes, Home hero legend values). Report at the end: `docs/reports/autorun-2026-09-26-ledger-layout.md`.

**PRIOR - 2026-09-26 (evening). LX ledger layout merged as `869ca694` (#983) - first item of the ledger-layout autorun.**

The Policy Ledger now follows the D1/D3 block order: header with search + Export, view chips, Counts toward, award card, filter row, chips, list. The old pipeline strip and filter tab strip are gone from this screen. Three blocks are only partly like the mockup (policy card, filter rail, 1440 table side scroll) and are banked as a follow-up.

**Next:** MX (#984, Awards-tab MDRT 688,800 + company-minimum label), then L3 chips, then FX (date-box width, Home hero legend wording). Report at the end: `docs/reports/autorun-2026-09-26-ledger-layout.md`.

**PRIOR - 2026-09-26 (late afternoon). L2 filter/sort/export merged as `6cee9c56` (#982) - Policy Ledger autorun closed, L3 not started.**

**The autorun shipped L0, L1 and L2** (report: `docs/reports/autorun-2026-09-26-ledger.md`). L3 — gold "Counts toward" chips on every policy card and the drill drawer — was not started because the run hit its 3 h 30 min time box; it is the next track and should be small (the per-policy engine helper `awardWindowsForPolicy` already exists and is tested).

**L2 needed one orchestrator fix round:** a `vite.config.js` chunking change was reverted (PDF moved to `@react-pdf`, which is already lazy), the desktop rail was moved beside the table, and dark-mode sort radios were fixed.

**Decisions waiting on Kyron (FOLLOW_UPS):** Awards-tab MDRT 500,000 vs 688,800; Excel export vs Ruling 1; HO-flag per-import manifest. **Still unseen live:** every lens/ring/filter state with real data — the A11Y test agent has no policies and no campaign.

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
