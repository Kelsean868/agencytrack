# Agent Termination Flag (soft-delete) — Phase-1-FIRST Kickoff Brief

**Track:** Agent termination flag — cross-cutting soft-delete. **Type:** data-model field + Firestore rule + roster filtering + set-path UI. **Size:** M (cross-cutting; exact scope confirmed in Phase 1). **Risk:** MEDIUM-HIGH — touches `firestore.rules` (user-doc update arm) and every roster/awards consumer; emulator rule tests required.
**Goal of eventual PR:** add a soft-delete flag to agent user docs, settable by the right manager roles, and filter terminated agents out of all *active* rosters / awards / leaderboards / at-risk views while PRESERVING their historical submission / settlement / persistency data.

**PHASE-1-FIRST.** Source-verify, report, STOP. No code. The dispatcher locks the field name, the filter strategy, and the set-path before any build. The cross-cutting consumer map is the load-bearing output of this phase.

---

## Phase 0 — clean main
git checkout main; git fetch origin; git pull --ff-only origin main; git status
Untracked scripts/verification/ + scripts/seed/ expected — ignore. Do NOT create a branch (read-only).
Rule 12 hard stops: not on main, dirty tree beyond known untracked, pull conflict -> `STOP and wait for dispatcher`.

---

## Phase 1 — source-verify, then HARD-STOP

Pair every grep with `git ls-files`; quote file:line. Then emit `STOP and wait for dispatcher`.

1. **The central roster source.** Quote `getTenantUsers` in `src/services/managerService.js` — full signature + the query it runs. Does it already accept an options arg? Does it filter on anything today? This is the single most important read: if most consumers route through it, one filter here covers them.

2. **THE CONSUMER MAP (the key deliverable).** Find every place that lists agents/users and feeds a roster, ranking, award, or stat. For EACH, report: file:line, and whether it (a) routes through `getTenantUsers` (would inherit a central filter) or (b) runs its OWN user/agent query (needs its own filter). Check at least: Leaderboard (`src/components/gamification/`), MasterSheet, PersistencyTab / `persistencyService.js`, MonthlyRecruitingTab / `managerMonthlyRollupService.js`, `ManagerAwardsPanel` (`agentIds` feed), `BmAtRiskPanel` (`agentProfiles`), `ManagerDashboard` (the getTenantUsers useEffect). Grep `getTenantUsers` usages + any independent `collection('users')` / `where('role'...)` queries. Produce a table: consumer | central-or-own-query | needs-its-own-filter?

3. **The set-path.** Quote `EditUserDrawer` + the `updateUser` Cloud Function and/or `updateUserFields` service — what fields do they currently permit editing, and what's the permission matrix? Where would a "terminate / reactivate" control live (EditUserDrawer toggle vs a UserManagementPanel action)?

4. **The rule arm.** Quote the `allow update` rule for `/tenants/{tid}/users/{agentId}` in `firestore.rules` — what fields are settable, by which roles? A new `terminatedAt` field needs an arm permitting the right manager roles to set it (and ideally restricting who can set it via `hasOnly()` field discipline, mirroring SEC-10's notification pattern).

5. **Existing-field check (Rule 17).** Grep `terminatedAt|isActive|\bactive\b|status|terminated|deactivat` across `src/`, `functions/`, `firestore.rules`, and seed data. Does ANY soft-delete / active flag already exist? If so, quote it — do not add a duplicate.

6. **The D4 net-new link.** Quote where `ManagerDashboard` derives `newAdvisors` (the contractStartDate-this-year count from D4 / #291). A `terminatedAt` field enables the "net new = contracted-this-year MINUS terminated-this-year" refinement. Report the calc site so the lock can decide: wire the refinement in this PR, or defer to a D4 follow-up.

7. **The deferred comment.** Quote the existing code comment in `BmAtRiskPanel.jsx` (agent-iteration site) that defers the terminated filter — confirm it's still there and note the exact line.

8. **The UI insertion point.** Quote `UserManagementPanel`'s current roster rendering + any existing filter/toggle pattern (role filter, search) to mirror for a "Show terminated" toggle.

9. **Tests + conflict scan.** Any existing tests on `getTenantUsers` filtering or `EditUserDrawer` field edits? Any emulator cases for user-doc updates? Then `gh pr list --state open` — flag any open PR touching `managerService.js`, `firestore.rules`, `EditUserDrawer`, or the consumers in item 2.

---

## Phase 1 Recommendations (report, do not implement)

- **R1 — Field name (dispatcher locks).** Recommend `terminatedAt: Timestamp | null` (null/absent = active): soft-delete + records WHEN (audit) + feeds the D4 net-new refinement. Filter predicate = `terminatedAt == null`. Note the alternatives (`active: boolean`, `status` enum) and which existing patterns in the codebase argue for one.
- **R2 — Filter strategy.** Based on the item-2 map: recommend a central default in `getTenantUsers` (`{ includeTerminated: false }`) for the consumers that route through it, plus an explicit list of the independent-query consumers that each need their own `terminatedAt == null` predicate.
- **R3 — Who can set it.** Recommend `tenant_admin` + `branch_manager` via the existing `EditUserDrawer` edit path; confirm against the item-3/4 permission matrix.
- **R4 — UI.** "Show terminated" toggle on `UserManagementPanel`, default OFF; terminated rows visually distinct when shown.
- **R5 — Historical data.** Confirm terminated agents' persistency / settlement / submission docs are PRESERVED but excluded from active rosters and averages; report how persistency averaging would need to change (item 2).
- **R6 — D4 net-new refinement.** Recommend wiring it in this PR if the item-6 calc site is simple; else defer. Report.
- **R7 — PR breakdown.** Single PR if the consumer count is small (~3–5); else recommend a split (field + rule + set-path first, then the consumer filters). Decide from item 2.
- **R8 — Emulator cases.** The set rule needs cases: tenant_admin sets `terminatedAt` ALLOW; branch_manager (in scope) ALLOW; agent self-set DENY; peer/out-of-scope manager DENY.

**STOP and wait for dispatcher.**
