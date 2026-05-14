# Denormalize `unitId` onto Submission Docs — Kickoff Brief

**Status:** Ready to dispatch to fresh CC session.
**Estimated CC effort:** 2–3 hours, single PR.
**Two-strike counter:** Project carry-in **0/2**. Standard 2-strike loop applies.
**Main HEAD at brief drafting:** post-#146 squash (CC captures actual HEAD in Phase 0).
**Source:** LOW follow-up banked in #144's FOLLOW_UPS.md. Completes the partial defense-in-depth from SHAKEDOWN-002B by enabling rules-level list enforcement on submissions.

---

## Methodology requirement (read first)

CC must surface BEFORE making any decision not pre-listed in "Decisions locked":

- Scope expansion beyond the file inventory in this brief
- New architectural patterns not pre-decided
- Test file rewrite from scratch (vs. targeted edits)
- Inline fix of unexpected behavior (vs. STOP + surface)
- Any "how to solve" decision not explicitly pre-decided

"Solve rather than surface" is a strike condition even when the resulting fix is correct. Surface first, solve after acknowledgement.

**Phase 1 audit must enumerate ALL submission write paths AND all consumers of the post-#146 agent-uid cache.** The SHAKEDOWN-002 → SHAKEDOWN-002B audit-gap lesson banked in CLAUDE.md applies here.

---

## Context

