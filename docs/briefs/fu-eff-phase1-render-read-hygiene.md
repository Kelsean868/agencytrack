# FU EFF-Phase1 — Render/read hygiene bundle (6 frontend-only fixes)

> RUN ON: Opus (/model opus). Six independent frontend-only fixes from the
> 2026-07-05 efficiency audit's Phase 1. AUTO-MERGE AUTHORIZED (frontend-only)
> with the auto-revert safety net in Phase 6. One PR, EFF-001 as its own FIRST
> commit so it is independently revertable.

## Scope — exactly these six, nothing else
All are S-effort, frontend-only (src/ only), mutually independent, and touch
different files. Do NOT pull in any functions/ finding, EFF-002 code-splitting,
or any M-effort read-amplification/virtualization finding — those are separate
briefs.

## Rule 17 gate — verify each anchor before editing
The line numbers below are from the audit; grep/confirm each against current
main before editing (files may have shifted since 2026-07-05). If any anchor no
longer matches the described code, note it and locate the real site; do not edit
blind.

## Fix 1 — EFF-001: Memoize AuthContext value (ISOLATE AS FIRST COMMIT)
- File: src/context/AuthContext.jsx (~:152 the inline `value` object; provided ~:155).
- Change: wrap `value` in `useMemo(() => ({ user, userProfile, role, tenantId,
  branchId, loading, isAuthenticated: !!user, refreshProfile }), [user,
  userProfile, role, tenantId, branchId, loading])`. Wrap `refreshProfile` (and
  any other function currently rebuilt each render and included in the value) in
  `useCallback` with its correct deps.
- CORRECTNESS TRAP (critical): if refreshProfile or any value-function is left
  unstable, the useMemo deps churn and the memo is a no-op; if stabilized with a
  STALE closure over user/profile state, you introduce a silent auth bug
  (logout/refresh using old state). Ensure useCallback deps are correct so the
  function is stable BUT never stale. This is why EFF-001 is the isolated commit.
- Do NOT split AuthContext into two contexts (the audit's "finer control"
  option) — that is out of scope; the useMemo+useCallback move only.
- COMMIT THIS ALONE FIRST: "perf: memoize AuthContext value + stabilize
  refreshProfile (EFF-001)". The remaining five fixes go in subsequent commits.

## Fix 2 — EFF-011: Dynamic-import the PDF engine
- File: src/services/exportService.js (~:2 static `import { pdf } from
  '@react-pdf/renderer'`); also AgentReportDocument.jsx.
- Change: remove the static import; inside the export function use
  `const { pdf } = await import('@react-pdf/renderer')`. Dynamic-import
  AgentReportDocument at the call site too. The download handler is already
  async — no UX change beyond a one-time chunk fetch on first export.
- Verify: report export still produces a correct PDF (this is the one fix whose
  smoke must actually exercise a download, not just a render).

## Fix 3 — EFF-005: Batch persistency map with `in`
- File: src/services/persistencyService.js (~:176-189, the
  `Promise.all(agents.map(one getDocs per agent))` N+1).
- Change: mirror settlementService.getSettlementsForUnit (settlementService.js
  ~:21-40) EXACTLY — chunk agentIds into ≤30, issue
  `where('agentId','in', batch)` + `where('year','==', year)`, flatten results.
  Preserve the exact same return shape the callers expect.

## Fix 4 — EFF-007: Batch roster goals with `documentId() in`
- File: src/hooks/useTeamRoster.js (~:84, `Promise.all(agentIds.map(id =>
  getGoals(...)))`); getGoals is a single-doc get (goalsService.js ~:11).
- Change: batch via `where(documentId(),'in', batch)` in ≤30 chunks (goals doc
  IDs are deterministic per agent). Preserve the return shape / per-agent
  mapping the hook builds today.

