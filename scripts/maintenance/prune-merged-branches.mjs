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

  const worktreeBranches = parseWorktreeBranches();
  log(`Worktree-attached branches detected: ${worktreeBranches.size}`);
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
    log('  → Investigate separately: open PRs, closed-unmerged PRs, pre-deleteBranchOnMerge legacy, or worktree-attached.');
    log('  → For worktree-attached entries: `git worktree remove <path>` to detach, then re-run.');
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
