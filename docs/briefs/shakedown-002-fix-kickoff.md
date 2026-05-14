# SHAKEDOWN-002 — Unit Manager Cross-Unit Visibility Fix — Kickoff Brief

**Status:** Ready to dispatch to fresh CC session.
**Estimated CC effort:** 1.5–2.5 hours, single PR.
**Two-strike counter:** Project carry-in **0/2**. Standard 2-strike loop applies.
**Main HEAD at brief drafting:** post-#141 squash SHA (CC captures in Phase 1).
**Source:** SHAKEDOWN-002 entry in `docs/FOLLOW_UPS.md` HIGH section. Pilot blocker — surfaced by 2026-05-13 shakedown run. Documented in `docs/shakedown-findings-2026-05-13.md`.

---

## Methodology requirement (read first)

This brief explicitly requires CC to surface BEFORE making any of the following decisions:

- Scope expansion beyond the file inventory listed in this brief
- New architectural pattern (cache, helper, state mechanism) not pre-decided
- Test file rewrite from scratch (vs. targeted edits)
- Inline fix of unexpected behavior (vs. surfacing it)
- Any decision about HOW to solve that isn't explicitly pre-decided in "Decisions locked"

Session pattern context: 5 unilateral methodology decisions across recent arcs. Going forward, "solve rather than surface" is itself a strike candidate even when the resulting fix is correct. **Surface first, solve after acknowledgement.** No exceptions.

---

## Context

The 2026-05-13 shakedown found that Unit Manager UM_001 logging in sees agents from BOTH unit_001 AND unit_002 in:
- The Team tab on ManagerDashboard
- The Master Sheet (23-column grid)

Expected: UM should only see agents whose `unitId` matches the UM's own UID (the canonical unit-ownership relationship — agent.unitId === unitManagerUid).

**Real-world impact:**
- Cross-unit data leak in production. UM_A can see UM_B's agent productivity, submissions, settlements, persistency.
- Permission boundary violation — managerial peers should not see each other's team performance.
- Pilot blocker for any tenant with multiple units. Tatil has multiple.
- Once Tatil's full roster is onboarded, this leak amplifies (more units, more leaked data).

**Suspected root cause** (Phase 1 confirms or refutes):
The `managerService.getTenantUsers(tenantId)` query (recently migrated in SEC-9b) likely returns all branch users without enforcing a `unitId` filter when the caller is a UM. The same query is used by both ManagerDashboard's Team tab and MasterSheet — explaining why both surfaces leak.

Could also be:
- Rules-level: Firestore rules allow UM to read all branch users (no unit-scoping at rules layer)
- Client-side filter missing: query returns all, but a client filter should narrow by unit (and that filter is missing or broken)
- Mixed: rules allow broad read, client filter is the intended scoping mechanism but isn't applied

Phase 1 discovery determines which.

---

## Decisions locked (do not re-litigate; surface ANY deviation BEFORE implementing)

### Fix approach: Phase 1 determines exact change

The exact fix shape is not pre-decided — Phase 1 must trace the current query flow, identify exactly where the scoping should happen, and surface the recommendation. Kyron acks before Phase 2.

Expected fix shapes (CC surfaces which applies):
- **Shape A — Client-side query filter:** Add `.where('unitId', '==', callerUid)` (or equivalent) to `managerService.getTenantUsers` when caller's role is `unit_manager`. Defense in depth: rules also enforce.
- **Shape B — Rules-only enforcement:** Update Firestore rules to deny UM reads of users outside their unit. Client query stays broad; rules narrow it server-side.
- **Shape C — Combined (defense in depth):** Both — rules enforce, client filter narrows query (preferred Firebase pattern for performance + security).

Strongly recommended outcome: Shape C. Rules-only (Shape B) is correct security but bad performance (client gets denied for many docs, wasted bandwidth). Client-only (Shape A) is correct performance but bad security (depends on UI to enforce permissions). Combined is canonical.

### Role distinction must be preserved

