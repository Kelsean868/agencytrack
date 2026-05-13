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
| Last updated | `2026-05-13` |
| Current main HEAD | `69807a9` (docs(context): fill PR-F squash SHA + PR# in recently-shipped row; PR #135 PR-F shipped at `6baaa98`) |
| Active track | None in flight — housekeeping / memory-hygiene mode. Track E fully shipped (E1 #68–#70, E2 #66, E3 #82, E4 #72, E5 #73/#74, E5.1 #75, E6-daily #71, E6 AOM #76). M-series complete (#105/#107/#113/#116/#118). User-mgmt PR-3/PR-4/PR-4b shipped. PR-D server-side email (#133) and PR-F bulk test data (#135) shipped 2026-05-13. doCreateUser emailQueued truthfulness fix (PR #<placeholder>) shipped 2026-05-13 (closes the banked MEDIUM from PR #134). |
| Next track | **Pilot prep — end-to-end testing using PR-F tooling.** Exercise the new bulk-seed + cleanup tooling against the full pilot flow (user creation → wizard → manager review → kiosk → AOM) before the Tatil demo. |
| Queued | **SEC-9b** — migrate services to explicit `tenantId` parameter (~20 call-site refactor). |
| Two-strike counter | 0/2 — clean PR-F arc. |
| Stash pending | No |

---

## Locked decisions — do not re-litigate

These are settled across all future sessions. If a session audit surfaces a reason to revisit, treat as a **surprise-stop** — surface in chat, do not unilaterally override.

### Multi-tenancy (SEC-9, shipped PR #16)

- `tenantId` is sourced from auth claims at runtime via `getTenantId()` runtime holder in `src/firebase.js`.
- `AuthContext` populates the holder after claims resolve, clears on sign-out.
- 18 files migrated: 13 components use `useAuth().tenantId`, 5 services use `getTenantId()`.
- ~~One inline `import.meta.env.VITE_TENANT_ID` read remains at the AuthContext bootstrap site only — tracked by SEC-11.~~ **Resolved in PR-2:** bootstrap block deleted, SEC-11 closed.
- `firebase.js` no longer exports `tenantId` as a const.

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
| **HIGH#6** | TenantAdminDashboard YTD composite index missing | No | Production manual click — tenant_admin loads `/`, copies index URL from `failed-precondition` console error, creates in Firebase console (~2–5 min). PR #131 mirrored existing indexes to source; HIGH#6's index may or may not be in that mirror — verify before assuming closed. Source: `docs/FOLLOW_UPS.md`. |
| **Resend invite UI** | Per-row "Resend invite" action in user management | No | MEDIUM. Once-off email failures currently have no recourse after the post-create toast dismisses — the truthful warning toast (shipped PR #<placeholder>) tells admins email failed but the only recovery is recreating the user. Wire `sendPasswordResetEmail` short-term; swap to a `mail/` doc write via a callable wrapper once the PR-D pattern is consumed by more flows. |
| Mobile FU#2 | Non-core agent surface P1s | No | `CareerPortal` "Edit My Goals" 32px → 44px, `History` row eye/preview hit area, `CommissionPlayground` accordion toggle measure-and-adjust. Source: `docs/FOLLOW_UPS.md`. |
| Mobile FU#4 | P2 cosmetic items | No | Wizard close (X) button 40×40 → 44×44, Leaderboard avatar tap-row, `MotivationalCarousel.jsx:366` hardcoded `bg-[#01696f]/8` → token (FU#3 channel-split landed in PR #132 but this site is hex-literal-arbitrary, not token-driven). Source: `docs/FOLLOW_UPS.md`. |
| SEC-9b | Migrate services to explicit `tenantId` parameter | No | **Queued next** — ~20 call-site refactor. Schedule after pilot prep wraps. |
| Orphan cleanup | UID `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc with no Auth user | No | Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). |

---

## Recently shipped (last 5 PRs)

| PR | SHA | Description |
|---|---|---|
| #136 | `89182cd` | fix(functions): doCreateUser emailQueued truthfulness (#134 follow-up) |
| #135 | `6baaa98` | feat(tooling): PR-F — bulk test data seeders + cleanup sweep |
| #134 | `98ac43c` | docs(follow-ups): bank doCreateUser step E-2 emailQueued truthfulness gap |
| #133 | `5ca6ea6` | feat(email): PR-D — server-side email infrastructure (HIGH#5) |
| #132 | `0573a2c` | fix(theme): FU#3 — channel-split token migration for working opacity modifiers |

---

## Pending operational state

These don't block anything, but they need to be resolved or carried forward each session.

- **Untracked legacy docs + scripts** — `git status` shows 11 untracked files left over from shipped work: `docs/PR-3-Claude-Code-Brief.md` (user-mgmt PR-3 brief, shipped PR #28), 8 Track-E/PR-D kickoff briefs under `docs/briefs/` (all features shipped — E1 #68–#70, E4 #72, E5 #73/#74, E6 daily #71, E6 AOM #76, PR-D #133), and 2 verification scripts (`scripts/mgr-mobile-audit.cjs` from Mobile FU#1 #90, `scripts/verification/pr-d-email-smoke.mjs` from PR-D #133). Cleanup tracked in `docs/FOLLOW_UPS.md` — likely fate: archive briefs to `docs/archive/briefs/`, defer scripts (possibly reusable). Not blocking.
- **Orphan user** `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc exists but no Auth user. Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). Do not auto-delete; investigate first.
- **Node.js 20 Functions runtime** deprecated 2026-04-30, decommission 2026-10-30 — migration to Node 22 is a separate ticket. Not blocking; CLAUDE.md locks v1 runtime for current track.
- **`firebase-functions` SDK** at 4.9.0 — upgrade to ≥5.1.0 has breaking changes; schedule as own ticket post-pilot.
- **`MotivationalCarousel.jsx` still consumed by `ManagerDashboard.jsx`** — verified still live as of 2026-05-13 (post-M2 manager overview hero #107). Replacement deferred to future Manager surface PR.
- **6 worktrees + ~15 stale local branches** — all attached to merged feature branches. Cleanup banked in `docs/FOLLOW_UPS.md` § Worktree + branch audit.

---

## Where we left off

> **Session boundary:** Memory-refresh / state reconciliation session on 2026-05-13. CONTEXT.md was ~30 PRs stale; this commit catches up the top metadata, Active follow-ups, Recently shipped, Pending op state, and supersedes the `super_admin` Locked-decision section.

**Last feature work — 2026-05-13:** PR-D server-side email infrastructure (#133, `5ca6ea6`) shipped the Firebase Trigger Email Extension wiring that closes HIGH#5. Client-side `sendPasswordResetEmail` removed; both create-user reset emails and the Sunday-nudge stub now route through `mail/` collection writes. R1 (domain authorization gap) surfaced and was resolved same day. PR-F bulk test data seeders + cleanup sweep (#135, `6baaa98`) followed — `scripts/seed/*` Admin SDK seeders + `scripts/cleanup/*` preview/wipe scripts + end-to-end smoke + lifecycle runbook. Both shipped clean (0/2 strike counter).

**Pre-pilot state:** Track E fully complete (E1–E6 across PRs #66–#82). Manager revamp M-series fully complete (#105/#107/#113/#116/#118). User-mgmt PR-3/PR-4/PR-4b complete. Polish-1 + Polish-2 complete. Pilot has not launched at Tatil yet — Kyron remains both the decision-maker for the branch and the platform admin, so we're shipping pre-pilot polish in batches.

**Next:** Pilot prep — exercise the new PR-F bulk-seed + cleanup tooling against the full end-to-end pilot flow (user creation → wizard → manager review → kiosk → AOM) before the Tatil demo. Surfaces drift in the user-management + dashboard surfaces under realistic data volumes. SEC-9b services-tenantId refactor queued after that.

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
