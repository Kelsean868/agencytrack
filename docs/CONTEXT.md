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
| Last updated | `2026-05-07` |
| Current main HEAD | `5099019` (docs — add B4 kickoff brief: sidebar shell + mobile drawer, PR #51) |
| Active track | Track B (v2) — B4 desktop sidebar shell + mobile bottom-nav (in progress on `design-v2-b4-shell`). B1 medal badges shipped (PR #44), B2 goal carousel shipped (PR #47), B3 activity feed + BadgeGrid surface shipped (PR #49), PR #50 tightened post-merge cleanup, PR #51 landed B4 kickoff brief. |
| Next track | Track B (v2) — B5 tenant admin config |
| Queued | **Track B (v2) — Design System v2 redesign.** 5-PR sequence (B1 medal badges → B2 goal carousel → B3 activity feed → B4 sidebar shell → B5 tenant admin config). Specs: `docs/design-v2-PRD.md` + `docs/design-v2-implementation.md`. Visual source of truth: `mocks/concept-4-complete.html`. Replaces original Track B "visible polish" scope. |
| Two-strike counter | 0 — resets each session |
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

### User-management hierarchy matrix (next track, plan approved)

**Hierarchy:**
```
Agent → Unit Manager → Branch Manager → Sales Manager → Super Admin (Kyron)
```

> **Override of CLAUDE.md:** CLAUDE.md lists 4 roles and notes Sales Manager as "deferred to Phase 9." This is now superseded — Sales Manager ships in this work.

**Creation matrix:**

| Creator | Can create |
|---|---|
| Super Admin | Sales Manager, Branch Manager, Unit Manager, Agent, **Super Admin** |
| Sales Manager | Branch Manager, Unit Manager, Agent (NOT other Sales Managers) |
| Branch Manager | Unit Manager, Agent **within their branch** |
| Unit Manager | Agent **within their unit** |
| Agent | (nothing) |

Rule: no tier creates its own peers, except Super Admin → Super Admin.

**Schema decisions (Path C):**
- `branchId: string` on every user doc. Default backfill: `'tatil_south'`.
- `ownedBranchIds: string[]` on manager docs. `['*']` wildcard for super_admin and sales_manager.
- Both fields mirrored to Firebase Auth custom claims for cheap rule reads.
- No `/branches` collection. Enumerated branch list lives at `/tenants/{tid}/meta/branches`.
- `active: boolean` field for soft-delete. Missing field treated as truthy (active).
- `/auditSuperAdminCreations/{auto-id}` top-level collection for super_admin creation audit log. (Originally referenced as `/audit/superAdminCreations/{auto-id}` in plan shorthand; flattened to a single segment to satisfy Firestore's even-segment doc-path rule.)

**Atomicity (memory-locked):**
- Account creation must write tenantId and branch fields to **both** the user doc **and** the auth custom claim in a single transactional path.
- Pattern: provisioning-flag saga — `provisioning: true` doc write → set claims → clear flag. On claim-set failure, compensating delete of both auth user and Firestore doc. Reads filter `provisioning != true`.

**Other locked design decisions:**
- Single polymorphic `createUser` Cloud Function with `role` parameter (replacing `createAgentAccount`).
- Super Admin self-creation requires typed-confirmation field — must type `CREATE SUPER ADMIN` verbatim.
- Audit log writes only on super_admin creation, captures `creatorUid`, `creatorEmail`, `createdUid`, `createdEmail`, `ip`, `userAgent`, `timestamp`, `confirmationGiven`.
- One email = one role. No dual-role accounts.
- Functions runtime stays v1 for this work. v2 migration is its own ticket.
- Refresh-token revocation on deactivation — immediate, with UX modal stating "user will be signed out immediately, unsaved work lost."
- Bootstrap path in AuthContext deleted in user-mgmt PR-2 (closes SEC-11). Replaced by `scripts/seed-first-super-admin.cjs` for new-tenant provisioning.
- `SUPER_ADMIN_UID` hardcoded bypass at `functions/index.js:7` removed in PR-2.

**PR sequencing (3 PRs, sequenced):**
1. **PR-1** — Schema + atomicity foundation: new fields, backfill migration, dual-write saga, sales_manager role added to rules, `/audit` collection rules. Bypass NOT removed yet (circular dependency).
2. **PR-2** — Polymorphic `createUser` Cloud Function, audit log writes, bootstrap path deletion, `SUPER_ADMIN_UID` removal, `seed-first-super-admin.cjs` script. `createAgent` retained as thin wrapper for backwards compat.
3. **PR-3** — UI matrix: filtered dropdowns per tier, typed-confirmation field, deactivate/reactivate UI, `Show deactivated` toggle, `createAgent` wrapper removed.

**Audit findings surfaced during PR-1 plan (locked):**
- **Finding 1** — CLAUDE.md "Known Open Items #1" previously claimed `firestore.rules` had a hardcoded super_admin UID bypass. The bypass actually lives in `functions/index.js:7` (referenced at `:65` in `setUserClaims`). Reworded in CLAUDE.md as part of PR-1.
- **Finding 2** — CLAUDE.md "Known Open Items #8" claimed `firebase.js` used deprecated `enableIndexedDbPersistence`. The migration to `persistentLocalCache` already shipped at some prior point. Item removed from CLAUDE.md in PR-1.
- **Finding 3 (SEC-12)** — `firestore.rules:118-120` references `request.auth.token.unitId` for the `unit_manager` write path on `/unitGoals`, but `unitId` is never written as a custom claim by `setUserClaims` or `createAgentAccount` (only `role` and `tenantId`). The `unit_manager` branch always evaluates false; only super_admin/branch_manager actually write unitGoals today. Out of scope for PR-1; tracked as SEC-12.
- **Q5 UID-header precedent** — Production UIDs are committable in code (e.g., migration script header comment, CONTEXT.md test-environment references). Real names are NOT committable. Pattern: `role: <UID>  [name redacted]`. Established as locked precedent in PR-1.

### Workflow rules

- **Worktree branches only.** Never push directly to `main`.
- **Squash merges** via GitHub UI only. No auto-merge.
- **Post-merge verification mandatory:** `git fetch origin && git pull origin main && git log origin/main --oneline -5` AND a production walkthrough via `scripts/exploration-walk.cjs`. The pull is required so worktree-local tooling matches production — fetch alone leaves the working tree at pre-merge state and verification scripts may run stale.
- **Production polling retired** (PR #15) — production deploy verification is manual via Vercel dashboard.
- **Verification artifacts stay local** — logs, screenshots, one-off scripts under `verification/` are gitignored by design.

### Test environment references

- **Test agent:** `kelsean@gmail.com` / password in `.env.local` as `A11Y_AGENT_PASSWORD`. UID: `J0j4uBqzTPcfm1IlGCPyDzo27RP2`.
- **Vercel bypass:** token in `.env.local` as `VERCEL_BYPASS_TOKEN`. Usage: `?x-vercel-protection-bypass=<TOKEN>&x-vercel-set-bypass-cookie=true` on first request, sets cookie. **Never echo the value to chat or logs.**
- **Super Admin (production):** Kyron, UID `4GeeZbhZBwdtGOLoJoggf4MQo142`, Auth email `kyron@tatillife.com`.

---

## Active follow-ups

| Ticket | Title | Blocking? | Next action |
|---|---|---|---|
| user-mgmt PR-3 | UI matrix — typed-confirmation, deactivate/reactivate panel, createUser call sites | ✅ shipped | Merged in PR #28 / #29 (deactivate UI + super_admin retirement cleanup). Wrapper removal complete. |
| A11y arc + Mobile audit | PR3→PR7 dark-mode contrast pass + mobile pilot pass | ✅ shipped | Closed in PR #38. CI gate enforcing 32 jsx-a11y rules at error. |
| Mobile FU#1 | Manager surface mobile pass (next-week scope) | No | Estimated 1–2 days. `MasterSheet.jsx` 23-column grid, `SettlementPanel.jsx` three grids, `ManagerDashboard.jsx`/`ManagerAwardsPanel.jsx`/`GoalsPanel.jsx`/`CampaignPanel.jsx` tab bars (h-9), `MeetingMode.jsx` mobile presentation, `UserManagementPanel.jsx` rows. Not pilot-blocking — Tatil managers will use desktop/tablet. Source: `docs/FOLLOW_UPS.md`. |
| Mobile FU#2 | Non-core agent surface P1s | No | `CareerPortal` "Edit My Goals" 32px → 44px, `History` row eye/preview hit area, `CommissionPlayground` accordion toggle measure-and-adjust. Source: `docs/FOLLOW_UPS.md`. |
| Mobile FU#3 | `bg-primary/N` opacity utilities silently transparent | No | Tailwind 3 `<color>/<opacity>` modifier fails because `--color-primary` is hex, not space-separated RGB channels. Carousel inactive dots are the visible symptom; needs codebase-wide audit. Right fix: convert CSS vars to channel form (`1 105 111`) and switch consumers to `rgb(var(--color-primary))`. Source: `docs/FOLLOW_UPS.md`. |
| Mobile FU#4 | P2 cosmetic items | No | Wizard close (X) button 40×40 → 44×44, Leaderboard avatar tap-row, `MotivationalCarousel.jsx:366` hardcoded `bg-[#01696f]/8` → token. Source: `docs/FOLLOW_UPS.md`. |
| Wizard UX + A11y Hardening | Retry button, `aria-live`, success indicator, offline-vs-failed distinction, persistent-failure handling | No | Surfaced during Track A PR-1 audit (2026-05-06). Items 5+6 already shipped in commit `57828d7`, but audit found genuine hardening gaps. `aria-live` is the highest a11y value and could ship as a one-line micro-PR. Source: `docs/FOLLOW_UPS.md`. |
| SEC-9b | Migrate services to explicit `tenantId` parameter | No | ~20 call site refactor; schedule after Track A. |
| Orphan cleanup | UID `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc with no Auth user | No | Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). |
| SEC-9c | Server-side tenant isolation for scheduled Cloud Functions | No | Scheduled functions still hardcode `TENANT_ID = 'tatillife_south'`; future work |
| SEC-12 | unitGoals write rule references missing `unitId` claim | No | Discovered during user-mgmt PR-1 audit; rule branch at `firestore.rules:118-120` is dead code today (unit_manager writes always fall through to false). Tracked in [#23](https://github.com/Kelsean868/agencytrack/issues/23). |

---

## Recently shipped (last 5 PRs)

| PR | SHA | Description |
|---|---|---|
| #51 | `5099019` | docs(design-v2) — add B4 kickoff brief (sidebar shell + mobile drawer) |
| #50 | `cb21cce` | chore(workflow) — tighten post-merge verification + clean stale remote branches |
| #49 | `082a6b3` | feat(design-v2-b3) — activity feed + BadgeGrid surface + cleanup |
| #48 | `f2c3a89` | docs(design-v2) — add B3 kickoff brief (activity feed + BadgeGrid surface + cleanup) |
| #47 | `657d25b` | feat(design-v2-b2) — goal carousel + donut hero |

---

## Pending operational state

These don't block anything, but they need to be resolved or carried forward each session.

- **Untracked legacy doc** at `docs/PR-3-Claude-Code-Brief.md` — stale brief from user-mgmt PR-3 (shipped in PR #28). Intentionally left untracked across PR #39 + #40. Decide separately whether to archive to `docs/archive/` or delete.
- **Orphan user** `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc exists but no Auth user. Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). Do not auto-delete; investigate first.
- **Node.js 20 Functions runtime** deprecated 2026-04-30, decommission 2026-10-30 — migration to Node 22 is a separate ticket. Not blocking; CLAUDE.md locks v1 runtime for current track.
- **`firebase-functions` SDK** at 4.9.0 — upgrade to ≥5.1.0 has breaking changes; schedule as own ticket after Track A ships.
- **`MotivationalCarousel.jsx` still consumed by `ManagerDashboard.jsx:24,247`** — B2 audit and B3 kickoff both incorrectly assumed the file was orphaned by B2's S3 decision. B3 audit (S1) caught the live consumer in ManagerDashboard's overview tab. Deletion dropped from B3 scope. Decision on Manager-side replacement deferred to manager dashboard redesign work (likely B4 sidebar shell or a follow-up Manager surface PR).

---

## Where we left off

> **Session boundary:** B4 in flight — desktop sidebar shell + mobile bottom-nav (2026-05-07).

PR #49 shipped B3 (activity feed + BadgeGrid surface on AgentDashboard, derived client-side from already-loaded submissions, capped at 25 events in last 7 days). B3's audit caught `MotivationalCarousel.jsx` as a live consumer at `ManagerDashboard.jsx:24,247` — not orphaned as B2 had assumed; deletion remains deferred. PR #50 tightened post-merge cleanup: `git fetch origin && git pull origin main` is now mandatory before production walkthrough so worktree-local tooling (especially `scripts/exploration-walk.cjs`) matches origin, and `git branch -D` is the canonical local-branch cleanup since GitHub's `deleteBranchOnMerge` prunes the remote tracking ref before lowercase `-d` can verify merge status. PR #51 landed the B4 kickoff brief.

B4 (this session) ships the desktop sidebar shell + mobile bottom-nav, wraps both dashboards, relocates the dark-mode toggle / `NotificationBell` / `SyncIndicator` into a new `TopBar`, and absorbs the deferred g4-mix 2-col layout (activity feed + achievements side-by-side at ≥1024px). B4 audit on arrival surfaced three surprise-stops resolved before any code: (1) only 2 of 5 role test accounts existed in `.env.local` — Kyron provisioned the missing 3 and renamed the existing manager key, so `.env.local` now holds `A11Y_AGENT_*` / `A11Y_BRANCH_MANAGER_*` / `A11Y_UNIT_MANAGER_*` / `A11Y_SALES_MANAGER_*` / `A11Y_TENANT_ADMIN_*`; (2) the mock arbitrates against the kickoff brief's drawer pattern — bottom-nav only at <768px, no hamburger drawer (PRD § 3.1 supports); (3) mock breakpoints (900 / 680) ceded to plan/kickoff (1024 / 768) during the token-swap pass. Provisioning surfaced 3 HIGH-priority pre-existing bugs likely regressed from the May 5 roles refactor (user-creation skips password-reset email; role-label map missing `sales_manager` → "Unknown" in TopBar/User Roster; possible wider mapping gap pending B4 walkthrough verification) — logged in `docs/FOLLOW_UPS.md`. Pre-existing-bug acknowledgment for B4: the all-roles preview matrix may show "Unknown" in the TopBar role label for `sales_manager` (and possibly `tenant_admin`/`platform_admin`); this is **not** a B4 regression and is documented in the PR description.

**Next: B5 (tenant admin config surface).** Reads/writes `config/companyMinimums`, surfaces the 6-tile config grid + role distribution + branch health overview. Largest behavioural deliverable in B5 is the editable `config/companyMinimums` write path. Gates on B4 merge + post-merge production walkthrough.

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
