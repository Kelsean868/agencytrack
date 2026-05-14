# Cache UM Agent UIDs Per Session — Kickoff Brief

**Status:** Ready to dispatch to fresh CC session.
**Estimated CC effort:** 1–1.5 hours, single PR.
**Two-strike counter:** Project carry-in **0/2**. Standard 2-strike loop applies.
**Main HEAD at brief drafting:** post-4c8f0d1 (CLAUDE.md methodology banking) — CC captures actual HEAD in Phase 1.
**Source:** LOW follow-up banked in #144's FOLLOW_UPS.md (added 2026-05-14 as part of SHAKEDOWN-002B). Project mode shifted to general refinement post-#145 (pilot postponed). Now picking up Tier 1 items by leverage.

---

## Methodology requirement (read first)

This brief explicitly requires CC to surface BEFORE making any of the following decisions:

- Scope expansion beyond the file inventory listed in this brief
- New architectural patterns (different cache shape, eviction policy, persistence mechanism) not pre-decided
- Test file rewrite from scratch (vs. targeted edits that preserve existing coverage)
- Inline fix of unexpected behavior (vs. STOP + surface)
- Any "how to solve" decision not explicitly pre-decided in "Decisions locked"

"Solve rather than surface" is itself a strike condition even when the resulting fix is correct. Surface first, solve after acknowledgement. No exceptions.

---

## Context

