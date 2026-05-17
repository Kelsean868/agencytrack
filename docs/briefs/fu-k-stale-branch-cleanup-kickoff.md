# FU-K: Stale local branch cleanup sweep — idempotent script + runbook

**Type:** Implementation PR (LOW severity, housekeeping)
**Shape:** XS. Two new files (`scripts/maintenance/prune-merged-branches.mjs`, `docs/runbooks/branch-cleanup.md`) + Phase 4 docs updates. No source-code touch.
**Reference shape:** Mirrors FU-G script-local README + cleanup script PR (#186, `bd238d2`). Script shape-precedent: `scripts/cleanup/preview-test-data-sweep.mjs`. Runbook shape-precedent: `docs/runbooks/email-troubleshooting.md` and `docs/runbooks/test-data-lifecycle.md`.
**Banking origin:** FU-K banked from PR #190 (2026-05-17, `54c7d1c`). FU-K body lives at `docs/FOLLOW_UPS.md` lines 1777–1785.

---

## Architectural decision (locked at brief authoring time)

**Build the idempotent script with the corrected enumeration mechanism, not the FU-K body's broken prescription.** Justification:

- **FU-K body's prescribed mechanism is operationally broken for AgencyTrack.** The body (line 1781) says: `(1) git branch --merged main to enumerate merged-locally branches.` This works for FF-merge / merge-commit workflows but **silently returns zero candidates under squash-merge** — and AgencyTrack uses squash-merge exclusively. Squash-merge creates a new commit on `main` with a different SHA from the source branch's tip; the source branch is therefore NOT in `main`'s ancestor chain, so `git branch --merged main` doesn't see it. Verified live at brief authoring time: `git branch --merged main` returned only `* main` on a working tree with 16 stale local branches.
- **Corrected enumeration mechanism:** after `git fetch --prune origin`, local branches whose remote-tracking ref has been deleted (via GitHub's `deleteBranchOnMerge`) show as `[origin/X: gone]` in `git for-each-ref --format='%(refname:short) %(upstream:track)'`. Those are the safe-to-sweep candidates. Branches with live upstream refs (open PRs, closed-unmerged PRs, pre-`deleteBranchOnMerge` legacy) are skipped and surfaced for separate manual handling.
- **This is the first canonical Rule 17 application in the wild** during brief drafting (as predicted in PR #192's CONTEXT.md "Next track" text). Per Rule 11, the corrected diagnosis lands in the RESOLVED note when the FU closes — preserving the drift trail.
- **Single script with `--execute` flag, not two separate preview/wipe scripts.** Branch deletion is destructive but reversible (reflog preserves SHA ~30 days). The dry-run-first → `--execute` pattern is sufficient gate; full typed-confirmation prompt (à la `wipe-test-data-sweep.mjs`) is over-engineered for a reversible local-only op.
- **`scripts/maintenance/` as new directory.** `scripts/cleanup/` is semantically adjacent but scoped to test-data cleanup (Firestore + Auth). Repo-state maintenance is a distinct concern and deserves its own subdir; verified at brief authoring time that `scripts/maintenance/` does not yet exist.
- **Out of scope:** stale remote-tracking refs without local counterparts (e.g., `origin/docs/m1-shared-primitives-brief` present on origin per `git branch -r` but no local branch). These require `git push origin --delete` (remote mutation), which is outside FU-K's local-only sweep scope. Runbook documents them as separate manual cleanup.

**Counterargument considered:** keep FU-K body's `git branch --merged main` as the documented mechanism and just add a check. Rejected because the mechanism doesn't work AT ALL under squash-merge — there's no partial fix, only a full replacement.

---

## Source-verified state (at brief authoring time, 2026-05-18)

Each anchor below confirmed at brief authoring time against repo HEAD `0b8c37c` (post-FU-J Phase 6 fill).

- **`git branch --merged main` is broken under squash-merge.** Verified live: output is `* main` only, despite 16 stale local branches present in working tree.
- **`git branch -vv | Select-String ': gone\]'`** is the canonical squash-merge-safe detector. After `git fetch --prune origin`, gone-upstream branches show explicit `[origin/X: gone]` markers.
- **Working tree branch state (captured 2026-05-18):**
  - 16 local branches present total (including `main` and `chore/fu-j-rule-17`).
  - 14 branches expected to show `[gone]` upstream after fetch --prune: `chore/fu-j-rule-17`, `docs/claude-md-methodology-batch-2-brief`, `docs/fu-a-test-agent-password-scrub-brief`, `docs/fu-b-a11y-env-var-consolidation-brief`, `docs/fu-c-super-admin-script-removal-brief`, `docs/fu-d-fu-e-env-example-cleanup-brief`, `docs/fu-g-brief`, `docs/fu-h-brief`, `docs/fu-j-brief`, `docs/fu-react-hooks-closure-brief`, `docs/fu-unitid-index-closure-brief`, `docs/methodology-rule-15-fu-g-fu-h-brief`, `docs/wizard-r2-r5-polish-brief`, `perf/cache-um-agent-uids`.
  - 2 branches with live upstream (skip): `docs/arbitrary-syntax-sweep-brief`, `docs/mobile-fu4-cosmetics-brief`.
  - 1 stale remote-tracking ref without local counterpart: `origin/docs/m1-shared-primitives-brief` — out of scope (remote mutation needed).
- **`scripts/` subdirectories:** `backfill`, `cleanup`, `migrations`, `seed`, `verification`. **No `scripts/maintenance/`** — FU-K creates it.
- **Script shape precedent** at `scripts/cleanup/preview-test-data-sweep.mjs`: JSDoc header (USAGE/MODES/OUTPUT/REQUIREMENTS sections) → ES module imports → `__dir`/`ROOT` resolution via `dirname(fileURLToPath(import.meta.url))` → CLI arg helper → guards with `console.error` + `process.exit(1)` → log helper writing to both stdout and `verification/<name>-<timestamp>.log` → `main().catch()` pattern.
- **Runbook shape precedent** at `docs/runbooks/test-data-lifecycle.md` and `docs/runbooks/email-troubleshooting.md`: H1 title → opening paragraph → numbered/named sections → PowerShell code fences → "Troubleshooting" section at the end.
- **FU-K body** at `docs/FOLLOW_UPS.md` lines 1777–1785 unchanged from banking.
- **FU-G RESOLVED pattern** at `docs/FOLLOW_UPS.md` lines 1694–1713 is the closure shape for FU-K's Phase 4 entry, with one addition: a Rule 11 corrected-diagnosis paragraph preserving the `git branch --merged main` drift trail.
- **`docs/runbooks/`** exists; contains `email-troubleshooting.md` and `test-data-lifecycle.md`. No `branch-cleanup.md` — FU-K creates it.

---

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`
2. `git checkout main && git pull --ff-only origin main`
3. `git log origin/main --oneline -1` — capture verbatim. Expected: this brief's docs PR squash commit (the brief-docs PR landing before this work PR per Rule 10).
4. `git checkout -b chore/fu-k-branch-cleanup`
5. Any failure or drift → **STOP and wait for dispatcher.**

## Phase 1 — re-verify FU-K audit findings (Rule 11 + Rule 17)

1. Read FU-K body at `docs/FOLLOW_UPS.md` lines ~1777–1785. Confirm unchanged from banking. If modified → **STOP and wait for dispatcher.**
2. Verify `scripts/maintenance/` directory does NOT yet exist: `Test-Path scripts/maintenance` returns `False`. If it exists → **STOP and wait for dispatcher.**
3. Verify `docs/runbooks/branch-cleanup.md` does NOT yet exist: `Test-Path docs/runbooks/branch-cleanup.md` returns `False`. If it exists → **STOP and wait for dispatcher.**
4. Read `scripts/cleanup/preview-test-data-sweep.mjs` head (first ~100 lines) to confirm the shape precedent referenced in this brief is still valid (JSDoc, ES imports, `__dir`/`ROOT`, `argValue` helper, log-to-file pattern).
5. Read `docs/runbooks/test-data-lifecycle.md` head (first ~50 lines) to confirm runbook precedent shape.
6. Re-verify the `git branch --merged main` broken-mechanism finding live in the feature worktree:
   ```powershell
   git branch --merged main
   ```
   Expected: returns `main` + the current `chore/fu-k-branch-cleanup` branch only (zero stale candidates, despite stale branches present). If `git branch --merged main` returns the expected stale list (e.g., `chore/fu-j-rule-17` or any other `docs/*-brief` branches) → **STOP and wait for dispatcher.** That would mean either the workflow changed (no longer squash-merging) or the audit finding was wrong; both warrant dispatcher review before proceeding.
7. Confirm `git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads/` lists 14+ branches with `[gone]` markers after `git fetch --prune origin`. Capture the exact stale-candidate list for use in Phase 3 verification. (Note: the list may have grown by 1 if `chore/fu-j-rule-17` was already deleted manually, or by 1 if FU-K's own branch is the new one being created — exact count is informational, not blocking.)
8. If any audit claim has shifted materially → **STOP and wait for dispatcher.**

## Phase 2 — execute

### 2a. Create `scripts/maintenance/prune-merged-branches.mjs`

Create the directory if it doesn't exist (`mkdir scripts/maintenance`). Then create the script with the following content. Match the JSDoc and import-pattern cadence of `scripts/cleanup/preview-test-data-sweep.mjs`.

```javascript
/**
 * Prune merged local branches — FU-K.
 *
 * DRY-RUN by default. Enumerates local branches whose upstream remote-tracking
 * ref has been deleted (the `[gone]` upstream marker) and, with --execute,
 * deletes them via `git branch -D`.
 *
 * USAGE
 *   # Dry run — shows what would be deleted, no changes made
 *   node scripts/maintenance/prune-merged-branches.mjs
 *
 *   # Execute — actually delete the enumerated branches
 *   node scripts/maintenance/prune-merged-branches.mjs --execute
 *
 * MECHANISM
 *   AgencyTrack uses squash-merge. Squash-merge creates a new commit on main
 *   with a different SHA from the source branch's tip; the source branch is
 *   therefore NOT in main's ancestor chain. `git branch --merged main` does
 *   NOT detect squash-merged branches.
 *
 *   The correct detector: after `git fetch --prune origin`, local branches
 *   whose remote-tracking ref has been deleted show as `[origin/X: gone]` in
 *   `git for-each-ref --format='%(refname:short) %(upstream:track)'`. Those
 *   are the safe-to-sweep candidates (their upstream was deleted on origin
 *   via deleteBranchOnMerge after the PR's squash-merge).
 *
 *   Local branches with live upstream refs are SKIPPED (open PRs, closed-
 *   unmerged PRs, or pre-deleteBranchOnMerge legacy branches). Handle
 *   manually — see docs/runbooks/branch-cleanup.md.
 *
 * SAFETY
 *   - DRY-RUN default; --execute required for actual deletion.
 *   - `main` and the current branch are never deleted (hard exclusion).
 *   - Branches with live upstream refs are skipped, not deleted.
 *   - `git branch -D` keeps the deleted SHA in reflog for ~30 days; deletions
 *     are recoverable via `git reflog` + `git branch <name> <sha>`.
 *
 * OUTPUT
 *   Stdout + verification/branch-cleanup-<timestamp>.log
 */

import { spawnSync }          from 'child_process';
import { resolve, dirname }   from 'path';
import { fileURLToPath }      from 'url';
import { mkdirSync, appendFileSync } from 'fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, '../..');

// ── CLI args ──────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const execute = args.includes('--execute');

// ── Log setup ─────────────────────────────────────────────────────────────────

const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const logDir  = resolve(ROOT, 'verification');
mkdirSync(logDir, { recursive: true });
const logPath = resolve(logDir, `branch-cleanup-${ts}.log`);
function log(msg) { console.log(msg); appendFileSync(logPath, msg + '\n'); }

// ── Git helper (spawnSync — avoids shell interpolation of % and quotes) ───────

function git(...gitArgs) {
  const result = spawnSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    const err = new Error(`git ${gitArgs.join(' ')} failed (exit ${result.status})`);
    err.stderr = result.stderr;
    throw err;
  }
  return result.stdout.trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const mode = execute ? 'EXECUTE' : 'DRY RUN';
  log(`\nPrune merged local branches — ${mode}`);
  log('='.repeat(60));

  // Refresh remote-tracking refs (non-fatal if it fails; results may be stale).
  try {
    log('Fetching with prune to refresh remote-tracking refs...');
    git('fetch', '--prune', 'origin');
  } catch (err) {
    log(`⚠ git fetch --prune origin failed: ${(err.stderr || err.message).trim()}`);
    log('  Continuing with possibly-stale remote-tracking refs.');
  }

  const currentBranch = git('rev-parse', '--abbrev-ref', 'HEAD');
  log(`Current branch: ${currentBranch}`);
  log('');

  // Enumerate all local branches with their upstream-tracking status.
  // Format example: "chore/foo|[origin/chore/foo: gone]" or "main|" (no upstream-track).
  const raw   = git('for-each-ref', '--format=%(refname:short)|%(upstream:track)', 'refs/heads/');
  const lines = raw.split('\n').filter(Boolean);

  const stale = []; // upstream marked [gone]
  const live  = []; // upstream exists OR no upstream configured
  for (const line of lines) {
    const [name, track] = line.split('|');
    if (name === 'main' || name === currentBranch) continue;   // hard exclusion
    if (track && track.includes('gone')) {
      stale.push(name);
    } else {
      live.push({ name, track: track || '(no upstream)' });
    }
  }

  // Display sweep candidates.
  log('Local branches with upstream marked [gone] (sweep candidates):');
  if (stale.length === 0) {
    log('  (none)');
  } else {
    stale.forEach((b) => log(`  ${b}`));
  }
  log(`  Total: ${stale.length}`);
  log('');

  // Display live-upstream / no-upstream branches (skipped).
  log('Local branches with live upstream or no upstream (NOT swept):');
  if (live.length === 0) {
    log('  (none)');
  } else {
    live.forEach(({ name, track }) => log(`  ${name}  ${track}`));
    log('  → Investigate separately: open PRs, closed-unmerged PRs, or pre-deleteBranchOnMerge legacy.');
    log('  → See docs/runbooks/branch-cleanup.md for handling guidance.');
  }
  log(`  Total: ${live.length}`);
  log('');

  log('Summary:');
  log(`  Sweep candidates: ${stale.length}`);
  log(`  Skipped:          ${live.length}`);
  log(`  Excluded:         main, current branch (${currentBranch})`);
  log('');

  if (!execute) {
    log('[DRY RUN — no branches deleted]');
    log('Run with --execute to perform the deletion.');
    log(`Log: ${logPath}`);
    return;
  }

  if (stale.length === 0) {
    log('Nothing to delete.');
    log(`Log: ${logPath}`);
    return;
  }

  log('Executing deletions...');
  let ok = 0, fail = 0;
  for (const b of stale) {
    try {
      const result = git('branch', '-D', b);
      log(`  ✓ ${result}`);
      ok++;
    } catch (err) {
      log(`  ✗ ${b}: ${(err.stderr || err.message).trim()}`);
      fail++;
    }
  }

  log('');
  log(`Deletions: ${ok} OK, ${fail} failed.`);
  log(`Log: ${logPath}`);

  if (fail > 0) process.exit(1);
}

main();
```

### 2b. Create `docs/runbooks/branch-cleanup.md`

Match the shape of `docs/runbooks/test-data-lifecycle.md` and `docs/runbooks/email-troubleshooting.md` (H1 title → opening paragraph → numbered/named sections → PowerShell code fences → Troubleshooting at the end).

```markdown
# Branch Cleanup Runbook

Removes stale local branches whose upstream remote-tracking ref has been
deleted by GitHub's `deleteBranchOnMerge` after a squash-merge. Local
branches accumulate indefinitely without this sweep — the remote side is
deleted, but the local copy is not.

**Scope:** local repo only. Does NOT delete remote branches.
**Safety:** dry-run by default. `main` and current branch are never deleted.
**Recovery:** `git branch -D` preserves the deleted SHA in reflog for ~30 days.

---

## Why not `git branch --merged main`?

AgencyTrack uses squash-merge. Squash-merge creates a NEW commit on `main`
with a different SHA from the source branch's tip — so the source branch is
NOT in `main`'s ancestor chain, and `git branch --merged main` does not
detect it.

The correct detector uses the upstream-tracking marker. After
`git fetch --prune origin`, a local branch whose remote-tracking ref has
been deleted shows as `[origin/X: gone]` in `git branch -vv` or in
`git for-each-ref --format='%(refname:short) %(upstream:track)'`. Those are
the safe-to-sweep candidates.

---

## Step 1 — Preview (DRY RUN)

```powershell
node scripts/maintenance/prune-merged-branches.mjs
```

Lists the sweep candidates (gone-upstream branches) and the skipped branches
(live upstream or no upstream). No changes made.

## Step 2 — Execute

```powershell
node scripts/maintenance/prune-merged-branches.mjs --execute
```

Deletes the sweep candidates via `git branch -D`. Output is logged to
`verification/branch-cleanup-<timestamp>.log`.

## Step 3 — Verify

```powershell
git fetch --prune origin
git branch -vv | Select-String ": gone\]"
```

Should return no results (all gone-upstream branches deleted).

---

## Branches with live upstream

If the script reports any local branches under "NOT swept" with a live
upstream ref, investigate them individually:

```powershell
gh pr list --head <branch-name> --state all
```

- **PR is open:** leave the local branch (work-in-progress).
- **PR was closed without merging:** decide whether to keep the local work
  or delete via `git branch -D <branch-name>` manually.
- **No PR exists:** the branch was pushed but never PR'd. Delete the remote
  ref via `git push origin --delete <branch-name>`, then re-run the sweep —
  the local branch will now appear as `[gone]`.

## Branches with no upstream

A local branch with no upstream was never pushed. Delete manually if
abandoned, or push to origin and open a PR.

```powershell
git branch -D <branch-name>           # delete local
# OR
git push -u origin <branch-name>      # push and set upstream
```

## Stale remote-tracking refs (no local counterpart)

If `git branch -r` shows an `origin/X` ref without a corresponding local
branch, it is a remote-only stale branch. The FU-K sweep script does not
touch these (they require remote mutation). Handle manually:

```powershell
gh pr list --head <branch-name> --state all   # check PR state
git push origin --delete <branch-name>         # delete remote branch
```

---

## Troubleshooting

**Script reports zero `[gone]` candidates but I have stale branches**

Run `git fetch --prune origin` manually before the script. The script does
this automatically, but a flaky network or auth re-prompt can leave the
remote-tracking refs stale. If the manual fetch succeeds and the script
still shows zero, the branches' upstream refs may not have been deleted —
check `git branch -vv` and look for any branch missing the `[origin/X: gone]`
marker.

**A branch I want to keep is in the sweep list**

The branch has `[gone]` upstream — either the PR was merged (safe to delete,
the work is on main) or the remote branch was deleted prematurely. To
restore the upstream:

```powershell
git push -u origin <branch-name>
```

Re-run the script; the branch will no longer appear in the sweep list.

**I accidentally deleted a branch I needed**

Recover via reflog:

```powershell
git reflog                            # find the deleted branch's last SHA
git branch <branch-name> <sha>        # recreate the branch at that SHA
```

The reflog retains entries for ~30 days by default.
```

## Phase 3 — verify

1. `git diff --stat HEAD` shows exactly four changed entries: `A scripts/maintenance/prune-merged-branches.mjs`, `A docs/runbooks/branch-cleanup.md`, `M docs/CONTEXT.md`, `M docs/FOLLOW_UPS.md`. Anything else → **STOP and wait for dispatcher.**
2. `git diff main..HEAD -- .env.example` returns empty (Rule 14 carve-out).
3. **Run the script in dry-run mode against the current feature-branch worktree to verify correctness:**
   ```powershell
   node scripts/maintenance/prune-merged-branches.mjs
   ```
   Expected output: header line → `Fetching with prune...` line → `Current branch: chore/fu-k-branch-cleanup` line → list of sweep candidates (~14, matching the Phase 1 capture, possibly minus `chore/fu-j-rule-17` if it was deleted manually, possibly plus other branches that have been completed since brief authoring) → list of skipped branches (≥ 2: `docs/arbitrary-syntax-sweep-brief`, `docs/mobile-fu4-cosmetics-brief`) → summary → `[DRY RUN]` footer.
   
   **Do NOT run with --execute in Phase 3.** Execute mode is the operator's choice, not part of acceptance criteria. The dry-run alone confirms the script works.
4. Capture the dry-run output verbatim — it will be referenced in the Phase 5 report.
5. Read both new files end-to-end:
   - `scripts/maintenance/prune-merged-branches.mjs`: confirm JSDoc, imports, `__dir`/`ROOT`, `git()` spawnSync helper, sweep enumeration, deletion loop, dry-run + execute paths.
   - `docs/runbooks/branch-cleanup.md`: confirm H1 title, "Why not git branch --merged main?" section, three numbered steps, "Branches with live upstream" section, "Stale remote-tracking refs" section, "Troubleshooting" section.
6. Run `npm run lint`. No JSX/source touched; expect 0 problems.
7. Run `npm run build`. No source touched; expect clean.

## Phase 4 — docs placeholder fill (in same commit as Phase 2)

### 4a. Update FOLLOW_UPS.md FU-K entry

Match the FU-G RESOLVED pattern at FOLLOW_UPS.md lines 1694–1713 with one addition: the Rule 11 corrected-diagnosis paragraph.

1. Update FU-K heading from:
   ```
   ### FU-K — Stale local docs/* and chore/* branch cleanup sweep (LOW, housekeeping, banked 2026-05-17)
   ```
   to:
   ```
   ### FU-K — Stale local docs/* and chore/* branch cleanup sweep (LOW, housekeeping, RESOLVED 2026-05-18)
   ```
2. Preserve the existing body (Surface, Action, Severity, Sequencing) verbatim — this is the drift trail.
3. Append a new closure paragraph after the existing "Sequencing" line:

   ```
   **Resolved in PR #{TBD}** (`{TBD}`, 2026-05-18). Created `scripts/maintenance/prune-merged-branches.mjs` (idempotent, DRY-RUN default, `--execute` to delete) and `docs/runbooks/branch-cleanup.md` (mechanism explanation + three-step runbook + troubleshooting). **Rule 11 corrected diagnosis:** FU-K body's prescribed enumeration mechanism (`git branch --merged main`) is operationally broken under AgencyTrack's squash-merge workflow — squash-merge creates a new commit on main with a different SHA from the source branch's tip, so the source branch is not in main's ancestor chain. Verified live at brief authoring time: `git branch --merged main` returned `* main` only despite 16 stale local branches present. Corrected mechanism: after `git fetch --prune origin`, local branches with `[origin/X: gone]` upstream-tracking marker are the safe sweep candidates. Live-upstream branches (open PRs, closed-unmerged, pre-deleteBranchOnMerge legacy) are skipped. Stale remote-tracking refs without local counterparts are out of scope (remote mutation). First canonical Rule 17 application in the wild during brief drafting — source-verification at authoring time caught the broken mechanism before script implementation.
   ```

### 4b. Add CONTEXT.md recently-shipped row

Match the recently-shipped row format at CONTEXT.md lines 124–130 (`| #N | \`SHA\` | Description |`).

Insert at the top of the recently-shipped table:

```
| #{TBD} | `{TBD}` | FU-K stale local branch cleanup (LOW housekeeping closure): `scripts/maintenance/prune-merged-branches.mjs` (idempotent, dry-run default, `--execute` flag) + `docs/runbooks/branch-cleanup.md`. Rule 11 corrected diagnosis: FU-K body's `git branch --merged main` mechanism is broken under squash-merge; replaced with `[origin/X: gone]` upstream-tracking detection. First canonical Rule 17 application in the wild during brief drafting. |
```

Drop the oldest row if the recently-shipped table exceeds 5 entries.

### 4c. Top-table / "Where we left off" updates are Phase 6 (Rule 16)

Per Rule 16, the post-merge fill cycle handles top-table fields. Do NOT update those in Phase 4.

## Phase 5 — commit, push, open PR

1. `git add scripts/maintenance/prune-merged-branches.mjs docs/runbooks/branch-cleanup.md docs/CONTEXT.md docs/FOLLOW_UPS.md`
2. Commit message: `chore(maintenance): prune-merged-branches script + runbook (FU-K)`
3. `git push -u origin chore/fu-k-branch-cleanup`
4. Open PR against main. Title: `chore(maintenance): prune-merged-branches script + runbook (FU-K)`. Body must include:
   - Reference to this brief at `docs/briefs/fu-k-stale-branch-cleanup-kickoff.md`.
   - Link to FOLLOW_UPS.md FU-K entry.
   - Explicit note: "Rule 11 corrected diagnosis: FU-K body's `git branch --merged main` mechanism is broken under squash-merge. Replaced with `[origin/X: gone]` upstream-tracking detection — verified live at brief authoring time. First canonical Rule 17 application in the wild during brief drafting; the corrected mechanism is preserved in the FOLLOW_UPS.md FU-K closure paragraph per Rule 11's drift-trail requirement."
   - Phase 3 dry-run output (verbatim, with branch list redacted/summarized if too long — keep the sweep-candidates count + skipped-branches count, plus the summary footer).
   - Phase 1 findings section, if any divergences from this brief's source-verified state were caught during re-verification.
5. Report PR URL + branch HEAD SHA to dispatcher.

## Phase 6 — post-merge cleanup (fourth canonical Rule 16 application)

Standard sequence per Session Protocol step 9 + § Post-merge local cleanup + Rule 16.

1. `git checkout main && git fetch origin && git pull --ff-only origin main`
2. Capture work PR squash SHA: `git log origin/main --oneline -1` — paste verbatim to dispatcher.
3. **Rule 16 fill scope (mandatory):**
   - `docs/CONTEXT.md` recently-shipped row: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
   - `docs/CONTEXT.md` top-table `Current main HEAD` → the work PR's squash SHA (per Rule 16 — anchors on work-PR squash, NOT fill commit).
   - `docs/CONTEXT.md` top-table `Active track` → "FU-K stale branch cleanup shipped (PR #{N}, squash {SHA}). Session A (FU-J + FU-K batched) complete."
   - `docs/CONTEXT.md` top-table `Next track` → "(queue clear) — close-out for the session. Session B backlog: FU-F dedicated session (~30 files, 5 parser patterns), FU-I post-pilot. Stale-row sweep FU candidate: FU-H FOLLOW_UPS.md missing RESOLVED footer."
   - `docs/CONTEXT.md` top-table `Where we left off` → updated prose covering the FU-J + FU-K batched session arc, Rule 17 canonized + first applied in FU-K brief drafting (the corrected-diagnosis story), and any remaining open items.
   - `docs/CONTEXT.md` top-table `Last updated` → ISO date of fill commit (e.g., `2026-05-18`).
   - `docs/FOLLOW_UPS.md` FU-K closure paragraph: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
4. `git add docs/CONTEXT.md docs/FOLLOW_UPS.md`
5. Commit: `docs: fill PR #{N} placeholders (FU-K closure) — fourth Rule 16 application`
6. `git push origin main`
7. **Rule 15 verification (mandatory, unchanged):**
   - `git fetch origin && git log origin/main --oneline -1` — paste verbatim.
   - `git rev-parse HEAD && git rev-parse origin/main` — paste verbatim.
   - Confirm: local HEAD == origin/main, subject matches the fill commit, work PR squash SHA sits directly below.
   - Report "pushed and verified" with all SHAs visible.
   - Any mismatch → **STOP and wait for dispatcher.** Hard-stop.
8. Worktree cleanup: the just-created `chore/fu-k-branch-cleanup` branch can now be cleaned by running the just-shipped script with `--execute` — but that's an operator-driven decision, not part of Phase 6 autonomous scope. Do NOT run the script with `--execute` during Phase 6.

---

## Acceptance criteria

- `scripts/maintenance/prune-merged-branches.mjs` exists with the JSDoc + ES imports + `__dir`/`ROOT` + spawnSync `git()` helper + dry-run/execute paths matching the Phase 2a spec.
- `docs/runbooks/branch-cleanup.md` exists with the H1 + "Why not git branch --merged main?" section + three numbered steps + "Branches with live upstream" + "Stale remote-tracking refs" + Troubleshooting matching the Phase 2b spec.
- Phase 3 dry-run executes cleanly (no exceptions, `[DRY RUN]` footer reached, candidate count ≥ 1).
- `git diff main..HEAD --stat` shows exactly 4 entries: 2 added (script + runbook), 2 modified (CONTEXT.md + FOLLOW_UPS.md).
- `git diff main..HEAD -- .env.example` returns empty.
- `npm run lint` returns 0 problems.
- `npm run build` completes clean.
- Phase 6 post-merge fill executes Rule 16 successfully — all five top-table fields updated; recently-shipped row + FOLLOW_UPS FU-K closure placeholders all filled.

## Out of scope

- **Stale remote-tracking refs without local counterparts** (e.g., `origin/docs/m1-shared-primitives-brief` per pre-flight `git branch -r`). Require `git push origin --delete` (remote mutation). Documented in runbook for manual handling.
- **Local branches with live upstream refs** (`docs/arbitrary-syntax-sweep-brief`, `docs/mobile-fu4-cosmetics-brief` as of brief authoring). Script intentionally skips them; runbook documents investigation path.
- **FU-H FOLLOW_UPS.md missing RESOLVED footer** (lines ~1735–1750) — stale-row drift from PR #188 Phase 6. Separate stale-row sweep PR candidate; do NOT absorb.
- **Untracked legacy briefs + verification scripts** in working tree (~14 files) — covered by separate 2026-05-13 banked FU.
- **Running the script with `--execute`** — operator decision, not part of Phase 3 or Phase 6 autonomous scope.

## Rule references

- **Rule 9** — Phase 0 git fetch + branch-off-main gate.
- **Rule 10** — This brief commits to `docs/briefs/` via a small docs PR BEFORE CC dispatch.
- **Rule 11** — FU-K body's `git branch --merged main` mechanism was source-verified at brief authoring time and found broken under squash-merge. Corrected diagnosis lands in the RESOLVED closure paragraph per Rule 11's drift-trail requirement.
- **Rule 12** — Hard-stop language used throughout.
- **Rule 14** — `.env.example` not touched (Rule 14 carve-out — this is a script-only PR, no credential read sites).
- **Rule 15** — Phase 6 step 7 origin verification.
- **Rule 16** — Phase 6 fill scope. This PR's Phase 6 is the fourth canonical Rule 16 application.
- **Rule 17 (this PR's first canonical application in the wild)** — source-verification at brief authoring time caught the `git branch --merged main` broken mechanism BEFORE script implementation. Six source-verified anchors enumerated in this brief's "Source-verified state" section. Phase 1 re-verifies the live state under feature-branch worktree as the safety net.
