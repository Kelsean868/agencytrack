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
| Last updated | `2026-05-05` |
| Current main HEAD | `75f09d1` (user-mgmt PR-2 squash, PR #26) |
| Active track | User-management PR-3 — plan-first session (UI matrix: typed-confirmation, deactivate/reactivate UI, createUser call sites) |
| Next track | Track A remaining (WizardForm debounce, AgentDashboard dead-mount cleanup) |
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
- **Post-merge verification mandatory:** `git fetch origin && git log origin/main --oneline -5` AND a production walkthrough via `scripts/exploration-walk.cjs`.
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
| user-mgmt PR-1 | Schema + atomicity foundation | ✅ shipped | Production migration `--apply` run 2026-05-05. Kyron normalization resolved by seed script (PR-2 session). |
| user-mgmt PR-2 | Polymorphic createUser + bypass removal + bootstrap deletion | ✅ shipped | Merged `75f09d1`, functions deployed 2026-05-05. 3-role production smoke ✓. |
| user-mgmt PR-3 | UI matrix — typed-confirmation, deactivate/reactivate panel, createUser call sites | Plan-first | Opus recommended for planning. Covers: filtered dropdowns, Show deactivated toggle, createAgentAccount wrapper removal. |
| SEC-9b | Migrate services to explicit `tenantId` parameter | No | ~20 call site refactor; schedule after user-mgmt ships |
| SEC-11 | Replace AuthContext bootstrap with seed script | **✅ CLOSED in PR-2** | Bootstrap block deleted; seed-first-super-admin.cjs is the provisioning path going forward. |
| Orphan cleanup | UID `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc with no Auth user | No | Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). |
| SEC-9c | Server-side tenant isolation for scheduled Cloud Functions | No | Scheduled functions still hardcode `TENANT_ID = 'tatillife_south'`; future work |
| SEC-12 | unitGoals write rule references missing `unitId` claim | No | Discovered during PR-1 audit; rule branch at `firestore.rules:118-120` is dead code today (unit_manager writes always fall through to false). Tracked in [#23](https://github.com/Kelsean868/agencytrack/issues/23). |

---

## Recently shipped (last 5 PRs)

| PR | SHA | Description |
|---|---|---|
| #26 | `75f09d1` | feat(user-mgmt) — PR-2 polymorphic createUser + deactivateUser + bypass removal (closes SEC-11) |
| #24 | `3cca307` | feat(user-mgmt) — PR-1 schema + atomicity foundation (branchId, ownedBranchIds, active, saga, migration) |
| #22 | `b43c023` | fix(tooling) — env loader fails loudly on malformed `.env.local` (TOOLING-N) |
| #21 | `b07e512` | chore — `docs/CONTEXT.md`, `docs/kickoff-template.md`, ignore `.session-handoffs/` |
| #16 | `f17e217` | SEC-9 — runtime tenant ID holder, 18 files migrated |

---

## Pending operational state

These don't block anything, but they need to be resolved or carried forward each session.

- **Empty worktree dir** at `.claude/worktrees/sad-meninsky-278312` — git worktree manifest cleared, but the OS directory remains. Cosmetic, run `rmdir` from any fresh shell whose cwd is not under it.
- **Last verification artifacts** (post-PR-2 smoke): `verification/pr1-postmerge-smoke-*-2026-05-05T1143.*`. Local-only by design.
- **Orphan user** `C94hjdd6GXfdim9EfgPYAAIbDOJ2` — Firestore doc exists but no Auth user. Tracked [#25](https://github.com/Kelsean868/agencytrack/issues/25). Do not auto-delete; investigate first.
- **Node.js 20 Functions runtime** deprecated 2026-04-30, decommission 2026-10-30 — migration to Node 22 is a separate ticket. Not blocking; CLAUDE.md locks v1 runtime for current track.
- **`firebase-functions` SDK** at 4.9.0 — upgrade to ≥5.1.0 has breaking changes; schedule as own ticket after user-mgmt ships.

---

## Where we left off

> **Session boundary:** End of user-mgmt PR-2 production sequence (2026-05-05).

PR-2 shipped to production (squash `75f09d1`, PR #26). Full production sequence completed 2026-05-05:

1. **Phase 1 — Seed:** `seed-first-super-admin.cjs --apply` run against Kyron's UID (`4GeeZbhZBwdtGOLoJoggf4MQo142`). All 4 fields verified: `role`, `tenantId`, `branchId: 'tatil_south'` (was `'branch_001'`), `ownedBranchIds: ['*']`. Refresh tokens revoked — Kyron must re-login to pick up new claims.
2. **Phase 3 — Deploy:** `firebase deploy --only functions` — all 9 functions deployed (`createUser` new, `deactivateUser` new, 7 updated).
3. **Phase 3 — Smoke:** 3-role production smoke ✓ — all loginOk, dashboardOk, 0 console errors, 0 network failures. No bootstrap warn fired. No `setUserClaims` call from AuthContext. SEC-11 and bypass removal confirmed live.

Kyron normalization gap (branchId `'branch_001'` → `'tatil_south'`) is **CLOSED**.

**Next:** PR-3 — plan-first session (Opus recommended). Covers: typed-confirmation dialog for super_admin creation, deactivate/reactivate UI panel, Show deactivated toggle, `createUser` call sites in `agentManagementService.js` + `AgentManagementPanel.jsx`, `createAgentAccount` wrapper removal.

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
