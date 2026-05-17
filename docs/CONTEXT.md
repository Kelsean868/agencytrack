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
| Last updated | `2026-05-17` |
| Current main HEAD | `a1cd73c` (fix(test): WeeklyActivityPanel — use Trinidad-local Sunday in test fixture (pre-existing since #75), #189) |
| Active track | Hotfix PR #189 shipped (`a1cd73c`, fill `26f7cb4`); FU-H execution PR #188 open (Pass 3 amend) — promote post-merge fill scope to canonical Rule 16, fix Rule 16 wording per hotfix's first-application learning, retire "Rule 4 shorthand" terminology drift flagged by Rule 15:503, reconcile top-table staleness against post-hotfix main. |
| Next track | FU-H Phase 6 canonical first formal Rule 16 application; close-out for the day. |
| Queued | (none) |
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
| **Resend invite UI** | Per-row "Resend invite" action in user management | No | MEDIUM. Once-off email failures currently have no recourse after the post-create toast dismisses — the truthful warning toast (shipped PR #136) tells admins email failed but the only recovery is recreating the user. Wire `sendPasswordResetEmail` short-term; swap to a `mail/` doc write via a callable wrapper once the PR-D pattern is consumed by more flows. |
| Orphan cleanup | UID `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc with no Auth user | No | Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). |

---

## Recently shipped

| PR | SHA | Description |
|---|---|---|
| #{TBD} | `{TBD}` | FU-H methodology (LOW closure): Rule 16 added to CLAUDE.md mandating post-merge fill scope (Current main HEAD, Active track, Next track, Where we left off, Last updated). Wording corrected Pass 3 to anchor Current main HEAD on the work-PR squash (not the fill commit, which is housekeeping). Anchor tweak at CLAUDE.md:344 cites Rule 16 alongside Rule 15. Retires 'Rule 4 shorthand' terminology drift flagged by Rule 15:503. Top-table staleness reconciled. |
| #189 | `a1cd73c` | WeeklyActivityPanel test timezone fix: test fixture now uses Trinidad-local Sunday boundary (pre-existing since #75, surfaced by FU-H CI run in UTC danger window). Test-only, no component change. |
| #186 | `bd238d2` | FU-G script-local READMEs (LOW closure): PREVIEW_HOST documented in `scripts/verification/README.md`; new `scripts/cleanup/README.md` documents CLEANUP_ALLOWED_TENANTS. `.env.example` untouched per Rule 14 carve-out. |
| #184 | `ddc6095` | FU-C closure: super_admin script removal + companion cleanup |
| #182 | `19a8281` | FU-B closure: A11Y env var consolidation + Rule 14 banking-note re-baseline |

---

## Pending operational state

These don't block anything, but they need to be resolved or carried forward each session.

- **Untracked legacy docs + scripts** — `git status` shows untracked files left over from shipped work, across three categories: `docs/PR-3-Claude-Code-Brief.md` (user-mgmt PR-3 brief, shipped PR #28), Track-E/PR-D kickoff briefs under `docs/briefs/` (E1 #68–#70, E4 #72, E5 #73/#74, E6 daily #71, E6 AOM #76, PR-D #133), and verification scripts under `scripts/` and `scripts/verification/` from Mobile FU#1 (#90), PR-D (#133), Mobile FU#2 (#153), Mobile FU#4 (#154), and border-border (#156). Cleanup tracked in `docs/FOLLOW_UPS.md` — likely fate: archive briefs to `docs/archive/briefs/`, defer scripts (possibly reusable). Not blocking.
- **Orphan user** `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc exists but no Auth user. Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). Do not auto-delete; investigate first.
- **Node.js 20 Functions runtime** deprecated 2026-04-30, decommission 2026-10-30 — migration to Node 22 is a separate ticket. Not blocking; CLAUDE.md locks v1 runtime for current track.
- **`firebase-functions` SDK** at 4.9.0 — upgrade to ≥5.1.0 has breaking changes; schedule as own ticket post-pilot.
- **`MotivationalCarousel.jsx` is dead code** — removed from ManagerDashboard by M2 (PR #107, `46eda67`). Component file retained in source pending deletion sweep (FU banked in `docs/FOLLOW_UPS.md`).
- **Worktrees + stale local branches** — multiple worktrees and ~15 stale local branches attached to merged feature branches. Cleanup banked in `docs/FOLLOW_UPS.md` § Worktree + branch audit.

---

## Where we left off

> **Session boundary:** FU-H execution PR open (Pass 3 amend after mid-flight hotfix #189) — promote post-merge fill scope to canonical Rule 16; fix Rule 16 wording per hotfix's first-application learning; retire "Rule 4 shorthand" terminology drift flagged by Rule 15:503; reconcile top-table state against post-hotfix main. Brief commit shipped via PR #187 (`39cb62d`); hotfix shipped via PR #189 (`a1cd73c`, fill `26f7cb4`).

**Today's session arc (2026-05-17, continued).** Cleared the LOW queue modulo FU-F (audited, deferred to dedicated session). FU-G (LOW, banked 2026-05-13) shipped: `scripts/verification/README.md` gains a PREVIEW_HOST entry (corrected post-Phase-1 to describe per-feature-branch fallback drift, not "production preview URL"); `scripts/cleanup/README.md` created documenting `CLEANUP_ALLOWED_TENANTS` with abort-guard semantics captured verbatim from source; `.env.example` untouched per Rule 14 carve-out. Three Phase 1 catches in the FU-G brief content all surfaced and corrected before commit; zero CC strikes. FU-F audit ran inline; FU body itself was stale ("dotenv used by most scripts" — zero dotenv consumers; actual landscape is 5 parser patterns across 30 files: 23 `.mjs` + 7 `.cjs`, with 27-file FU-B touch-surface overlap). Five architectural decisions locked at audit time; work deferred per scope-L sizing. FU-H Rule 16 methodology authored: Rule 16 added to `CLAUDE.md` mandating post-merge fill scope (five fields); anchor tweak at `CLAUDE.md:344` cites Rule 16 alongside Rule 15. Mid-flight CI failure on PR #188 surfaced a pre-existing test bug (UTC-vs-Trinidad-Sunday boundary in `WeeklyActivityPanel.test.jsx` from PR #75 / `ed99ece`); hotfix #189 (`a1cd73c`) shipped in <30 minutes as a clean separation, and its post-merge fill (`26f7cb4`) became the de-facto first application of Rule 16 spirit (before formal canonization in this PR). The hotfix fill surfaced a Rule 16 wording bug — "fill commit" as `Current main HEAD` anchor is operationally impossible (chicken-and-egg); CC implicitly demonstrated the correct interpretation by anchoring to the work-PR squash; this Pass 3 amend codifies that interpretation in Rule 16's wording.

**Methodology discipline tested today.** Six instances of brief- or rule-authoring source-verification gap caught and resolved: three in the FU-G brief content, one in the FU-F body claim, one in the FU-H brief Phase 2c "one-line" prescription (caught by CC's Rule 1 surface), one in the FU-H Rule 16 wording (caught by hotfix Phase 4 self-application). Five are brief-authoring, one is rule-authoring — the methodology gap is now systemic across both surfaces and warrants banking as candidate FU-J at end-of-day. CC's Rule 1 surfacing tested live twice — the "Where we left off" structural collapse on Pass 2 and the Rule 16 wording tension on the hotfix Phase 4 self-report — both resulted in dispatcher-side corrections without strike accrual. Lint 0 / build clean. Smoke waived for all today's PRs (CLAUDE.md + CONTEXT.md + scripts/* READMEs + one test fix; no runtime). Strike count 0/2 — clean across the multi-PR day.

**Next:** FU-H Phase 6 is the canonical first formal Rule 16 application — it will commit a fill commit, update all five top-table fields per corrected Rule 16, and verify Rule 15 origin-equality. Its success closes FU-H. After that: close-out for the day. Backlog: FU-F implementation in a dedicated session (~30 files, 5 parser patterns, 5 architectural decisions banked at audit time); FU-I (TENANT_ID parameterization) deferred post-pilot; end-of-day banking decisions on FU-J (brief-/rule-authoring source-verification methodology, six-instance pattern) and FU-K (stale `docs/*` branch cleanup sweep, ~11 branches accumulated).

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