## Fix 5 — EFF-009: Stabilize inline `new Date()` props
- Files: src/components/dashboard/ManagerDashboard.jsx (~:469),
  src/components/dashboard/AgentDashboard.jsx (~:693), plus the memo-input sites
  AgentDashboard.jsx (~:308) and src/hooks/useBranchOverview.js (~:171) passing
  `new Date()` into buildActivityEvents/buildManagerActivityEvents.
- Change: `const now = useMemo(() => new Date(), [])` and pass the stable ref;
  where only the calendar date matters, pass a day-stable `YYYY-MM-DD` string
  (getTodayTT() or equivalent) instead of a Date. Verify no logic depended on
  the Date being re-created each render (it shouldn't, but confirm).

## Fix 6 — EFF-018: Memoize CashFlowChart dataset
- File: src/components/goals/CommissionPlayground/components/CashFlowChart.jsx
  (~:50, `buildStackedData(...)` in render body).
- Change: `const data = useMemo(() => buildStackedData(...), [<the actual
  inputs>])`. Confirm the dep array captures every input buildStackedData reads.

## Phase 3 — Verify (all frontend; correctness-focused, not render-count)
The audit could not measure render deltas (no profiler) — so smoke CORRECTNESS,
not counts:
1. lint clean; full vitest suite green (env-unset parity); build clean AND check
   the new build chunk report — EFF-011 should visibly remove @react-pdf from
   the entry chunk (note the before/after entry gzip size in the PR).
2. Smoke against preview as owning subject:
   - Auth still works end-to-end: login, profile loads, role-gated UI correct,
     LOGOUT fully clears session, refreshProfile still updates profile. (Guards
     EFF-001's stale-closure trap.)
   - Both dashboards render correctly (agent + manager), no blank panels.
   - Report export produces a valid PDF (EFF-011).
   - Persistency map + team roster still show correct per-agent data (EFF-005/007
     — value-level assertion, not just non-empty).
   - CommissionPlayground CashFlowChart still renders correctly (EFF-018).
   - Both themes; 0 console errors.

## Phase 4 — Docs
Mark EFF-001/005/007/009/011/018 addressed in
docs/audits/webapp-ux/agencytrack-efficiency-audit-2026-07-05.md. Update
CONTEXT.md + FOLLOW_UPS.md (size-capped).

## Phase 5 — Commit / push / PR
- Single branch: perf/eff-phase1-render-read-hygiene. git fetch origin first.
- EFF-001 is the FIRST commit alone; the other five follow (grouped sensibly).
- Push, open PR. Poll CodeRabbit + Gemini, disposition all comments in a table.
  Bot nitpicks that expand scope or cascade into test-helper rewrites are
  OUT-OF-SCOPE → bank, don't implement.

## Phase 6 — AUTO-MERGE + AUTO-REVERT (frontend-only authorization)
This bundle is frontend-only, so it is auto-merge authorized:
1. Before merge: re-poll both bots FRESH on the exact HEAD SHA, disposition
   anything new, confirm CI green on that SHA, confirm the diff is still
   frontend-only (if any edit somehow touched rules/functions, STOP — do not
   merge, hold for human).
2. Squash-merge.
3. Post-merge: sync main, capture squash SHA, fill #TBD placeholders in
   CONTEXT.md/FOLLOW_UPS.md, push, Rule 15 verify.
4. Run the Phase-3 production smoke as owning subject against production.
5. AUTO-REVERT: if the production smoke FAILS, immediately `git revert` the
   squash SHA, push to main, confirm the revert deployed clean, and report
   "AUTO-REVERTED — <reason>". Because EFF-001 is the isolated first commit, if
   the failure is auth-specific, prefer reverting ONLY the EFF-001 commit's
   change (if cleanly separable post-squash) and flag it; otherwise revert the
   whole squash and flag which fix is suspected. Do NOT retry the merge
   autonomously.
6. Then run the /post-merge sequence (docs fill + Rule 21 bot backstop).

## Scope guard
Exactly the six named fixes. No functions/ changes, no code-splitting, no
context-splitting, no virtualization. Strike count 0/2.
