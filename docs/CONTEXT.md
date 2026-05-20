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
| Last updated | `2026-05-20` |
| Current main HEAD | `1b05eb7` (feat(dashboard): Weekly Activity Floors — Expected vs Actual card, #238) |
| Active track | Workshop §3.5 quick-wins. PR #238 shipped the floors portion (`weeklyActivityFloors` schema extension + `WeeklyStandardCard` on AgentDashboard, seeded `tatillife_south` 60/40/20/15/10/10/1/1/4800/100). Three workshop fast-follows remain (own PRs): Tenant-Admin in-app editor for the 10 floors, Expected/Actual relabel sweep across KPICard/MasterSheet/Meeting Mode/Awards, true telephone-contacts wizard field (retires the `qualifiedApproaches` proxy footnote on row #2). |
| Next track | Workshop §3.5 fast-follow (Tenant-Admin editor OR Expected/Actual relabel — both small, either order). Then Track F (joint-call form) per insider-seat re-sequence. Pilot remains postponed indefinitely. |
| Queued | Workshop §3.5 Tenant-Admin floors editor; Expected/Actual relabel sweep; true telephone-contacts wizard field. Track D kickoff brief deferred behind workshop quick-wins per re-sequence in `docs/AgencyTrack_Workshop_Roadmap_Revision.md`. |
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
- **Track F extended** — structured Joint-Call Observation Log + appointment-bound Prospect-Info form (manager-chain privacy, same model as coaching notes).
- **Track H column decision LOCKED** — IN: Source of Prospect (enum), Cash with Application, Date Placed (= `dateIssued`), Policy Delivery Date. OUT: demographics. Need Covered → joint-call form.
- **Small adds** — social/content KPIs (Track E sub-item); Personal Growth/CPD log (Career Portal/Phase 8).
- **Quick wins** — extend `config/companyMinimums` with `weeklyActivityFloors` + Tenant-Admin surface + seed agreed Tatil minimums (60/40/20/15/10/10/1/1/4800/100); relabel dashboards "Expected/Actual".
- **Re-sequence (insider-seat):** Quick wins → Track F (incl. joint-call forms) → Track I → D + E → H → G.
- **Guardrail:** activity/production/coaching only, not a relational CRM; Tatil has no own CRM; future tightly-integrated CRM separately scoped.

Recently-shipped row: `docs(roadmap): workshop-driven roadmap revision (#236)` — SHA `58ebb2c`.

---

## Pending operational state

These don't block anything, but they need to be resolved or carried forward each session.

- **Orphan user** `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc exists but no Auth user. Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). Do not auto-delete; investigate first.
- **Node.js 20 Functions runtime** deprecated 2026-04-30, decommission 2026-10-30 — migration to Node 22 is a separate ticket. Not blocking; CLAUDE.md locks v1 runtime for current track.
- **`firebase-functions` SDK** at 4.9.0 — upgrade to ≥5.1.0 has breaking changes; schedule as own ticket post-pilot.

---

## Where we left off

**What shipped this session:** PR #237 (workshop-driven kickoff brief committed for Rule 10) and PR #238 (Weekly Activity Floors — workshop §3.5 floors portion: `weeklyActivityFloors` schema extension on `config/companyMinimums` with idempotent shallow merge; new Admin SDK seed script + `tatillife_south` seeded with Tatil workshop Appendix A values 60/40/20/15/10/10/1/1/4800/100; new `WeeklyStandardCard` component on AgentDashboard surfacing 10 rows Expected vs Actual with per-row Met/Close/Below status; row #2 carries a tap-to-expand footnote so the `qualifiedApproaches` proxy is not hidden; 28 new unit tests, 718/718 green). Pre-merge preview smoke + post-merge production smoke both clean (0 console errors). Production non-zero verification seeded a current-week submission for `kelsean@gmail.com` to exercise the full mapping live.

**Methodology learning:** PR #238 surfaced one Phase 1 Rule 12 stop (`telephoneDials` / `telephoneContacts` from earlier brief draft do not exist in `extractFields`). Dispatcher authorized Option A canonical keys (`totalTelAttempts`, `telContacts` → `qualifiedApproaches` fallback) inline. The proxy footnote on row #2 was a direct downstream of that decision — visible affordance for users that floor #2 is currently a proxy until a true telephone-contacts wizard field ships. Also surfaced: the standard smoke template lacks console/network capture; an ad-hoc `weekly-activity-floors-console-capture.mjs` was written for PR #238 verification — banked as a LOW FU to fold into the canonical template.

**Pending review / next move:** Workshop §3.5 fast-follows are the active queue: Tenant-Admin in-app editor for the 10 floors (mirrors B5 `EditConfigModal` + `setCompanyMinimums` audit), Expected/Actual relabel sweep across KPICard/MasterSheet/Meeting Mode/Awards, and a true telephone-contacts wizard field (retires the proxy footnote on row #2). Either order; all small/standalone. Track F joint-call form follows the quick-wins per the insider-seat re-sequence. Track D deferred behind the workshop arc. Pilot postponed indefinitely.

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