SHAKEDOWN-002B (#144) shipped two services with the agent-UID lookup pattern for UM-scoped queries:

- `managerService.getWeeklySubmissions` — fetches agent UIDs first, then submissions filtered by `where('agentId', 'in', agentUids)`
- `managerService.getAllYTDSubmissions` — same pattern

Trade-off accepted at #144 ship: 2 Firestore reads per call instead of 1. Acceptable for pilot scale but flagged as opportunistic optimization since UMs load the Master Sheet repeatedly per session.

**This brief implements the optimization.** Cache the UM's agent UIDs once per session, reuse across subsequent calls. Reduces 2 reads → 1 read for cached UMs on repeat loads.

**Real-world benefit:**
- A UM loading Master Sheet 10 times per day saves ~9 redundant agent-list reads per session
- Tatil agents in the field will hit this code path frequently
- The optimization is bounded, safe, and architecturally clean

---

## Decisions locked (do not re-litigate; surface ANY deviation BEFORE implementing)

### Cache shape: in-memory Map keyed by `${tenantId}:${callerUid}`

- Module-scoped `Map<string, string[]>` in `managerService.js`
- Key: `${tenantId}:${callerUid}` (handles edge case of one user being UM in multiple tenants in future, though current pilot is single-tenant)
- Value: array of agent UIDs (strings)
- No metadata caching — agent UIDs only, since that's all the lookup pattern needs

### Cache lives in `managerService.js`

Single module-scoped variable. Not exported except via a `clearAgentUidCache()` setter for invalidation. No new service file, no cross-service helper module.

### TTL: none — cleared on sign-out

Per-session caching. No time-based expiry. The trade-off accepted: if an agent is reassigned to a different unit during a session, the UM's view is stale until sign-out → sign-in. Acceptable because:
- Agent reassignments are infrequent
- The trade-off was implicit when SHAKEDOWN-002B was designed (agents reassigned post-submission would appear in the new UM's view but old submissions stay attributed to original agent)
- A 5-min TTL would add complexity for minimal real benefit

### Invalidation: `clearAgentUidCache()` exported, called from `AuthContext` sign-out path

- `managerService.js` exports `clearAgentUidCache()` (named export)
- `AuthContext.jsx` imports it and calls it inside the sign-out handler
- Pattern mirrors how `setRuntimeTenantId(null)` was called pre-SEC-9b — clean, explicit, no magic

### Private helper extraction

New private function `getCallerAgentUids(tenantId, callerUid)`:
- Checks cache; returns cached value if present
- Otherwise queries `tenants/${tenantId}/users where unitId == callerUid`, filters out provisioning docs, caches the UID array, returns it
- Used by both `getWeeklySubmissions` and `getAllYTDSubmissions` (replaces the inline lookup currently in each)

### BM/TA/PA paths unchanged

Cache is UM-only. Non-UM callers never invoke `getCallerAgentUids` because their queries are unscoped (no agent-UID filter needed). Zero impact on BM/TA/PA performance.

### Test coverage required

Extend `src/services/__tests__/managerService.test.js` with new describe block:
- Cache hit: second call within session returns cached UIDs without new Firestore query
- Cache miss: first call queries Firestore and populates cache
- Cache clear: `clearAgentUidCache()` empties the cache; next call re-queries
- Per-user keying: UM_A's cache doesn't leak to UM_B
- Provisioning filter applied to cached results (consistency with current #144 behavior)

Do NOT rewrite the existing 16 tests. Add as a new describe block.

### Verification: manual smoke not strictly required

The optimization is purely internal — UM experience is identical (same data, faster on repeat loads). No user-visible behavior change. Tests + lint + build green is sufficient. Optional post-merge smoke: log in as UM, load Master Sheet, open devtools Network tab, confirm one read for users + one read for submissions on first load, then ONE read (submissions only) on subsequent loads of different weeks.

---

## Scope

Ships in this single PR:

- `src/services/managerService.js` — cache implementation + `getCallerAgentUids` helper + `clearAgentUidCache` export
- `src/context/AuthContext.jsx` — import `clearAgentUidCache`, call on sign-out
- `src/services/__tests__/managerService.test.js` — new describe block for cache coverage
- `docs/CONTEXT.md` "Recently shipped" row append
- `docs/FOLLOW_UPS.md` — mark "Cache UM agent UIDs per session" entry resolved with closing PR # placeholder

---

## File inventory

**Files expected to touch:**

| Path | Change |
|---|---|
| `src/services/managerService.js` | Add module-scoped Map, `getCallerAgentUids` helper, `clearAgentUidCache` export; refactor `getWeeklySubmissions` and `getAllYTDSubmissions` to use the helper |
| `src/context/AuthContext.jsx` | Import + call `clearAgentUidCache` in sign-out path |
| `src/services/__tests__/managerService.test.js` | New describe block — cache hit/miss/clear/per-user scenarios |
| `docs/CONTEXT.md` | Recently-shipped row append (SHA/PR# placeholders post-merge) |
| `docs/FOLLOW_UPS.md` | Mark cache follow-up resolved with placeholder |

**No other files expected.** Specifically NOT in scope:
- `firestore.rules` — no rules changes needed (UM read scope is already enforced)
- `MasterSheet.jsx`, `ManagerDashboard.jsx`, `UnitManagerProductionView.jsx` — consumers; the optimization is internal to managerService
- `agentManagementService.js` — different service, different scope
- New service or utility files

If Phase 1 surfaces a reason to modify any other file → STOP and surface.

---

## Phases

### Phase 1 — Discovery (gates Phase 2)

**Surface in chat (no committed discovery doc):**

1. Capture main HEAD SHA via `git log origin/main --oneline -1`. Confirm post-4c8f0d1 state (CLAUDE.md methodology banking is the most recent main commit).
2. Read `src/services/managerService.js` — focus on `getWeeklySubmissions` and `getAllYTDSubmissions`. Identify exact line ranges where the agent-UID lookup happens. Confirm both functions use identical lookup logic.
3. Read `src/context/AuthContext.jsx` — locate the sign-out handler. Confirm there's a clear insertion point for the cache-clear call.
4. Read `src/services/__tests__/managerService.test.js` — confirm existing 16 tests, identify the right insertion point for the new describe block.
5. Audit for OTHER consumers of agent-UID lookups in managerService or elsewhere that would benefit from the same cache. If found, STOP and surface — scope expansion.
6. Confirm no existing module-level state in managerService that would conflict with the new cache Map.

Surface in chat: where the helper goes, where the cache lives, where AuthContext calls the clear, test plan. Kyron acks before Phase 2.

**Hard stop in Phase 1:**
- If a third or fourth consumer of agent-UID lookup is found → STOP, scope expansion
- If AuthContext sign-out handler doesn't exist or is structured unexpectedly → STOP
- If managerService has existing module-level state that could conflict → STOP

### Phase 2 — Apply optimization

Per the approved Phase 1 recommendation:
- Add module-scoped Map + helper + export to `managerService.js`
- Refactor `getWeeklySubmissions` and `getAllYTDSubmissions` to use the helper
- Wire up AuthContext sign-out path
- Add tests

Single commit or split logically (CC's call).

### Phase 3 — Verification

- `npm run lint` → 0 errors
- `npm test -- --run` → all pass including new cache tests
- `npm run build` → success
- No new warnings introduced beyond the existing baseline

### Phase 4 — Docs, commit, push, PR

- Update `docs/CONTEXT.md` Recently-shipped row with placeholders
- Update `docs/FOLLOW_UPS.md` — mark cache follow-up resolved with placeholder
- Conventional commit(s)
- Push, open PR
- **PR title:** `perf(services): cache UM agent UIDs per session`
- **PR description must include:**
  - Summary referencing the #144 follow-up
  - Phase 1 findings (consumer count, lookup pattern confirmation)
  - Cache shape + invalidation strategy
  - Test coverage added
  - Verification matrix
  - Optional post-merge smoke note (devtools Network tab observation)

### Phase 5 — STOP

DO NOT MERGE. Kyron reviews + optional manual smoke.

---

## Hard stops

- `npm run lint` fails → fix, don't commit broken state
- Existing tests start failing → STOP and surface (regression)
- `npm run build` fails → STOP and surface
- Phase 1 finds the fix requires changes beyond the file inventory → STOP and surface scope expansion
- Phase 1 finds more agent-UID lookup consumers needing the same treatment → STOP, evaluate whether to expand scope
- Phase 1 finds existing module-level state in managerService that could conflict with the cache → STOP
- AuthContext sign-out handler structure differs unexpectedly → STOP
- ANY decision not pre-listed in "Decisions locked" — STOP and surface BEFORE acting
- First unexpected behavior of any kind — standard 2-strike loop applies, lean toward surfacing early

---

## NOT in scope

- Caching for non-UM scopes (BM/TA/PA already efficient — unscoped queries)
- TTL or LRU eviction logic
- Cross-tab sync (BroadcastChannel, etc.)
- Persistence to sessionStorage or IndexedDB
- New service files or helper modules
- Modifications to functions outside `getWeeklySubmissions` and `getAllYTDSubmissions`
- Changes to consumer components (MasterSheet, ManagerDashboard, UnitManagerProductionView)
- Caching of submissions or persistency data
- Refactor of SHAKEDOWN-002B logic beyond the cache extraction
- Changes to Firestore rules

---

## Verification matrix (CC must include in PR description)

| Item | Command | Expected |
|---|---|---|
| Lint clean | `npm run lint` | 0 errors |
| Tests pass | `npm test -- --run` | 100% pass including new cache tests |
| Build succeeds | `npm run build` | success, no new warnings |
| Cache implementation documented | PR description | Cache shape + key + invalidation explained |
| Phase 1 audit documented | PR description | Consumer enumeration result (expected: 2 functions, both in managerService) |
| Test coverage documented | PR description | Cache hit/miss/clear/per-user scenarios listed |
| CONTEXT.md updated | `git diff docs/CONTEXT.md` | Recently-shipped row added, oldest removed |
| FOLLOW_UPS.md updated | `git diff docs/FOLLOW_UPS.md` | "Cache UM agent UIDs per session" marked resolved with placeholder |
| Optional post-merge smoke | Note in PR description | Kyron may verify via devtools Network tab — first Master Sheet load shows 2 reads (users + submissions); subsequent loads of different weeks show 1 read (submissions only) |

---

## CC kickoff prompt (one-liner)

> Execute the UM agent UID caching optimization per the brief in `docs/briefs/perf-cache-um-agent-uids-kickoff.md`. Project strike count 0/2. Standard 2-strike loop. **Read the methodology requirement at the top first — surface BEFORE making ANY architectural decision not pre-listed in "Decisions locked"; this is itself a strike condition.** Begin Phase 1 (discovery). Surface findings + cache shape confirmation + test plan in chat before any code changes. Do NOT merge — open PR with verification matrix, stop.
