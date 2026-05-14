# SHAKEDOWN-002B — Master Sheet Submissions Scoping + Aria-Label — Kickoff Brief

**Status:** Ready to dispatch to fresh CC session.
**Estimated CC effort:** 1.5–2.5 hours, single PR.
**Two-strike counter:** Project carry-in **0/2**. Standard 2-strike loop applies.
**Main HEAD at brief drafting:** post-#143 squash SHA (CC captures in Phase 1).
**Source:** 2026-05-14 shakedown re-run findings — T2B.03 + Bug 005 in `docs/shakedown-findings-2026-05-14.md`. T2B.03 is the continuation of SHAKEDOWN-002 — #142 fixed two data paths but missed the third.

---

## Methodology requirement (read first)

This brief explicitly requires CC to surface BEFORE making any of the following decisions:

- Scope expansion beyond the file inventory listed in this brief
- New architectural pattern (cache, helper, state mechanism) not pre-decided
- Test file rewrite from scratch (vs. targeted edits)
- Inline fix of unexpected behavior (vs. surfacing it)
- Any decision about HOW to solve that isn't explicitly pre-decided in "Decisions locked"

Session context: methodology requirement was added to the #142 brief and was followed cleanly. Continue that discipline. **Surface first, solve after acknowledgement.** No exceptions.

**Phase 1 audit lesson from #142:** that fix scoped `getTenantUsers` and `getAllUsers` (the two user-list paths) but missed `getWeeklySubmissions` (the submissions-by-agent path) — which the Master Sheet uses to render row data. Phase 1 of THIS brief must enumerate ALL data paths the Master Sheet and other manager surfaces consume, not just the one called out in the bug report.

---

## Context

