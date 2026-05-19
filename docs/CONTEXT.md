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
| Current main HEAD | `{TBD}` (chore(verification): resolve 7 untracked scripts — 6 track, 1 delete, #TBD) |
| Active track | Untracked scripts resolution — `chore/untracked-scripts-resolution` in flight. 6 TRACK (structural peers of existing 19 tracked smokes under `scripts/verification/`) + 1 DELETE (`pr-d-email-smoke.mjs` — `service-account-key.json` import violation per CLAUDE.md + production-mutation surface; purpose discharged at PR #133) + 2 polish comments (PREVIEW_HOST env override documentation on mobile-fu2/mobile-fu4). |
| Next track | Pending: Resend invite `mail/` swap (#215), Resend invite audit log (#215), PREVIEW_HOST override for 2 verification smokes (new LOW, banked this PR). |
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
| #TBD | `{TBD}` | Untracked verification scripts resolution — 6 TRACK (peers of existing 19 tracked smokes under `scripts/verification/`), 1 DELETE (`pr-d-email-smoke.mjs` — `service-account-key.json` import violation per CLAUDE.md ban post-PR #78 + hardcoded production identifiers + production-mutation surface; purpose discharged at PR #133), 2 polish comments documenting PREVIEW_HOST env override on mobile-fu2 + mobile-fu4 smokes. Rule 17 source-verify catch at Phase 2 Edit 3 — brief premise asserted all 4 polish targets read PREVIEW_HOST; source check showed only 2 of 4 do (`border-border-smoke.mjs` + `resend-invite-ui-smoke.mjs` hardcode without override). Polish scope corrected to 2 actual override-supporting scripts; missing override on the other 2 banked as new LOW refactor FU. Sixth Rule 17 catch of the 2026-05-19 dispatcher arc and first under the newly-banked Rule 17 sub-bullet (PR #223, `d40fa85`) — meta-validation that the sub-bullet caught a brief premise gap on the next dispatched PR. Smoke waived: pure repo housekeeping, no app runtime surface change. |
| #223 | `d40fa85` | Rule 17 source-verification sub-bullet — formalizes Phase 1 paired verification commands for source-derived claims. Banks four-catch pattern from PR #217/#219/#221 cycles. Codifies CC's correct Rule 9 judgment on per-token count handling. |
| #221 | `e074b50` | @apply CSS-var sweep — 11 substitutions across 4 `@layer components` rules in `src/index.css` (`.btn-secondary`, `.card`, `.input`, `.label`). Channel-split tokens preserve runtime color; capability-additive (opacity-modifier support). Closes @apply sweep FU banked from PR #219. |
| #219 | `0b3f058` | Tailwind CSS-var sweep — 9 arbitrary-value utilities replaced with named tokens across 6 files (PR #155 precedent). 5 replacement rules: `border-[var(--color-border)]` (2x) → `border-border`; `bg-[color:var(--color-surface-raised)]` (1x) → `bg-surface-raised`; `border-[color:var(--color-primary)]` (1x) → `border-primary`; `hover:bg-[color:var(--color-primary-dark)]` (3x) → `hover:bg-primary-dark`; `accent-[color:var(--color-primary)]` (2x) → `accent-primary`. Static CSS bundle verification: all 5 replacement classes emit with correct channel-split var resolution. Smoke waived: internal refactor, byte-equivalent computed-style resolution (precedent PR #155). New LOW FU banked: `@apply` sweep in `src/index.css` `@layer components` rules (`.btn-secondary`, `.card`, `.input`, `.label`) — requires `@apply`-resolution research before sweeping. Rule 17 brief-authoring nit logged: Phase 1 step 3 referenced `src/components/reports/AgentReportDocument.jsx`; canonical path per CLAUDE.md is `src/components/profile/AgentReportDocument.jsx`. Check intent (zero arbitrary-value matches in @react-pdf renderer file) was satisfied against the canonical path. Second data point on `/post-merge` slash command UI discovery anomaly recorded against this PR's `/dispatch` invocation. |
| #217 | `d84a752` | Dispatcher tooling — `scripts/dispatcher/new-brief.ps1` + `/dispatch` + `/post-merge` slash commands + CLAUDE.md § Dispatcher tooling. Reduces per-PR copy-paste between dispatcher (Claude chat), operator, and Claude Code. Canonical methodology (Session Protocol, § Post-merge local cleanup, Methodology Rules 1–17) remains authoritative — tooling embeds rules, does not replace them. Two Rule 17 source-verify catches in the brief during execution (`docs/CLAUDE.md` → `CLAUDE.md` path correction at Phase 1; `.gitignore` `.claude/commands` scope premise → broader `.claude/` exclusion at Phase 5 staging; both resolved with dispatcher acknowledgement). Mechanical `.gitignore` adjustment inside Option A: `.claude/` → `.claude/*` so git walks the directory and negation patterns reach children. Smoke waived: pure tooling, no source/Firestore/runtime surface. First deployment of `/post-merge` is this fill commit itself. |

---

## Pending operational state

These don't block anything, but they need to be resolved or carried forward each session.

- **Orphan user** `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc exists but no Auth user. Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). Do not auto-delete; investigate first.
- **Node.js 20 Functions runtime** deprecated 2026-04-30, decommission 2026-10-30 — migration to Node 22 is a separate ticket. Not blocking; CLAUDE.md locks v1 runtime for current track.
- **`firebase-functions` SDK** at 4.9.0 — upgrade to ≥5.1.0 has breaking changes; schedule as own ticket post-pilot.
- **Worktrees + stale local branches** — multiple worktrees and ~15 stale local branches attached to merged feature branches. Cleanup banked in `docs/FOLLOW_UPS.md` § Worktree + branch audit.

---

## Where we left off

> **Session boundary:** Untracked verification scripts resolution in flight on `chore/untracked-scripts-resolution`. Repo housekeeping closing the 7-untracked-script overhang banked deferred at PR #211 (per Rule 11 corrected-diagnosis paragraph in the resolved Untracked-legacy-briefs FU section). 6 TRACK + 1 DELETE + 2 polish + 1 new LOW FU banked.

**Untracked scripts resolution (PR #TBD, 2026-05-19).** Resolves the 7 verification scripts left untracked across sessions. 6 added to the repo as structural peers of the existing 19 tracked smokes under `scripts/verification/` (this is the established convention). 1 deleted: `pr-d-email-smoke.mjs` — imports forbidden `functions/service-account-key.json` per CLAUDE.md ban post-PR #78 + hardcoded production UID + emails + tenant ID + mutates production (creates/deactivates 4 users, sends real emails); purpose discharged at PR #133 ship time. Reversible if Track D cron audit returns — write a fresh ambient-creds version then.

**Rule 17 source-verify catch at Phase 2 Edit 3.** Brief premise asserted all 4 polish targets read `process.env.PREVIEW_HOST`. Source check showed only 2 of 4 do (`mobile-fu2` + `mobile-fu4`); the other 2 (`border-border` + `resend-invite-ui`) hardcode without override. Polish scope corrected to 2 actual override-supporting scripts; the missing override on the other 2 banked as new LOW refactor FU (XS scope, 2 line changes total). Sixth Rule 17 catch of the 2026-05-19 dispatcher arc — and the first one under the newly-banked Rule 17 sub-bullet (PR #223, `d40fa85`) — meta-validation that the sub-bullet caught a brief premise gap on the very next dispatched PR.

**Next track.** Resend invite `mail/` doc consistency swap (LOW, banked PR #215); Resend invite audit log (LOW, banked PR #215); PREVIEW_HOST env override for 2 verification smokes (LOW, banked this PR); `/post-merge` UI discovery investigation (LOW, banked PR #217 cycle).

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
