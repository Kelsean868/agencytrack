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
