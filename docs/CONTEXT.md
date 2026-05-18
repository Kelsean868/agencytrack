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
| Last updated | `2026-05-18` |
| Current main HEAD | `44db563` (chore(cleanup): delete dead MotivationalCarousel component, #208) |
| Active track | Dead `MotivationalCarousel` component deleted (PR #208, squash `44db563`). Closes FU banked during Mobile FU#4 smoke. First non-methodology-arc PR after the FU-J → FU-N two-day arc closed. |
| Next track | Smaller follow-ups remaining: react-hooks ×3, aria-label sweep (CampaignForm L283 + History row banked from Mobile FU#2), `bg-[var(--color-X)]` arbitrary-syntax sweep, untracked legacy briefs/scripts cleanup (2026-05-13 banked — 9 briefs + 5 scripts surfaced today via `git status`), shakedown bugs 001/003/004/006, Wizard R2-R5 residual. Resend invite UI (MEDIUM) remains in Active follow-ups table for substantive work. |
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
| #{TBD} | `{TBD}` | Hotfix: EditUserDrawer test CI race — added waitFor between unit-select change and save click in "demoting to agent with unitId selected" test. Pre-existing pattern surfaced on PR #209 (docs brief) CI; passes locally but slower CI runner exposed the missing state-flush wait between fireEvent.change and fireEvent.click. Same shape as PR #189 hotfix yesterday (WeeklyActivityPanel timezone). |
| #208 | `44db563` | Dead-code removal: deleted `src/components/dashboard/MotivationalCarousel.jsx` (~378 LOC, zero live consumers since M2 / PR #107 / `46eda67`). Closes FU "Delete dead MotivationalCarousel component" (LOW, banked during Mobile FU#4 smoke). |
| #206 | `1d36436` | FU-N Rule 17 sub-bullet (LOW methodology refinement): added "Enumeration tracked-status" bullet at position 4 of Rule 17's bullet list — pairs `grep` with `git ls-files` (or `git grep`) for tracked-status filtering during file enumeration. Closes the methodology gap surfaced via FU-M discovery + FU-F-2 miscount. Self-applying: brief was authored against source-verified CLAUDE.md per Rule 17 itself. |
| #204 | `a975706` | FU-F-2 `.cjs` parser unification (LOW housekeeping closure, Part 2 of 2): created `scripts/lib/loadEnv.cjs` (CommonJS sibling to `.mjs` from FU-F-1); migrated 5 tracked `.cjs` inline parsers (Pattern G ×3 + Pattern H ×2). Pattern H sites gain embedded-key detection (safety upgrade). FU-F arc complete end-to-end. Rule 11 corrected diagnosis: actual tracked `.cjs` count is 5, not 6 (FU-M closure miscount). FU-N banked (audit-methodology refinement: pair `grep` with `git ls-files`). |
| #202 | `a4fba56` | FU-M defunct-script handling (LOW housekeeping closure): `scripts/multi-role-smoke.cjs` was NOT tracked in git — Phase 1 source-verification caught the brief's "tracked" assumption (file existed only in main worktree's filesystem, excluded via `.git/info/exclude` line 8). Remedy: filesystem cleanup (file `rm` + exclude rule removed) + close FU-M. Third canonical Rule 17 in-the-wild signal — caught at Phase 1 execution (safety net layer). Audit miscount knock-on: FU-F's `.cjs` migration target actually 6 (tracked), not 7. |

---

## Pending operational state

These don't block anything, but they need to be resolved or carried forward each session.

- **Untracked legacy docs + scripts** — `git status` shows untracked files left over from shipped work, across three categories: `docs/PR-3-Claude-Code-Brief.md` (user-mgmt PR-3 brief, shipped PR #28), Track-E/PR-D kickoff briefs under `docs/briefs/` (E1 #68–#70, E4 #72, E5 #73/#74, E6 daily #71, E6 AOM #76, PR-D #133), and verification scripts under `scripts/` and `scripts/verification/` from Mobile FU#1 (#90), PR-D (#133), Mobile FU#2 (#153), Mobile FU#4 (#154), and border-border (#156). Cleanup tracked in `docs/FOLLOW_UPS.md` — likely fate: archive briefs to `docs/archive/briefs/`, defer scripts (possibly reusable). Not blocking.
- **Orphan user** `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc exists but no Auth user. Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). Do not auto-delete; investigate first.
- **Node.js 20 Functions runtime** deprecated 2026-04-30, decommission 2026-10-30 — migration to Node 22 is a separate ticket. Not blocking; CLAUDE.md locks v1 runtime for current track.
- **`firebase-functions` SDK** at 4.9.0 — upgrade to ≥5.1.0 has breaking changes; schedule as own ticket post-pilot.
- **Worktrees + stale local branches** — multiple worktrees and ~15 stale local branches attached to merged feature branches. Cleanup banked in `docs/FOLLOW_UPS.md` § Worktree + branch audit.

---

## Where we left off

> **Session boundary:** Session C continues. This Phase 6 fill is the **eleventh formal application of Rule 16** (after #188, #190, #192, #194, #196, #198, #200, #202, #204, #206); all eleven followed the corrected "work-PR squash" anchor wording without chicken-and-egg drift.

**MotivationalCarousel deletion (PR #208, 2026-05-18).** XS mechanical dead-code removal — 421 lines deleted (component file), one dangling JSX comment in `AgentDashboard.jsx:414` updated as Rule 9 in-PR scope extension. Phase 1 caught LOC divergence (378 content lines vs FU body's "~150 LOC" estimate — file had grown since Mobile FU#4 banking); preserved per Rule 11 corrected-diagnosis pattern in the FOLLOW_UPS.md closure paragraph. Re-verified at execution: zero external imports / JSX usage in tracked `src/` files; build confirmed no latent unresolved modules. First non-methodology-arc PR since the FU-J → FU-N arc closed.

**Rule 17 fired twice at brief-authoring time today as recommendation pivots (2026-05-18).** Eighth signal: Rule 17 caught that Track B v2 (B1–B5) had already shipped (PRs #44/#47/#49/#52/#55) when dispatcher recommended B1 as next track — caught before any brief was authored for shipped work. Ninth signal: Rule 17 caught that Mobile FU#4 had already shipped at PR #154 when dispatcher pivoted to "Mobile FU#4 cosmetics" — same catch, same layer. Memory's "Mobile FU#4 cosmetics" label in the session backlog is stale and needs a sweep. Eleventh consecutive Rule 16 cycle, zero drift maintained.

**Next.** Smaller follow-ups remaining: react-hooks ×3, aria-label sweep (CampaignForm L283 + History row banked from Mobile FU#2), `bg-[var(--color-X)]` arbitrary-syntax sweep, untracked legacy briefs/scripts cleanup (2026-05-13 banked — 9 briefs + 5 scripts surfaced today via `git status`), shakedown bugs 001/003/004/006, Wizard R2-R5 residual. Resend invite UI (MEDIUM) remains in Active follow-ups table for substantive work.

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