SHAKEDOWN-002B (#144) shipped UM scoping for submission queries using an agent-uid lookup pattern: fetch UM's agent UIDs first, then `where('agentId', 'in', agentUids)`. This works but has two architectural compromises:

1. **2 reads per query** — mitigated in #146 by caching agent UIDs per session
2. **Partial defense-in-depth at rules layer** — `allow get` uses cross-doc lookup (works); `allow list` cannot enforce per-document filtering and relies on client-side filter as the real protection. Documented as a known limitation in #144's PR description.

**This brief denormalizes `unitId` onto submission docs at write time.** Once present, the architecture simplifies meaningfully:

- Service layer: `where('unitId', '==', callerUid)` becomes the natural query (1 read, not 2)
- Rules layer: `allow list` can enforce `resource.data.unitId == request.auth.uid` for UMs (full defense-in-depth, not partial)
- The cache + helper from #146 lose their consumers in the submission path (Phase 1 audit confirms whether anything else still uses them)

**Real-world benefit:**
- Eliminates the 30-item Firestore `in` cap for units (no longer relevant — direct `where` has no such limit)
- Closes the documented #144 partial defense-in-depth gap
- Reduces UM Master Sheet load to a single Firestore read (vs. cached 1, or uncached 2)

---

## Decisions locked (do not re-litigate; surface ANY deviation BEFORE implementing)

### Write path: populate `unitId` on every submission write

- Source: `userProfile.unitId` from AuthContext at submission time
- Applied to both `saveDraft` and `submitReport` paths in `submissionService.js`
- Phase 1 confirms exact write paths and any common payload-builder utility

### Backfill: one-time Admin SDK script, run pre-merge

- New script: `scripts/backfill/denormalize-submission-unitId.mjs`
- Reads every submission doc, looks up agent's current `unitId` from user doc, writes back
- Idempotent — skips docs that already have `unitId` populated
- Dry-run default; requires `--execute` flag for actual writes
- Progress logging every 100 docs
- Runs before merge, against production Firestore (the only environment with real submissions)

### Reassignment policy: historical submissions keep original unitId

If an agent is moved to a different unit later, their existing submissions retain the original `unitId`. No retroactive update. Matches the principle that historical submissions are immutable attribution records.

### Rules: tighten both `allow get` and `allow list`

- `allow get` simplifies from cross-doc lookup to direct field check: UM can get if `resource.data.unitId == request.auth.uid`
- `allow list` adds UM enforcement: UM list queries must filter by `unitId == request.auth.uid` (rule enforces; client query must include the filter)
- BM/TA/PA paths unchanged (broader access preserved)

### Service layer: simplify both functions, surface decision on cache

- `managerService.getWeeklySubmissions` — for UM, replace agent-uid lookup with direct `where('unitId', '==', callerUid)` + existing `where('weekStarting', '==', weekStarting)`
- `managerService.getAllYTDSubmissions` — same pattern, plus YTD date filter

**SURFACE FOR ACK in Phase 1:** the agent-uid cache from #146 (`agentUidCache`, `getCallerAgentUids`, `clearAgentUidCache`). Two paths:

- **Path A — remove entirely:** simpler code, less surface area. Justified if Phase 1 confirms no other consumers exist beyond the two functions we're simplifying.
- **Path B — keep as private utility:** future-proofs against re-introduction for other use cases. Costs: ~30 lines retained code with no consumers, AuthContext still calls clearAgentUidCache on sign-out (harmless no-op).

Default recommendation: **Path A** if Phase 1 confirms no other consumers. Path B only if Phase 1 finds a non-trivial consumer the brief missed.

### Test coverage

- `src/services/__tests__/submissionService.test.js` — assert `unitId` is included in write payloads (new tests, additive)
- `src/services/__tests__/managerService.test.js` — UPDATE the 11 existing UM-scoping tests (from #144 + #146) to expect the new direct-query shape; REMOVE the 6 cache-coverage tests from #146 if Path A is chosen (else update them)
- Backfill script: separate harness or manual dry-run verification in PR description

### Verification: manual smoke required pre-merge

After CC opens the PR, Kyron runs:
1. Backfill dry-run on production Firestore — review output sample
2. After approve, Kyron runs backfill with `--execute` — confirms all submissions have `unitId`
3. Spot-check a few submission docs in Firestore console — confirm `unitId` is populated
4. Only after backfill complete + spot-check passes, merge the PR

Then post-merge smoke:
5. Sign in as UM → Master Sheet → confirm own-unit rows still visible
6. Sign in as BM → confirm full branch visibility preserved
7. Verify only ONE read on Master Sheet load via devtools Network tab (no agent-uid fetch)

---

## Scope

Ships in this single PR:

- `src/services/submissionService.js` — add `unitId` to draft + submit payloads
- `src/services/managerService.js` — simplify both UM-scoped functions; cache removal (Path A) pending Phase 1 ack
- `src/context/AuthContext.jsx` — remove `clearAgentUidCache` import + call (if Path A)
- `firestore.rules` — tighten `allow get` + `allow list` for submissions
- `src/services/__tests__/managerService.test.js` — update existing UM tests to new query shape; cache tests handled per Path A/B
- `src/services/__tests__/submissionService.test.js` — assert `unitId` in write payloads
- `scripts/backfill/denormalize-submission-unitId.mjs` — new backfill script
- `docs/CONTEXT.md` "Recently shipped" row append
- `docs/FOLLOW_UPS.md` — mark "Denormalize unitId onto submission docs" resolved

---

## File inventory

| Path | Change |
|---|---|
| `src/services/submissionService.js` | Add `unitId: userProfile.unitId` to saveDraft + submitReport payloads |
| `src/services/managerService.js` | Simplify getWeeklySubmissions + getAllYTDSubmissions; remove cache + helper if Path A |
| `src/context/AuthContext.jsx` | Remove clearAgentUidCache call if Path A |
| `firestore.rules` | Submissions allow get/list rule changes |
| `src/services/__tests__/managerService.test.js` | Update existing 11 UM tests; remove or update 6 cache tests per Path A/B |
| `src/services/__tests__/submissionService.test.js` | New assertions for unitId in payloads |
| `scripts/backfill/denormalize-submission-unitId.mjs` | New backfill script |
| `docs/CONTEXT.md` | Recently-shipped row (placeholders for this PR's SHA/PR#) |
| `docs/FOLLOW_UPS.md` | Mark denormalize-unitId resolved with placeholder |

---

## Phases

### Phase 0 — PR #146 post-merge cleanup (one-time bundling)

Per the new workflow (Memory bank update), this would normally be CC's Phase 6 work on the previous brief. Since #146's brief didn't include a Phase 6 step, the placeholder fills are still open. Bundle them here as Phase 0:

1. `git checkout main`
2. `git fetch origin --prune`
3. `git pull origin main`
4. `git log origin/main --oneline -3` — capture #146's squash SHA (most recent commit by Kyron via squash-merge)
5. Read `docs/CONTEXT.md` — find #146's Recently-shipped row with `<sha>` and `<pr#>` placeholders. Fill with the captured SHA and `#146`.
6. Read `docs/FOLLOW_UPS.md` — find the "Cache UM agent UIDs per session" entry with `<pr#>` placeholder. Fill with `#146`.
7. Commit: `docs: fill #146 squash SHA + PR# placeholders`
8. `git push origin main` (docs-only direct-to-main exception)
9. Optional: remove the #146 worktree + branch:
   ```
   git worktree remove <path> 
   git branch -D <branch>   # canonical per CLAUDE.md ### Post-merge local cleanup
   ```
10. Surface in chat: "Phase 0 complete. #146 placeholders filled at <sha>. Proceeding to Phase 1."

If any step fails or main HEAD doesn't look right (e.g., merge commit instead of squash), STOP and surface.

### Phase 1 — Discovery & audit (gates Phase 2)

Surface in chat (no committed discovery doc):

1. Confirm main HEAD post-Phase-0 — should now include the `docs: fill #146 ...` commit on top of #146's squash
2. Read `src/services/submissionService.js` — enumerate ALL submission write paths. Confirm both `saveDraft` and `submitReport` write to the same collection. Note any common payload-builder utility.
3. Read `src/services/managerService.js` — enumerate every consumer of `getCallerAgentUids` and `agentUidCache`. Confirm exactly which functions use them.
4. Audit search: `grep` for `getCallerAgentUids` and `agentUidCache` across `src/` to catch any consumer outside managerService.js — surface findings.
5. Read `src/context/AuthContext.jsx` — locate `clearAgentUidCache` import + call. Confirm clean removal point if Path A.
6. Read `firestore.rules` — locate submissions match block. Identify exact insertion points for tightened `allow get` and `allow list` rules.
7. Read `src/services/__tests__/managerService.test.js` — count existing tests touching UM scoping (expect 11 from #144 + 6 from #146 = 17). Identify which need update vs which need removal (Path A) vs which can stay.
8. Surface cache decision: **Path A (remove) or Path B (keep)?** Default Path A pending consumer audit. Surface findings + recommendation.
9. Surface backfill script design: shape, idempotency check, dry-run output format, progress logging cadence, error handling for orphaned submissions (agent doc missing).

Kyron acks before Phase 2.

**Hard stops in Phase 1:**
- A consumer of `getCallerAgentUids` or `agentUidCache` is found outside managerService.js → STOP, surface, may invalidate Path A
- Submission write paths exist beyond `saveDraft` + `submitReport` → STOP, scope expansion
- Existing tests have ordering dependencies that block clean updates → STOP, surface
- Rules change requires schema changes beyond the unitId field → STOP, surface

### Phase 2 — Apply implementation

Per the approved Phase 1 plan:
- Add `unitId` to submission write payloads
- Simplify `getWeeklySubmissions` + `getAllYTDSubmissions`
- Remove cache + helper (Path A) or update them (Path B)
- Update AuthContext (if Path A)
- Update rules
- Update + remove (Path A) / update (Path B) tests
- Add new submission-service tests

### Phase 3 — Backfill script

- Create `scripts/backfill/denormalize-submission-unitId.mjs`
- Dry-run mode default; `--execute` required for writes
- Idempotent (skip docs with `unitId` already populated)
- Progress logging every 100 docs
- Error handling: orphaned submission (agent doc missing) logs warning, skips, continues
- Final summary: counts of updated / skipped-already-populated / errored / total

Do NOT run the script in Phase 3 — that's Kyron's manual step pre-merge. Just create + verify the script via dry-run on a small sample (CC can manually invoke against production with dry-run to validate script correctness; no writes possible without `--execute`).

### Phase 4 — Verification

- `npm run lint` → 0 errors
- `npm test -- --run` → all pass (count may decrease if Path A removes 6 cache tests, expect ~633 still as new submission tests offset)
- `npm run build` → success, no new warnings

### Phase 5 — Docs, commit, push, PR

- Update `docs/CONTEXT.md` Recently-shipped row with placeholders
- Update `docs/FOLLOW_UPS.md` — mark "Denormalize unitId onto submission docs" resolved with placeholder
- Conventional commit(s)
- Push, open PR
- **PR title:** `feat(submissions): denormalize unitId onto submission docs (full defense-in-depth)`
- **PR description must include:**
  - Summary referencing the #144 partial defense-in-depth + #146 cache work
  - Phase 1 audit findings (cache consumer enumeration; Path A vs B decision rationale)
  - Architecture diff: 2-read agent-uid lookup → direct 1-read unitId query
  - Rules layer: partial defense-in-depth → full defense-in-depth
  - Backfill script: usage, dry-run sample output, expected execution time on production
  - **Manual pre-merge step:** explicit instructions for Kyron — dry-run review → `--execute` → spot-check
  - Verification matrix
  - Tests delta (added / updated / removed counts)

### Phase 6 — STOP

DO NOT MERGE. Kyron reviews + runs backfill + manual smoke. Once Kyron confirms merge with "PR #<N> merged", CC executes Phase 7.

### Phase 7 — Post-merge cleanup (NEW STANDARD — wait for Kyron's merge confirmation)

Execute ONLY after Kyron messages "PR #<N> merged" or equivalent:

1. `git checkout main && git fetch origin --prune && git pull origin main`
2. `git log origin/main --oneline -1` — capture squash SHA
3. Fill `docs/CONTEXT.md` SHA + PR# placeholders
4. Fill `docs/FOLLOW_UPS.md` PR# placeholder
5. Commit: `docs: fill #<N> squash SHA + PR# placeholders`
6. `git push origin main`
7. Remove worktree: `git worktree remove <path>`
8. Delete branch: `git branch -D <branch>` (canonical per CLAUDE.md ### Post-merge local cleanup)
9. Surface in chat: "Phase 7 complete. #<N> placeholders filled at <sha>. Worktree + branch cleaned."

---

## Hard stops

- Lint fails → fix, don't commit broken state
- Existing tests start failing in unexpected ways → STOP, surface
- Build fails → STOP, surface
- Phase 1 finds the fix requires changes beyond the file inventory → STOP, scope expansion
- Phase 1 finds cache consumers outside managerService.js → STOP, surface, may invalidate Path A
- Submission write paths exist beyond `saveDraft` + `submitReport` → STOP, scope expansion
- Backfill script's dry-run shows unexpected data shapes → STOP, surface before designing more
- `userProfile.unitId` is unavailable in submissionService context → STOP, surface (architecture problem)
- Rules change conflicts with existing rule patterns → STOP, surface
- ANY decision not pre-listed in "Decisions locked" — STOP and surface BEFORE acting
- Two-strike loop: lean toward surfacing early

---

## NOT in scope

- Adding `unitId` to OTHER doc types (e.g., persistency, settlements) — separate brief if needed
- Migrating the agent-uid cache to a different use case
- Re-introducing cache logic for other paths (BM/TA/PA queries unchanged, no caching needed)
- Backfill for non-submission documents
- Optimizations to the backfill script beyond batched writes + progress logging
- Changes to consumer components (MasterSheet, ManagerDashboard, UnitManagerProductionView — they consume the service, no direct file changes needed)
- Refactor of SHAKEDOWN-002B logic beyond what this denormalization simplifies
- Changes to submission edit flows (locked/unlocked logic) — those write paths exist but follow different rule sets
- Modifications to PR #146's behavior on main beyond removing the now-orphan cache

---

## Verification matrix (CC must include in PR description)

| Item | Command | Expected |
|---|---|---|
| Lint clean | `npm run lint` | 0 errors |
| Tests pass | `npm test -- --run` | 100% pass |
| Build succeeds | `npm run build` | success, no new warnings |
| unitId in write payloads | submissionService.test.js | new assertions verify unitId present |
| Direct query simplification | managerService diff | both UM functions use single `where('unitId', '==', callerUid)` |
| Cache removal (if Path A) | managerService.js + AuthContext.jsx diffs | agentUidCache + helpers + AuthContext call all removed |
| Rules tightening | firestore.rules diff | submissions allow get/list both reference unitId |
| Backfill script idempotency | manual dry-run on production | second run shows 0 updates, all skip-already-populated |
| Backfill dry-run output sample | PR description | shows representative output for Kyron's review |
| Phase 1 audit documented | PR description | cache consumer enumeration result + Path A/B decision rationale |
| Pre-merge manual step | PR description | explicit `--execute` instruction for Kyron + spot-check guidance |
| Post-merge smoke | Note in PR description | Kyron may verify single read on Master Sheet via devtools |

---

## CC kickoff prompt (one-liner)

> Execute the unitId denormalization on submissions per the brief in `docs/briefs/denormalize-submission-unitid-kickoff.md`. Project strike count 0/2. Standard 2-strike loop. **Read the methodology requirement at the top first — surface BEFORE making ANY architectural decision not pre-listed in "Decisions locked"; this is itself a strike condition. Phase 1 audit MUST enumerate ALL submission write paths AND all cache consumers — the SHAKEDOWN-002→002B audit-gap lesson banked in CLAUDE.md applies.** Begin with Phase 0 (PR #146 post-merge cleanup as one-time bundling). Surface Phase 0 completion before Phase 1. Phase 1 surfaces cache consumer audit + Path A/B recommendation. Do NOT merge — open PR with verification matrix, stop. Phase 7 post-merge cleanup waits for Kyron's "PR merged" confirmation.
