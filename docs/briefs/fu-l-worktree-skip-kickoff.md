# FU-L: `prune-merged-branches.mjs` skip worktree-attached branches

**Type:** Implementation PR (LOW housekeeping, script enhancement)
**Shape:** XS, 4-file commit (1 script edit + 1 runbook edit + FOLLOW_UPS.md + CONTEXT.md).
**Reference shape:** Similar to FU-K script PR but smaller (no new files, single function added + integration point).
**Banking origin:** FU-L banked 2026-05-18 in FU-F-1 Phase 4c (FOLLOW_UPS.md). Surfaced during dogfood `--execute` run earlier 2026-05-18 — script reported `error: cannot delete branch 'chore/fu-h-stale-row-sweep' used by worktree at 'C:/Projects/AgencyTrack-fu-h-sweep'`. Second canonical Rule 17 in-the-wild signal at FU-K brief authoring time (mental simulation didn't query `git worktree list`).

---

## Architectural decision (locked at brief authoring time)

**Add `parseWorktreeBranches()` helper + integrate into classification loop.** Specifically:

1. **New helper function** `parseWorktreeBranches()` returns `Map<branchName, worktreePath>` for all branches attached to any worktree.
2. **Integration point:** call helper once in `main()` before the existing classification loop. For each enumerated local branch, check `worktreeBranches.has(name)` BEFORE the `[gone]`/live classification. If worktree-attached, push to `live` with marker `(attached to worktree at <path>)`. Skip the `[gone]` check entirely.
3. **Hard exclusions unchanged:** `main` + current branch still hard-excluded via the existing `continue` short-circuit BEFORE the worktree check. The new logic catches everything ELSE that's worktree-attached.
4. **Operator guidance updated:** the existing "Investigate separately" message gains "...or worktree-attached (use `git worktree remove <path>` to detach)."
5. **Runbook update** at `docs/runbooks/branch-cleanup.md` documents the new behavior in a "Worktree-attached branches" section.

**Counterargument considered:** could add worktree-attachment as a hard exclusion (treat like `main`/current branch — never delete) instead of a "skip with marker." Rejected because: skip-with-marker preserves operator visibility (they see WHICH branches are attached + WHERE), making cleanup actionable. Hard exclusion would silently exclude them, losing diagnostic value. The dogfood scenario this morning surfaced precisely because the script REPORTED the failure — preserving visibility is the design intent.

**Failure mode handled:** `git worktree list --porcelain` could fail (e.g., corrupted worktree state). Helper wraps the call in try/catch; on failure, logs a warning and continues with empty Map (script behaves as pre-FU-L). Operator can manually review.

---

## Source-verified state (at brief authoring time, 2026-05-18)

Confirmed against repo HEAD `c0e4684` (post-FU-F-1 Phase 6 fill).

- **Existing script** at `scripts/maintenance/prune-merged-branches.mjs` (173 lines, shipped FU-K PR #194). Module structure: JSDoc header → ES imports → `__dir`/`ROOT` resolution → CLI args parsing → log setup → `git()` spawnSync helper → `main()` function. Classification loop in `main()` at the heart of the script.
- **Current hard exclusion logic** in classification loop: `if (name === 'main' || name === currentBranch) continue;` BEFORE the `[gone]` check.
- **Current display message** in the "live" list rendering: `'  → Investigate separately: open PRs, closed-unmerged PRs, or pre-deleteBranchOnMerge legacy.'` + `'  → See docs/runbooks/branch-cleanup.md for handling guidance.'`
- **`git worktree list --porcelain` output format** — record-based, blank-line separated:
  ```
  worktree <path>
  HEAD <sha>
  branch refs/heads/<name>
  
  worktree <next-path>
  HEAD <sha>
  branch refs/heads/<next-name>
  ```
  Detached worktrees have no `branch` line — skipped in parser.
- **Runbook** at `docs/runbooks/branch-cleanup.md` (130 lines, shipped FU-K PR #194). Existing sections: "Why not `git branch --merged main`?", three numbered steps, "Branches with live upstream", "Branches with no upstream", "Stale remote-tracking refs", "Troubleshooting". A new section between "Branches with live upstream" and "Branches with no upstream" is the natural slot.

---

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`
2. `git checkout main && git pull --ff-only origin main`
3. `git log origin/main --oneline -1` — capture verbatim. Expected: this brief's docs PR squash (per Rule 10).
4. `git checkout -b chore/fu-l-worktree-skip`
5. Any failure or drift → **STOP and wait for dispatcher.**

## Phase 1 — re-verify FU-L scope

1. Read `scripts/maintenance/prune-merged-branches.mjs` end-to-end. Confirm:
   - JSDoc + imports + `__dir`/`ROOT` + CLI args + log setup + `git()` helper + `main()` structure unchanged from FU-K PR #194 ship.
   - Classification loop in `main()` contains the existing hard-exclusion check `if (name === 'main' || name === currentBranch) continue;`.
   - Display message in live list rendering matches the brief's source-verified text.
2. Read `docs/runbooks/branch-cleanup.md` end-to-end. Confirm structure unchanged (six sections: Why not git branch --merged main / Step 1-3 / Branches with live upstream / Branches with no upstream / Stale remote-tracking refs / Troubleshooting).
3. Run `git worktree list --porcelain` from main to capture the current worktree state. Expected: at least one entry (the main worktree). If unexpected state (e.g., multiple detached worktrees or corrupted output), **STOP and wait for dispatcher**.
4. Read `docs/FOLLOW_UPS.md` FU-L entry to confirm banked-2026-05-18 status, no in-progress modifications.
5. Any divergence from this brief's source-verified state → **STOP and wait for dispatcher.**

## Phase 2 — execute

### 2a. Update `scripts/maintenance/prune-merged-branches.mjs`

**Edit 1:** Add new helper function `parseWorktreeBranches()` immediately after the existing `git()` helper. Match the existing helper's commenting cadence.

```javascript
// ── Worktree map — branches attached to any worktree ──────────────────────────

function parseWorktreeBranches() {
  // Returns Map<branchName, worktreePath> for all branches attached to a worktree.
  // Output format from `git worktree list --porcelain`:
  //   worktree <path>
  //   HEAD <sha>
  //   branch refs/heads/<name>   (omitted if detached)
  //   [blank line between records]
  const map = new Map();
  let raw;
  try {
    raw = git('worktree', 'list', '--porcelain');
  } catch (err) {
    log(`⚠ git worktree list --porcelain failed: ${(err.stderr || err.message).trim()}`);
    log('  Continuing without worktree-attached protection. Manual review recommended.');
    return map;
  }

  let currentPath = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('worktree ')) {
      currentPath = line.slice('worktree '.length).trim();
    } else if (line.startsWith('branch refs/heads/')) {
      const branchName = line.slice('branch refs/heads/'.length).trim();
      if (currentPath) map.set(branchName, currentPath);
    } else if (line === '') {
      currentPath = null;  // end of record
    }
    // detached worktrees have no `branch` line — skip
  }

  return map;
}
```

**Edit 2:** Integrate the helper into `main()`. Locate the section AFTER `git('fetch', '--prune', 'origin')` and AFTER `const currentBranch = git('rev-parse', '--abbrev-ref', 'HEAD');`. Insert the worktree map population BEFORE the existing classification loop.

Specifically, locate this existing code block:

```javascript
const currentBranch = git('rev-parse', '--abbrev-ref', 'HEAD');
log(`Current branch: ${currentBranch}`);
log('');

// Enumerate all local branches with their upstream-tracking status.
```

Modify to:

```javascript
const currentBranch = git('rev-parse', '--abbrev-ref', 'HEAD');
log(`Current branch: ${currentBranch}`);

const worktreeBranches = parseWorktreeBranches();
log(`Worktree-attached branches detected: ${worktreeBranches.size}`);
log('');

// Enumerate all local branches with their upstream-tracking status.
```

**Edit 3:** Update the classification loop to check worktree-attachment BEFORE the `[gone]`/live classification. Locate the existing loop:

```javascript
for (const line of lines) {
  const [name, track] = line.split('|');
  if (name === 'main' || name === currentBranch) continue;   // hard exclusion
  if (track && track.includes('gone')) {
    stale.push(name);
  } else {
    live.push({ name, track: track || '(no upstream)' });
  }
}
```

Modify to:

```javascript
for (const line of lines) {
  const [name, track] = line.split('|');
  if (name === 'main' || name === currentBranch) continue;   // hard exclusion

  // Worktree-attached branches: skip with diagnostic marker.
  // `git branch -D` refuses to delete branches checked out in any worktree.
  if (worktreeBranches.has(name)) {
    live.push({ name, track: `(attached to worktree at ${worktreeBranches.get(name)})` });
    continue;
  }

  if (track && track.includes('gone')) {
    stale.push(name);
  } else {
    live.push({ name, track: track || '(no upstream)' });
  }
}
```

**Edit 4:** Update the operator guidance message in the "live" list display. Locate:

```javascript
log('  → Investigate separately: open PRs, closed-unmerged PRs, or pre-deleteBranchOnMerge legacy.');
log('  → See docs/runbooks/branch-cleanup.md for handling guidance.');
```

Modify to:

```javascript
log('  → Investigate separately: open PRs, closed-unmerged PRs, pre-deleteBranchOnMerge legacy, or worktree-attached.');
log('  → For worktree-attached entries: `git worktree remove <path>` to detach, then re-run.');
log('  → See docs/runbooks/branch-cleanup.md for handling guidance.');
```

### 2b. Update `docs/runbooks/branch-cleanup.md`

Add a new section between "Branches with live upstream" and "Branches with no upstream". Match the existing section cadence (`##` heading + prose paragraph + PowerShell code fence if applicable).

```markdown
## Worktree-attached branches

If the script reports any entries under "NOT swept" with marker `(attached to
worktree at <path>)`, the local branch is checked out in a Git worktree at the
specified path. `git branch -D` refuses to delete branches attached to any
worktree (not just the current one), so the script skips these entries
explicitly.

To clean up a worktree-attached branch:

```powershell
git worktree remove <path>          # detach the worktree
node scripts/maintenance/prune-merged-branches.mjs --execute   # re-run sweep
```

If the worktree is in a dirty state (uncommitted changes), `git worktree remove`
will refuse. Either commit/stash inside the worktree first, or force-remove
with `git worktree remove <path> --force` if the work is intentionally
discardable.

After detaching, the local branch's deletion status depends on its upstream
state (`[gone]` → sweep candidate; live upstream → skipped). Re-run the script
to apply the appropriate handling.
```

## Phase 3 — verify

1. `git diff --stat HEAD` shows exactly 4 changed entries: `M scripts/maintenance/prune-merged-branches.mjs`, `M docs/runbooks/branch-cleanup.md`, `M docs/FOLLOW_UPS.md`, `M docs/CONTEXT.md`. Anything else → **STOP and wait for dispatcher.**
2. `git diff main..HEAD -- .env.example` returns empty (Rule 14 carve-out).
3. Read the modified script end-to-end. Confirm:
   - `parseWorktreeBranches()` helper present with try/catch + record parsing logic.
   - Helper called once in `main()` AFTER `currentBranch` capture, BEFORE classification loop.
   - Classification loop checks `worktreeBranches.has(name)` AFTER hard exclusion and BEFORE `[gone]` check.
   - Operator guidance message includes the `git worktree remove <path>` hint.
4. Read the modified runbook end-to-end. Confirm:
   - New "Worktree-attached branches" section between "Branches with live upstream" and "Branches with no upstream".
   - PowerShell example included.
   - Force-remove caveat documented.
5. `node --check scripts/maintenance/prune-merged-branches.mjs` — expect pass.
6. **Integration test (NEW for FU-L):** create a throwaway worktree to exercise the new logic:
   ```powershell
   git branch test/fu-l-worktree-check
   git worktree add ../AgencyTrack-fu-l-test test/fu-l-worktree-check
   node scripts/maintenance/prune-merged-branches.mjs       # dry-run from chore/fu-l-worktree-skip
   git worktree remove ../AgencyTrack-fu-l-test
   git branch -D test/fu-l-worktree-check
   ```
   Expected dry-run output: `test/fu-l-worktree-check` appears in the "NOT swept" list with marker `(attached to worktree at <full-path>)`. Capture the dry-run output verbatim for Phase 5 report. **Any failure or unexpected output → STOP and wait for dispatcher.**
7. Run `npm run lint`. Expect 0 problems.
8. Run `npm run build`. Expect clean.

**Smoke waiver per Rule 27:** scripts-only enhancement of maintenance tooling. No runtime behavior change to the app. Integration test in Phase 3 step 6 is the runtime validation. Production smoke walk waived.

## Phase 4 — docs placeholder fill + banking

### 4a. FU-L RESOLVED block (Rule 11 + FU-G/FU-F closure pattern)

1. Update FU-L heading from:
   ```
   ### FU-L — `prune-merged-branches.mjs` skip worktree-attached branches (LOW, housekeeping, banked 2026-05-18)
   ```
   to:
   ```
   ### FU-L — `prune-merged-branches.mjs` skip worktree-attached branches (LOW, housekeeping, RESOLVED 2026-05-18)
   ```
2. Preserve existing body (Surfaced, Mechanism, Proposed fix, Rule 17 dogfood signal, Severity, Sequencing) verbatim — drift trail.
3. Append closure paragraph after the existing "Sequencing" line:

   ```
   **Resolved in PR #{TBD}** (`{TBD}`, 2026-05-18). Added `parseWorktreeBranches()` helper to `scripts/maintenance/prune-merged-branches.mjs` parsing `git worktree list --porcelain`. Integrated into classification loop: worktree-attached branches are routed to the "NOT swept" list with marker `(attached to worktree at <path>)` BEFORE the `[gone]` check, preserving operator visibility and providing actionable guidance (`git worktree remove <path>` to detach + re-run). Runbook at `docs/runbooks/branch-cleanup.md` gains a new "Worktree-attached branches" section between "Branches with live upstream" and "Branches with no upstream". Phase 3 integration test created a throwaway worktree to validate the new logic at runtime — output confirmed `(attached to worktree at <path>)` marker rendered correctly. Closes the dogfood-surfaced gap from morning 2026-05-18 (`chore/fu-h-stale-row-sweep` deletion failure).
   ```

### 4b. Add CONTEXT.md recently-shipped row

Insert at top of CONTEXT.md recently-shipped table:

```
| #{TBD} | `{TBD}` | FU-L worktree-attached branch protection (LOW housekeeping closure): added `parseWorktreeBranches()` to `scripts/maintenance/prune-merged-branches.mjs` parsing `git worktree list --porcelain`; worktree-attached branches routed to skipped list with diagnostic marker before `[gone]` classification. Runbook gains "Worktree-attached branches" section. Phase 3 integration test via throwaway worktree confirmed runtime behavior. Closes dogfood-surfaced gap from morning 2026-05-18. |
```

Drop oldest row if recently-shipped exceeds 5 entries.

### 4c. Top-table / "Where we left off" updates are Phase 6 (Rule 16)

Per Rule 16, the post-merge fill cycle handles top-table fields. Do NOT update those in Phase 4.

## Phase 5 — commit, push, open PR

1. `git add scripts/maintenance/prune-merged-branches.mjs docs/runbooks/branch-cleanup.md docs/FOLLOW_UPS.md docs/CONTEXT.md`
   (NOT `git add -A` — 14 pre-existing untracked files remain outside FU-L's scope.)
2. Commit message: `chore(scripts): FU-L worktree-attached branch protection in prune-merged-branches`
3. `git push -u origin chore/fu-l-worktree-skip`
4. Open PR against main. Title: `chore(scripts): FU-L worktree-attached branch protection (prune-merged-branches.mjs)`. Body must include:
   - Reference to this brief at `docs/briefs/fu-l-worktree-skip-kickoff.md`.
   - Reference to FU-L entry in FOLLOW_UPS.md (now RESOLVED 2026-05-18).
   - Note: "Closes the dogfood-surfaced gap from this morning's `--execute` run (`chore/fu-h-stale-row-sweep` deletion failure). Second canonical Rule 17 in-the-wild signal at FU-K brief authoring time — mental simulation didn't query `git worktree list`."
   - Phase 3 step 6 integration test output (verbatim).
   - Smoke waiver justification (scripts-only maintenance tooling; runtime validated via Phase 3 integration test).
5. Report PR URL + branch HEAD SHA to dispatcher.

## Phase 6 — post-merge cleanup (seventh canonical Rule 16 application)

Standard sequence per Session Protocol step 9 + § Post-merge local cleanup + Rule 16.

1. `git checkout main && git fetch origin && git pull --ff-only origin main`
2. Capture work PR squash SHA: `git log origin/main --oneline -1` — paste verbatim.
3. **Rule 16 fill scope (mandatory):**
   - `docs/CONTEXT.md` recently-shipped row: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
   - `docs/CONTEXT.md` top-table `Current main HEAD` → work PR squash SHA (per Rule 16 — anchors on work-PR squash, NOT fill commit).
   - `docs/CONTEXT.md` top-table `Active track` → "FU-L worktree-attached protection shipped (PR #{N}, squash {SHA}). Dogfood-surfaced gap closed."
   - `docs/CONTEXT.md` top-table `Next track` → carry forward FU-F-1's Next track list with FU-L removed: "Session backlog: FU-F-2 (`.cjs` sibling helper + 6 `.cjs` migrations, S-bucket; audit-locked at 2026-05-18); FU-M `multi-role-smoke.cjs` defunct triage (XS, banked 2026-05-18); FU-I post-pilot (TENANT_ID parameterization); BEH-1 blocked on slide copy."
   - `docs/CONTEXT.md` top-table `Where we left off` → updated prose covering FU-L ship + dogfood-loop close (use→find gap→fix in one day) + remaining queue.
   - `docs/CONTEXT.md` top-table `Last updated` → ISO date of fill commit.
   - `docs/FOLLOW_UPS.md` FU-L closure paragraph: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
4. `git add docs/CONTEXT.md docs/FOLLOW_UPS.md`
5. Commit: `docs: fill PR #{N} placeholders (FU-L closure) — seventh Rule 16 application`
6. `git push origin main`
7. **Rule 15 verification (mandatory):**
   - `git fetch origin && git log origin/main --oneline -1` — paste verbatim.
   - `git rev-parse HEAD && git rev-parse origin/main` — paste verbatim.
   - Confirm: local HEAD == origin/main, fill commit on top, work PR squash directly below.
   - Report "pushed and verified" with all SHAs visible.
   - Any mismatch → **STOP and wait for dispatcher.** Hard-stop.
8. Worktree cleanup: optionally run `scripts/maintenance/prune-merged-branches.mjs --execute` after Phase 6 to clean the `chore/fu-l-worktree-skip` branch. Operator decision, not autonomous.

---

## Acceptance criteria

- `scripts/maintenance/prune-merged-branches.mjs` has `parseWorktreeBranches()` helper + integration in classification loop + updated operator guidance message.
- `docs/runbooks/branch-cleanup.md` has new "Worktree-attached branches" section between "Branches with live upstream" and "Branches with no upstream".
- Phase 3 integration test passes — throwaway worktree's branch correctly identified with worktree marker.
- `git diff main..HEAD --stat` shows exactly 4 modified files.
- `git diff main..HEAD -- .env.example` returns empty.
- `node --check scripts/maintenance/prune-merged-branches.mjs` passes.
- `npm run lint` returns 0 problems.
- `npm run build` completes clean.
- FU-L entry in FOLLOW_UPS.md has RESOLVED suffix + closure paragraph with `#{TBD}`/`{TBD}` placeholders (filled in Phase 6).

## Out of scope

- **`.cjs` script changes** — out of FU-L scope. Will be addressed in FU-F-2 if the worktree logic needs to migrate to the `.cjs` sibling helper.
- **Worktree pruning** (`git worktree prune`) — FU-L only protects branches, doesn't garbage-collect stale worktree records.
- **Auto-detach** of stale worktrees — out of scope. Operator decision (some worktrees may be intentional WIP).
- **`git worktree list` failure recovery beyond logging** — script continues without protection if helper fails. Defensible for XS scope; could be hardened later if needed.

## Rule references

- **Rule 9** — Phase 0 git fetch + branch-off-main gate.
- **Rule 10** — Brief commits to `docs/briefs/` via small docs PR BEFORE CC dispatch.
- **Rule 11** — FU-L body preserved verbatim in RESOLVED block (Surfaced / Mechanism / Proposed fix / Rule 17 dogfood signal / Severity / Sequencing sections all intact).
- **Rule 12** — Hard-stop language used throughout.
- **Rule 14** — `.env.example` not touched.
- **Rule 15** — Phase 6 step 7 origin verification.
- **Rule 16** — Phase 6 fill scope. Seventh canonical application.
- **Rule 17** — Source-verification at authoring time. Five anchors verified against current `c0e4684`. Brief catches gap that FU-K's brief authoring missed — closing the dogfood-loop.
- **Rule 27** — Smoke default waived; Phase 3 integration test substitutes (runtime validation via throwaway worktree).
