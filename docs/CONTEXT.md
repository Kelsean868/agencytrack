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
| Last updated | `2026-05-19` |
| Current main HEAD | `d84a752` (feat(dispatcher): tooling scripts + CC slash commands + CLAUDE.md section, #217) |
| Active track | Dispatcher tooling shipped (PR #217, squash `d84a752`). `scripts/dispatcher/new-brief.ps1` + `/dispatch` + `/post-merge` slash commands + CLAUDE.md § Dispatcher tooling. First deployment of `/post-merge` validated by this very fill commit — round trip works (CC discovered both new slash commands at first session reload after merge). |
| Next track | First end-to-end validation of `/dispatch` → execute → open PR → `/post-merge` flow lands on the next dispatched PR. Wizard R2-R5 residual queued after. |
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
| Orphan cleanup | UID `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc with no Auth user | No | Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). |

---

## Recently shipped

| PR | SHA | Description |
|---|---|---|
| #217 | `d84a752` | Dispatcher tooling — `scripts/dispatcher/new-brief.ps1` + `/dispatch` + `/post-merge` slash commands + CLAUDE.md § Dispatcher tooling. Reduces per-PR copy-paste between dispatcher (Claude chat), operator, and Claude Code. Canonical methodology (Session Protocol, § Post-merge local cleanup, Methodology Rules 1–17) remains authoritative — tooling embeds rules, does not replace them. Two Rule 17 source-verify catches in the brief during execution (`docs/CLAUDE.md` → `CLAUDE.md` path correction at Phase 1; `.gitignore` `.claude/commands` scope premise → broader `.claude/` exclusion at Phase 5 staging; both resolved with dispatcher acknowledgement). Mechanical `.gitignore` adjustment inside Option A: `.claude/` → `.claude/*` so git walks the directory and negation patterns reach children. Smoke waived: pure tooling, no source/Firestore/runtime surface. First deployment of `/post-merge` is this fill commit itself. |
| #215 | `3690bf6` | Feature: per-row Resend invite button on `UserManagementPanel.jsx` action cell (between Edit and Deactivate). Client-side `sendPasswordReset()` from `authService.js` per FU body's short-term direction (Q1). Lucide `MailPlus` icon, square ghost-icon button matching the Edit-row pattern. ConfirmDialog with edge-case copy "Previous reset email link will stop working." Visibility gated `canAct && !isInactive` (Q2). aria-label="Resend invite email to {user}" applied from the start — pre-empts future a11y sweep finding. 3 buttons always on row — kebab/responsive pattern deferred to future dedicated mobile-manager pass (Q4). 2 new tests in `src/components/manager/__tests__/UserManagementPanel.test.jsx` (visibility gate + confirm-then-send) with `waitFor` discipline from PR #210. **Q3 revised at Phase 1 surface** (Rule 11 corrected-diagnosis): original "yes, audit log entry mirroring `auditAdminEmailUpdates`" → DEFERRED after Phase 1 surfaced no audit module exists (current pattern is inline `addDoc` to a self-service-shaped top-level collection; sibling collection would need Firestore rules work). Audit log entry banked as new LOW follow-up alongside the server-side `mail/` doc consistency swap. 15th Rule 17 in-the-wild signal of the arc — audit module pattern didn't match brief assumption captured at authoring time. Closes FU "Resend invite UI" (MEDIUM). |
| #213 | `38be348` | A11y hygiene: comprehensive aria-label sweep — 10 sites across 6 files. Class A icon-only controls (8 sites) get `aria-label`: 7 buttons (CampaignPanel ×2, AgentDashboard history row with templated week-of label, UserManagementPanel CreateUserDrawer close, CareerPortal cancel-edit, KioskModeTab Copy/Revoke) + 1 anchor (KioskModeTab "Open kiosk", added via Rule 9 in-PR scope extension — adjacent finding in file already in scope, identical defect class). Class B mobile-hidden-text pattern (2 sites in ManagerDashboard: Export Branch Report + Start Meeting) gets `hidden md:inline` → `sr-only md:not-sr-only` swap so visible text stays in a11y tree at all viewports. Closes FU "History row aria-label" (L992, banked Mobile FU#2 closure) + FU "CampaignForm close button missing aria-label" (L1059, banked Mobile FU#4 smoke). Smoke walk waived per Rule 27 default — a11y-tree-only changes with no visible UI behavior delta. |
| #211 | `dff2847` | Docs hygiene: archived 9 stale kickoff briefs (PR-3, Track-E E1/E4/E5/E6, PR-D) to `docs/archive/briefs/` via filesystem move + `git add`. Closes FU "Untracked legacy briefs + verification scripts cleanup" (LOW, banked 2026-05-13) per briefs portion; 6 untracked verification scripts intentionally deferred per FU body's reusable-scripts direction. Rule 11 corrected-diagnosis: FU body's banked "11 untracked files" was stale; actual at resolution was 15 (4 additional scripts post-banking). Rule 17 eleventh signal: brief prescribed `git worktree add` for untracked-file work — worktrees share tracked object store but not untracked files; Phase 1 hard-stop caught it; fix was to work from main working tree. |
| #210 | `f493a0c` | Hotfix: EditUserDrawer test CI race — added waitFor between unit-select change and save click in "demoting to agent with unitId selected" test. Pre-existing pattern surfaced on PR #209 (docs brief) CI; passes locally but slower CI runner exposed the missing state-flush wait between fireEvent.change and fireEvent.click. Same shape as PR #189 hotfix yesterday (WeeklyActivityPanel timezone). |

---

## Pending operational state

These don't block anything, but they need to be resolved or carried forward each session.

- **Orphan user** `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc exists but no Auth user. Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). Do not auto-delete; investigate first.
- **Node.js 20 Functions runtime** deprecated 2026-04-30, decommission 2026-10-30 — migration to Node 22 is a separate ticket. Not blocking; CLAUDE.md locks v1 runtime for current track.
- **`firebase-functions` SDK** at 4.9.0 — upgrade to ≥5.1.0 has breaking changes; schedule as own ticket post-pilot.
- **Worktrees + stale local branches** — multiple worktrees and ~15 stale local branches attached to merged feature branches. Cleanup banked in `docs/FOLLOW_UPS.md` § Worktree + branch audit.

---

## Where we left off

> **Session boundary:** Session C continues. Dispatcher tooling shipped (PR #217, squash `d84a752`). This Phase 6 fill is the **sixteenth formal application of Rule 16** and the **first deployment of the new `/post-merge` slash command** — round-trip discovery validated (CC reloaded with both `/dispatch` and `/post-merge` in the available skills list at session start).

**Dispatcher tooling (PR #217, 2026-05-19).** Ships three tooling additions plus a new CLAUDE.md § Dispatcher tooling section. `scripts/dispatcher/new-brief.ps1` codifies the Rule 10 brief-PR shuffle (Phase 0 gate → fresh branch → commit → push) as a one-command operator workflow. `.claude/commands/dispatch.md` defines `/dispatch <brief-path>` so dispatcher can hand CC a brief path instead of the long-form "PR dispatch — Kickoff brief: ..." prose payload. `.claude/commands/post-merge.md` defines `/post-merge <pr-number>` so the canonical post-merge sequence (sync main → capture squash SHA → fill placeholders → commit → push → Rule 15 verification) runs as a single CC invocation. Smoke waived — pure tooling addition, no source code, no Firestore rules, no user-visible surface, no runtime behavior change.

**Two Rule 17 source-verify catches during execution, both resolved with dispatcher acknowledgement.** (1) Phase 1 step 3 — brief referenced `docs/CLAUDE.md`; actual file is `CLAUDE.md` at repo root. Caught at the file-not-found sanity check; dispatcher confirmed path correction. (2) Phase 5 staging — brief's Phase 1.4 grep was scoped to `\.claude/commands`; actual `.gitignore` line was the broader `.claude/` directory exclusion which blocks descent and would have prevented the new slash command files from being tracked. Caught at `git add` (paths-ignored error); dispatcher confirmed Option A negation pattern. Mechanical follow-on inside Option A: pattern needed to be `.claude/*` (file-glob, walks the directory) rather than `.claude/` (directory exclusion) because git can't re-include children of an excluded parent directory; intent of Option A fully preserved.

**Phase 4 stale-row audit (Rule 8).** Surface finding during placeholder enumeration: `docs/FOLLOW_UPS.md:857` and `:865` contain stale `PR #{TBD}` placeholders from PR #215's brief (Resend invite shipped MVP + audit log deferred FUs) that didn't get filled by PR #215's post-merge sequence (`c12e23f`, fill commit for #215). Not in scope for this PR's fill (Rule 16 fills only placeholders introduced by THIS PR). Banked for a separate stale-row cleanup PR — dispatcher to authorize. Strike count holds 0/2 throughout the arc.

**Next track.** First end-to-end validation of `/dispatch` → execute → open PR → `/post-merge` lands on the next dispatched PR. Wizard R2-R5 residual remains queued after.

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
