# Kickoff Brief — tenantId-in-deps lint sweep (SEC-9b residual)

**Type:** Code fix + FU banking-as-RESOLVED docs PR (S size)
**Shape:** HIGH#6 / PR #160 closure pattern
**Strike count opens at:** 0/2
**Smoke:** Waived (internal refactor — dep-array additions for session-stable values; no user-visible behavior change)

---

## Audit findings (from tenantId-in-deps audit, 2026-05-16)

CC's audit confirmed 14 lint warnings (matching PR #164's 16→14 baseline). Composition slightly different than originating verbal bank: **13 are tenantId-in-deps; 1 is an unrelated stale eslint-disable** in `scripts/verification/shakedown/run-all.mjs:459`.

All 13 tenantId warnings are SEC-9b residual — PR #139 retired the global `tenantId` holder in `firebase.js`, every caller now reads from auth context, but the exhaustive-deps warnings weren't swept at migration time. PR #164 closed 3 (unrelated react-hooks shapes); these 13 remain.

All 13 land on fix shape 1 (mechanical add to deps array). Per audit Section 3:
- `tenantId` is session-stable (set once in `AuthContext.jsx:50-67`, doesn't change for the lifetime of a session)
- The other deps already in each array co-vary with `tenantId` on login/logout — so practical re-run set is unchanged
- Two hooks (#4 and #7) with `[]` empty deps get a small correctness upgrade — they currently fire once on mount and silently fail if `tenantId` is null; after fix they re-fire when `tenantId` resolves
- No `useMemo`/`useCallback` wrapping needed

## Decisions locked

1. **Bundle stale eslint-disable cleanup** — warning #14 (`run-all.mjs:459` unused `no-process-exit` disable) bundled in same PR as a separate commit. Post-PR lint at 0 problems
2. **Preserve `user` vs `user?.uid` convention** — WizardForm:184/206 currently uses `[user]` and `[weekStarting, user]`. Add tenantId only; minimal-diff. Out-of-scope refactor stays out
3. **No brief-level branching for KioskShell prop-source** — 12/13 read from `useAuth()`, 1/13 (KioskShell) receives as prop. Fix shape identical; single sweep handles both
4. **Lint rule stays at warning level** — do NOT promote `react-hooks/exhaustive-deps` to error. Separate codebase-policy decision
5. **FU Resolved entry includes compressed per-hook table** — file/line/proposed-deps columns only. Grep-able audit trail

## Phase 0 — Gate

1. Confirm on `main`, working tree clean. `git fetch origin && git pull origin main`.
2. Create fresh branch off freshly-fetched main: `chore/close-fu-tenantid-deps-sweep`
3. Confirm CLAUDE.md Phase 0 gate checks pass (no uncommitted work, no stale worktree).

## Phase 1 — Lint baseline snapshot

1. Run `npm run lint` and capture full output.
2. Confirm exactly 14 problems (0 errors, 14 warnings) — matching audit baseline.
3. Confirm composition: 13 react-hooks/exhaustive-deps warnings (tenantId pattern) + 1 stale eslint-disable in `run-all.mjs:459`.
4. Verify each of the 13 warnings matches the file:line entries in the Phase 2 table.

**Hard stops (Rule 12 canonical):**
- If lint count has shifted (≠ 14): **STOP and wait for dispatcher**
- If composition has shifted (different rules, new files, any enumeration mismatch): **STOP and wait for dispatcher**
- If any of the 13 hooks has been refactored since audit: **STOP and wait for dispatcher**

## Phase 2 — Apply edits (two commits in one PR)

### Commit 1 — 13 tenantId-in-deps fixes

Apply per the locked table. Each is a single-line dep-array edit; preserve all other code.

| # | File:line | Current deps | Proposed deps |
|---|---|---|---|
| 1 | `src/components/agent/PersistencyTab.jsx:60` | `[user?.uid]` | `[user?.uid, tenantId]` |
| 2 | `src/components/daily/DailyEntryModal.jsx:77` | `[user?.uid, today]` | `[user?.uid, today, tenantId]` |
| 3 | `src/components/dashboard/AgentDashboard.jsx:251` | `[user?.uid, today, showDailyCTA]` | `[user?.uid, today, showDailyCTA, tenantId]` |
| 4 | `src/components/dashboard/ManagerDashboard.jsx:83` | `[]` | `[tenantId]` |
| 5 | `src/components/kiosk/KioskShell.jsx:59` | `[]` | `[tenantId]` |
| 6 | `src/components/manager/AgentOfMonthTab.jsx:66` | `[branchId, monthKey]` | `[branchId, monthKey, tenantId]` |
| 7 | `src/components/manager/GoalsPanel.jsx:730` | `[]` | `[tenantId]` |
| 8 | `src/components/manager/MasterSheet.jsx:99` | `[selectedWeek]` | `[selectedWeek, tenantId]` |
| 9 | `src/components/manager/PersistencyTab.jsx:103` | `[scopeType, scopeId]` | `[scopeType, scopeId, tenantId]` |
| 10 | `src/components/manager/PersistencyTab.jsx:128` | `[monthKey, scopeId, scopeType]` | `[monthKey, scopeId, scopeType, tenantId]` |
| 11 | `src/components/manager/UserManagementPanel.jsx:375` | `[showInactive]` | `[showInactive, tenantId]` |
| 12 | `src/components/wizard/WizardForm.jsx:184` | `[user]` | `[user, tenantId]` |
| 13 | `src/components/wizard/WizardForm.jsx:206` | `[weekStarting, user]` | `[weekStarting, user, tenantId]` |

**Note:** KioskShell (#5) sources `tenantId` from props, not `useAuth` context. Fix shape identical. `branchId` is also a prop but NOT used inside `fetchData` (only in `sharedProps` for child rendering) — do NOT add to deps.

Commit message: `chore(lint): close 13 tenantId-in-deps exhaustive-deps warnings (SEC-9b residual)`

### Commit 2 — Stale eslint-disable removal

Remove the unused eslint-disable at `scripts/verification/shakedown/run-all.mjs:459`. The disable suppresses `no-process-exit` but no `process.exit` violation exists at that location (ESLint reports it as unused).

Commit message: `chore(lint): remove stale no-process-exit eslint-disable in shakedown run-all`

## Phase 3 — Verification

1. `npm run lint` — must exit 0 with **0 problems** (down from 14).
2. `npm test` — must exit 0 with identical test count before/after (no test added, no test removed).
3. `npm run build` — must exit 0, clean build.
4. Compare `npm test` output line-counts before/after — should be identical.
5. Confirm `git status` shows only:
   - 11 source files modified (PersistencyTab.jsx counts once for 2 hooks; WizardForm.jsx counts once for 2 hooks)
   - `scripts/verification/shakedown/run-all.mjs` modified
   - `docs/FOLLOW_UPS.md` modified
   - `docs/CONTEXT.md` modified

**Hard stops (Rule 12 canonical):**
- If `npm run lint` exits with any remaining warning: **STOP and wait for dispatcher**
- If any test regresses or test count changes: **STOP and wait for dispatcher**
- If `npm run build` fails: **STOP and wait for dispatcher**
- If any of the 13 hooks turns out to require more than a mechanical dep addition (e.g., parent value requires `useMemo` wrapping): **STOP and wait for dispatcher**

## Phase 4 — Docs (FU bank-as-RESOLVED + CONTEXT.md)

### FOLLOW_UPS.md — append new Resolved entry

Append at the end of the Resolved section. Use this template:

```
### SEC-9b residual: tenantId-in-deps exhaustive-deps warnings (RESOLVED 2026-05-16)

**Banked + resolved in same PR.** The tenantId-in-deps pattern was a known residual of SEC-9b (PR #139) — 16 react-hooks warnings remained at SEC-9b merge; PR #164 closed 3 (unrelated react-hooks shapes); the pattern was verbally surfaced during PR #164 closure but never formalized as a FOLLOW_UPS row. This PR formalizes the banking and closes it via mechanical dep additions across 11 files / 13 hooks.

**Audit trail:** PR #139 (SEC-9b migration) → PR #164 (3 react-hooks closures, 16→14 baseline) → PR #XXX (this PR — 13 tenantId-in-deps fixes + 1 unrelated stale eslint-disable cleanup).

**Per-hook fix table:**

| # | File:line | Proposed deps |
|---|---|---|
| 1 | `agent/PersistencyTab.jsx:60` | `[user?.uid, tenantId]` |
| 2 | `daily/DailyEntryModal.jsx:77` | `[user?.uid, today, tenantId]` |
| 3 | `dashboard/AgentDashboard.jsx:251` | `[user?.uid, today, showDailyCTA, tenantId]` |
| 4 | `dashboard/ManagerDashboard.jsx:83` | `[tenantId]` |
| 5 | `kiosk/KioskShell.jsx:59` | `[tenantId]` |
| 6 | `manager/AgentOfMonthTab.jsx:66` | `[branchId, monthKey, tenantId]` |
| 7 | `manager/GoalsPanel.jsx:730` | `[tenantId]` |
| 8 | `manager/MasterSheet.jsx:99` | `[selectedWeek, tenantId]` |
| 9 | `manager/PersistencyTab.jsx:103` | `[scopeType, scopeId, tenantId]` |
| 10 | `manager/PersistencyTab.jsx:128` | `[monthKey, scopeId, scopeType, tenantId]` |
| 11 | `manager/UserManagementPanel.jsx:375` | `[showInactive, tenantId]` |
| 12 | `wizard/WizardForm.jsx:184` | `[user, tenantId]` |
| 13 | `wizard/WizardForm.jsx:206` | `[weekStarting, user, tenantId]` |

Post-PR lint baseline: 0 warnings (down from 14; +1 stale eslint-disable in `run-all.mjs:459` also removed in same PR).
```

### CONTEXT.md — Recently shipped placeholder

Add a placeholder row for this PR at the top of the Recently shipped table. After this PR merges, the table will be: `#XXX (this PR) / #170 / #168 / #166 / #164` — `#162` drops to maintain the 5-row contract.

## Phase 5 — Commit, push, PR

1. Stage commits per Phase 2 (two commits as specified above).
2. Stage docs: `git add docs/FOLLOW_UPS.md docs/CONTEXT.md`
3. `git commit -m "docs: bank-and-resolve SEC-9b tenantId-in-deps FU; add CONTEXT.md row"`
4. `git push -u origin chore/close-fu-tenantid-deps-sweep`
5. Open PR with body containing:
   - Reference to tenantId-in-deps audit (2026-05-16)
   - Summary: 13 tenantId-in-deps fixes (SEC-9b residual) + 1 unrelated stale eslint-disable cleanup
   - Post-PR lint baseline: 0 warnings
   - FU banking-and-resolution in same PR (with closure note pointing to the audit trail)
   - **Smoke waiver justification:** "Internal refactor — dep-array additions for session-stable values. No user-visible behavior change. The new deps (`tenantId` from `useAuth` or prop) co-vary with deps already present in each array, so practical hook re-run frequency is unchanged. Deterministic verification substitute: `npm run lint` exit 0 + `npm test` exit 0 prove the change. Lint is the actual thing we're fixing; tests cover hook callback behavior under simulated state changes. Mirrors the 'Static CSS verification' precedent banked in PR #155/#156."
6. Stop after PR is open. Wait for Kelsean to merge.

---

## Acceptance criteria

- All 13 tenantId-in-deps warnings resolved via mechanical deps additions per locked table
- 1 stale eslint-disable in `run-all.mjs:459` removed (separate commit)
- Post-PR `npm run lint` exits at 0 problems
- `npm test` passes; test count unchanged before/after
- `npm run build` passes
- FOLLOW_UPS.md Resolved entry added per Phase 4 template, with compressed per-hook table
- CONTEXT.md Recently shipped placeholder row added; `#162` drops to maintain 5-row contract
- Smoke waiver justified inline in PR body with the explicit reasoning

## Out of scope

- Refactoring WizardForm:184/206 from `[user]` to `[user?.uid]` (per Q2 decision)
- Promoting `react-hooks/exhaustive-deps` rule from warning to error (per Q4 decision)
- Any tenantId derivation refactor (everything stays sourced from `useAuth` or prop)
- Any KioskShell prop-to-context migration (out of scope; fix-shape parity preserves current source pattern)
- Any non-tenantId lint warnings that may surface after this sweep (none expected at audit time)

## Standing rule reminders

- Single-branch PR rule applies (fresh branch off freshly-fetched main, never reuse)
- Phase 0 gate fires as usual
- Smoke waiver allowed for internal refactors with no user-visible behavior change; justification required inline
- Post-merge sequence (Rule 4) runs automatically after Kelsean merges
- All hard stops use canonical Rule 12 phrasing ("STOP and wait for dispatcher")