The 2026-05-14 shakedown re-run confirmed SHAKEDOWN-001 (PR #141) and SHAKEDOWN-002 (PR #142) fixes for the **Team tab**. But T2B.03 (Master Sheet) still failed: UM_001 still sees submission rows from UM_002's agents (005, 006, 007).

**Root cause:** The Master Sheet has two data paths:
- `managerService.getTenantUsers(tenantId)` — name map (FIXED in #142)
- `managerService.getWeeklySubmissions(tenantId, weekStart)` — actual row data (UNSCOPED)

`getWeeklySubmissions` was not in #142's Phase 1 audit scope because the SHAKEDOWN-002 bug report mentioned "user list scoping" and Phase 1 audited user-list queries only. The submissions-by-agent path is a separate query shape that leaks the same cross-unit data.

**Bug 005 (combined into this PR):** Master Sheet week picker `<select>` element has no `aria-label`. CRITICAL a11y violation per the shakedown's axe-core sweep. XS fix.

**Real-world impact:**
- Cross-unit data leak in Master Sheet — same security boundary issue SHAKEDOWN-002 was supposed to close
- Master Sheet is one of the most-used manager surfaces; unfixed means UMs see each other's agents' submission details
- Pilot blocker, same urgency as #142

---

## Decisions locked (do not re-litigate; surface ANY deviation BEFORE implementing)

### Fix shape: same Shape C pattern as #142

- Client-side: `getWeeklySubmissions` self-detects caller role via `auth.currentUser.getIdTokenResult()` and applies `where('unitId', '==', callerUid)` for `unit_manager` callers
- Rules-side: `firestore.rules` enforces UM cannot list submissions outside own unit (defense in depth)
- No signature change — callers unaffected
- Internal auth detection (consistent with #142's pattern in `managerService.js` and `agentManagementService.js`)

### Role scopes preserved (identical to #142)

- **Agent:** never calls `getWeeklySubmissions` directly; sees only own submissions via different path
- **Unit Manager:** filtered to own unit (this fix)
- **Branch Manager:** full branch query (unchanged)
- **Tenant Admin:** full tenant query (unchanged)
- **Platform Admin:** full tenant query (unchanged)

### Aria-label fix is a one-line change

Add `aria-label="Select week"` (or equivalent contextual label) to the `<select>` element in the Master Sheet week picker. CC's Phase 1 confirms exact label wording based on existing surrounding context.

### Test coverage required

- Extend `src/services/__tests__/managerService.test.js` with `getWeeklySubmissions` scoping coverage (new describe block, do NOT rewrite the existing 6 tests from #142)
- New test scenarios mirror the existing pattern: UM applies where filter, BM/TA/PA pass through unscoped, provisioning docs filtered

### Phase 1 audit MUST enumerate all manager-side data paths

Before proposing the fix, CC enumerates every exported function in `managerService.js` and `agentManagementService.js` that:
- Returns docs joinable to users (submissions, persistency, settlements, anything keyed by agentId/uid)
- Could be called by a UM
- Currently has no role-aware filter

If Phase 1 finds OTHER unscoped data paths beyond `getWeeklySubmissions`, STOP and surface — could expand scope (similar to #142's expansion to agentManagementService).

### Verification: manual smoke required post-merge

After merge, Kyron signs in as a UM, opens Master Sheet, confirms only own unit's agents appear as rows (not just in name map). Then signs in as BM, confirms full branch visibility preserved.

### No re-run of full shakedown in this PR

The shakedown re-run is a separate workflow after this PR lands.

---

## Scope

Ships in this single PR:

- `src/services/managerService.js` — `getWeeklySubmissions` scoping fix per Phase 1 findings
- `firestore.rules` — UM scoping on submissions collection (defense in depth)
- `src/components/manager/MasterSheet.jsx` (or wherever the week picker lives) — `aria-label` on the `<select>` element
- `src/services/__tests__/managerService.test.js` — extend with new describe block for `getWeeklySubmissions` scoping
- `docs/CONTEXT.md` "Recently shipped" row append
- `docs/FOLLOW_UPS.md`:
  - SHAKEDOWN-002 entry marked fully resolved with both #142 and this PR's # noted
  - Bug 005 aria-label entry marked resolved
  - Bug 001, Bugs 003/004, Bug 006 banked as opportunistic shakedown harness follow-ups

---

## File inventory

**Files expected to touch:**

| Path | Change |
|---|---|
| `src/services/managerService.js` | Add role-aware unit scoping to `getWeeklySubmissions` |
| `src/services/__tests__/managerService.test.js` | New describe block for `getWeeklySubmissions` scoping (do NOT rewrite existing tests) |
| `firestore.rules` | Add UM unit scoping to submissions collection list rules |
| `src/components/manager/MasterSheet.jsx` (Phase 1 confirms path) | Add `aria-label` to week picker `<select>` |
| `docs/CONTEXT.md` | Recently-shipped row append (SHA/PR# placeholders post-merge) |
| `docs/FOLLOW_UPS.md` | Mark SHAKEDOWN-002 fully resolved + Bug 005 resolved + bank harness follow-ups |

**No other files expected.** If Phase 1 surfaces a different consumer for the week picker, or other data paths needing scoping → STOP and surface scope expansion.

---

## Phases

### Phase 1 — Discovery & full audit (gates Phase 2)

**Surface in chat (no committed discovery doc):**

1. Capture main HEAD SHA via `git log origin/main --oneline -1`. Confirm post-#143 state.
2. Read `src/services/managerService.js` — focus on `getWeeklySubmissions`. What query does it construct? Confirm no existing role-aware filter.
3. **Full audit:** enumerate EVERY exported function in `managerService.js` and `agentManagementService.js`. For each, classify:
   - Already role-scoped (post #142 work)
   - Not joinable to users (e.g., branch-level aggregates)
   - **Joinable to users + currently unscoped** ← these are the gap
4. Read `firestore.rules` — focus on the submissions collection rules. What scoping exists today? Identify the exact place where UM scoping needs to be added (likely a new branch in `canManage` or a dedicated submissions rule).
5. Find the Master Sheet week picker `<select>` in source. Confirm path. Identify surrounding context for the aria-label text.
6. Read the shakedown finding entry for T2B.03 in `docs/shakedown-findings-2026-05-14.md`.
7. Surface in chat:
   - List of unscoped joinable-to-users paths found (expected: at least `getWeeklySubmissions`)
   - Exact code change recommendation for `getWeeklySubmissions`
   - Exact rules change recommendation
   - Aria-label exact text + selector location
   - Test plan

Kyron acks before Phase 2.

**Hard stop in Phase 1:**
- If MORE than 1 unscoped joinable path found (i.e., scope expansion beyond `getWeeklySubmissions`) → STOP and surface, await acknowledgement
- If `getWeeklySubmissions` requires changes beyond adding a where clause → STOP and surface

### Phase 2 — Apply fix

Per the approved Phase 1 recommendation. Commit structure suggestion (CC's call):
- Commit 1: `getWeeklySubmissions` scoping + rules + test
- Commit 2: Master Sheet aria-label
- Or single combined commit with clear message

### Phase 3 — Verification

- `npm run lint` → 0 errors
- `npm test -- --run` → all pass including new test cases
- `npm run build` → success
- Visual: confirm `aria-label` renders on the actual `<select>` element via `grep` or quick devtools mental model

### Phase 4 — Docs, commit, push, PR

- Update `docs/CONTEXT.md` Recently-shipped row with placeholders
- Update `docs/FOLLOW_UPS.md`:
  - SHAKEDOWN-002 fully resolved (both #142 and this PR's # noted in entry)
  - Bug 005 marked resolved with this PR's # placeholder
  - Add new LOW follow-up entries for Bug 001 (shakedown wizard-step selector fragility), Bugs 003/004 (shakedown form-validation test expectations vs silent filter design intent), Bug 006 (shakedown screenshot 79/80 capture polish)
- Conventional commits
- Push, open PR
- **PR title:** `fix(services): enforce UM unit scoping on submissions + Master Sheet aria-label (SHAKEDOWN-002B)`
- **PR description must include:**
  - Summary referencing the re-run finding and the #142 audit gap lesson
  - Phase 1 audit findings (which paths were enumerated, which gaps found)
  - Fix shape applied (Shape C, same as #142)
  - Role distinction preserved (Agent / UM / BM / TA / PA scopes)
  - Bug 005 fix described
  - Test coverage added
  - Verification matrix
  - Note: post-merge manual smoke (sign in as UM, confirm scope; sign in as BM, confirm BM scope preserved; verify aria-label via screen reader OR devtools inspection)

### Phase 5 — STOP

DO NOT MERGE. Kyron reviews + performs manual smoke.

---

## Hard stops

- `npm run lint` fails → fix, don't commit broken state
- Existing tests start failing → STOP and surface (regression)
- `npm run build` fails → STOP and surface
- Phase 1 finds the fix requires changes beyond the file inventory → STOP and surface scope expansion (no implicit expansion this time — see methodology requirement)
- Phase 1 finds MORE THAN ONE additional unscoped joinable path (i.e., systemic gap beyond `getWeeklySubmissions`) → STOP, this is a different brief shape
- Phase 1 finds the existing `managerService.test.js` from #142 has issues that need addressing → STOP and surface (probably out of scope)
- Phase 1 finds the fix would change BM visibility (overreach) → STOP and reconsider
- More than 1 hour spent in Phase 1 without converging → STOP and surface
- ANY decision not pre-listed in "Decisions locked" — STOP and surface BEFORE acting
- First unexpected behavior of any kind — standard 2-strike loop applies, lean toward surfacing early

---

## NOT in scope

- SHAKEDOWN-001 (already fixed in #141)
- Bug 001 — shakedown wizard-step selector fragility (bank as LOW opportunistic shakedown harness follow-up)
- Bugs 003/004 — shakedown form-validation test expectations vs design intent (bank as LOW opportunistic shakedown harness follow-up)
- Bug 006 — shakedown screenshot 79/80 capture polish (bank as LOW opportunistic shakedown harness follow-up)
- A11y violations beyond Bug 005 — bank for post-pilot polish
- Refactor of managerService beyond the scoping fix
- Changes to ManagerDashboard.jsx — STOP and surface if Phase 1 points there
- Changes to BM, TA, or PA scoping (unchanged)
- Re-running the full shakedown — separate workflow after this lands
- Changes to PR-4b, SEC-9b, SHAKEDOWN-001, or SHAKEDOWN-002 patterns

---

## Verification matrix (CC must include in PR description)

| Item | Command | Expected |
|---|---|---|
| Lint clean | `npm run lint` | 0 errors |
| Tests pass | `npm test -- --run` | 100% pass including new managerService scoping tests |
| Build succeeds | `npm run build` | success, no warnings |
| Fix shape documented | PR description | Shape C with rationale, referencing #142 pattern |
| Phase 1 audit documented | PR description | Full enumeration of manager-side joinable data paths surfaced |
| Aria-label added | `git diff src/components/manager/MasterSheet.jsx` | `aria-label` attribute present on week picker `<select>` |
| Role distinction preserved | PR description | Agent/UM/BM/TA/PA scopes explicitly documented |
| CONTEXT.md updated | `git diff docs/CONTEXT.md` | Recently-shipped row added, oldest removed |
| FOLLOW_UPS.md updated | `git diff docs/FOLLOW_UPS.md` | SHAKEDOWN-002 fully resolved + Bug 005 resolved + 3 LOW harness follow-ups banked |
| Post-merge UM smoke | Note in PR description | Kyron signs in as UM, confirms Master Sheet rows scoped to own unit |
| Post-merge BM smoke | Note in PR description | Kyron signs in as BM, confirms full branch visibility preserved |
| Aria-label visual check | Note in PR description | Kyron verifies aria-label on week picker via devtools or screen reader |

---

## CC kickoff prompt (one-liner)

> Execute SHAKEDOWN-002B + Bug 005 fix per the brief in `docs/briefs/shakedown-002b-fix-kickoff.md`. Project strike count 0/2. Standard 2-strike loop. **Read the methodology requirement at the top first — surface BEFORE making ANY architectural decision not pre-listed in "Decisions locked"; this is itself a strike condition. Phase 1 audit MUST enumerate ALL manager-side data paths, not just the one called out — the #142 audit gap is the lesson being banked here.** Begin Phase 1 (discovery + full audit). Surface findings + fix shape + test plan in chat before any code changes. Do NOT merge — open PR with verification matrix, stop.