- **Agent:** sees only own data (unchanged)
- **Unit Manager:** sees only own unit's agents (this fix)
- **Branch Manager:** sees all branch agents across all units (unchanged — BM scope is branch-wide)
- **Tenant Admin:** sees all tenant users (unchanged)
- **Platform Admin:** cross-tenant (unchanged)

The fix must distinguish caller's role and apply unit-scoping ONLY to `unit_manager` callers. BM/TA/PA continue to see broader scopes.

### Test coverage required

- **Vitest unit test** for the scoping logic in `managerService.js` — mock different caller roles and assert correct filter is applied.
- **Optionally** (CC's call after Phase 1): Firestore rules emulator test using `@firebase/rules-unit-testing` (already installed). Java JDK 21 is available per project memory.

### Verification: manual smoke required post-merge

After merge, Kyron signs in as a UM (from the existing test users or a fresh one), confirms Team tab + Master Sheet show only that UM's unit. Then signs in as a BM, confirms full branch visibility preserved.

### No re-run of full shakedown in this PR

Same as SHAKEDOWN-001 — the shakedown re-run is a separate workflow after BOTH 001 + 002 land.

---

## Scope

Ships in this single PR:

- `src/services/managerService.js` — scoping fix per Phase 1 findings
- `firestore.rules` — only if Phase 1 surfaces rules-level changes (Shape B or C)
- `src/services/__tests__/managerService.test.js` — new file with scoping coverage
- `docs/CONTEXT.md` "Recently shipped" row append
- `docs/FOLLOW_UPS.md` — SHAKEDOWN-002 entry marked resolved with closing PR # placeholder

---

## File inventory

**Files expected to touch:**

| Path | Change |
|---|---|
| `src/services/managerService.js` | Add role-aware unit scoping to `getTenantUsers` |
| `src/services/__tests__/managerService.test.js` | New file — scoping coverage (mock different caller roles) |
| `firestore.rules` | Only if Shape B or C — add unit scoping to user list rules |
| `docs/CONTEXT.md` | Recently-shipped row append (SHA/PR# placeholders post-merge) |
| `docs/FOLLOW_UPS.md` | SHAKEDOWN-002 entry resolved with placeholder |

**No other files expected.** Specifically NOT in scope:
- `MasterSheet.jsx` — the consumer; if Phase 1 surfaces it needs changes, STOP and surface
- `ManagerDashboard.jsx` — same
- `AuthContext.jsx` — recently modified in #141, leave it alone
- `App.jsx` — same

If Phase 1 finds the fix requires modifying any other file → STOP and surface scope expansion.

---

## Phases

### Phase 1 — Discovery (gates Phase 2)

**Surface in chat (no committed discovery doc):**

1. Capture main HEAD SHA via `git log origin/main --oneline -1`. Confirm post-#141 state.
2. Read `src/services/managerService.js` — focus on `getTenantUsers`. What query does it construct? Are there any role-based branches today?
3. Read `firestore.rules` — focus on the `users/{userId}` collection rules. What scoping exists today for list queries by role?
4. Read `MasterSheet.jsx` and `ManagerDashboard.jsx` (Team tab area) — confirm both consume `getTenantUsers` and don't have their own broader queries that need fixing.
5. Read the shakedown finding entry in `docs/shakedown-findings-2026-05-13.md` SHAKEDOWN-002 section — verify which screenshots/log entries documented the leak (helpful for future audit trail).
6. Read existing test patterns in `src/services/__tests__/` for the mock structure to follow.
7. Identify which fix shape (A/B/C) applies and surface the specific change recommendation.

Surface: which fix shape, exact code change for managerService.js, exact rules change (if any), test plan. Kyron acks before Phase 2.

**Hard stop in Phase 1:**
- If MasterSheet.jsx or ManagerDashboard.jsx has its OWN query (not via managerService) → STOP, scope is bigger than this brief
- If the fix requires changes beyond the file inventory → STOP and surface

### Phase 2 — Apply fix

Per the approved Phase 1 recommendation. Single commit or split logically (service + rules + tests).

### Phase 3 — Verification

- `npm run lint` → 0 errors
- `npm test -- --run` → all pass including new managerService tests
- `npm run build` → success
- If rules changed: emulator test via existing rules-unit-testing infrastructure OR document why emulator test is not feasible

### Phase 4 — Docs, commit, push, PR

- Update `docs/CONTEXT.md` Recently-shipped row with placeholders
- Update `docs/FOLLOW_UPS.md` — SHAKEDOWN-002 marked resolved with placeholder
- Conventional commit(s)
- Push, open PR
- **PR title:** `fix(services): enforce UM unit scoping on user list (SHAKEDOWN-002)`
- **PR description must include:**
  - Summary referencing the shakedown finding
  - Phase 1 root cause identified
  - Fix shape applied (A/B/C)
  - Role distinction preserved (Agent / UM / BM / TA / PA scopes)
  - Test coverage added
  - Verification matrix
  - Note: post-merge manual smoke (sign in as UM, confirm scope; sign in as BM, confirm BM scope preserved)

### Phase 5 — STOP

DO NOT MERGE. Kyron reviews + performs manual smoke.

---

## Hard stops

- `npm run lint` fails → fix, don't commit broken state
- Existing tests start failing → STOP and surface (regression)
- `npm run build` fails → STOP and surface
- Phase 1 finds the fix requires changes beyond the file inventory → STOP and surface scope expansion (no implicit expansion this time — see methodology requirement)
- Phase 1 finds existing tests for managerService that need updating (none expected — was migrated in SEC-9b without dedicated tests) → STOP and surface
- Phase 1 finds the fix would change BM visibility (overreach) → STOP and reconsider
- More than 1 hour spent in Phase 1 without converging on root cause → STOP and surface
- ANY decision not pre-listed in "Decisions locked" — STOP and surface BEFORE acting
- First unexpected behavior of any kind — standard 2-strike loop applies, lean toward surfacing early

---

## NOT in scope

- SHAKEDOWN-001 (already fixed in #141)
- Other shakedown findings (a11y violations, harness-only failures) — bank as polish/post-pilot
- Refactor of managerService beyond the scoping fix
- Changes to `MasterSheet.jsx` or `ManagerDashboard.jsx` — STOP and surface if Phase 1 points there
- Changes to BM, TA, or PA scoping (BM sees all branch agents, that's correct)
- Adding tests for other migrated services (banked as opportunistic in #138's follow-up)
- Re-running the full shakedown — separate workflow after both 001 + 002 land
- Changes to PR-4b or SEC-9b atomicity patterns

---

## Verification matrix (CC must include in PR description)

| Item | Command | Expected |
|---|---|---|
| Lint clean | `npm run lint` | 0 errors |
| Tests pass | `npm test -- --run` | 100% pass including new managerService tests |
| Build succeeds | `npm run build` | success, no warnings |
| Fix shape documented | PR description | A/B/C identified with rationale |
| Phase 1 trace documented | PR description | Root cause line-numbered to managerService.js (and rules if applicable) |
| Role distinction preserved | PR description | Agent/UM/BM/TA/PA scopes explicitly documented |
| CONTEXT.md updated | `git diff docs/CONTEXT.md` | Recently-shipped row added, oldest removed |
| FOLLOW_UPS.md updated | `git diff docs/FOLLOW_UPS.md` | SHAKEDOWN-002 marked resolved with placeholder |
| Post-merge UM smoke | Note in PR description | Kyron signs in as UM, confirms only own unit's agents visible in Team tab + Master Sheet |
| Post-merge BM smoke | Note in PR description | Kyron signs in as BM, confirms full branch visibility preserved (regression check) |

---

## CC kickoff prompt (one-liner)

> Execute the SHAKEDOWN-002 fix per the brief in `docs/briefs/shakedown-002-fix-kickoff.md`. Project strike count 0/2. Standard 2-strike loop. **Read the methodology requirement at the top first — surface BEFORE making ANY architectural decision not pre-listed in "Decisions locked"; this is itself a strike condition.** Begin Phase 1 (discovery). Surface root cause + fix shape (A/B/C) + test plan in chat before any code changes. Do NOT merge — open PR with verification matrix, stop.
