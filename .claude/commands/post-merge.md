---
description: Run the canonical post-merge sequence after dispatcher confirms PR squash-merge.
argument-hint: <pr-number>
model: sonnet
---

Post-merge sequence - PR #$ARGUMENTS just squash-merged.

Execute the canonical sequence (CLAUDE.md Session Protocol step 9 + Post-merge local cleanup):

0. **Resolve the TARGET BRANCH first - every step below uses it, none assume `main`.**
   ```
   gh pr view <pr> --json baseRefName,mergeCommit,state
   ```
   `TARGET = baseRefName`. **THE FILL FOLLOWS THE MERGE BASE**: a `main`-merge fills `main`, a
   `staging`-merge fills `staging`. Mechanical, no judgement per PR.

   **Why, so it survives being re-litigated:** `CONTEXT.md` exists to tell someone resuming the
   truth about current work. When work is on `staging` and the next session branches from
   `staging`, filling only `main` leaves the branch people actually read describing an older
   world - which is how the drift #901 had to fix got there in the first place. Divergence
   self-heals at promotion, because `staging` is ahead and its version wins.

   If `state` is not `MERGED`, or `mergeCommit` is null: **STOP and wait for dispatcher** (the
   merge has not completed, or it was confirmed prematurely).

1. **Phase 0 gate** - if not on `TARGET`, `git checkout <TARGET>` first.
2. **Sync TARGET** - `git fetch --prune origin && git pull origin <TARGET>`.
3. **Graph refresh** - run `graphify update .` using the interpreter at `graphify-out/.graphify_python`. If it errors requiring an API key/backend (cluster labeling), fall back to `graphify update . --no-cluster` and note the fallback in the fill commit message. Stage any resulting `graphify-out/` changes (`git add graphify-out/`) so they ride the placeholder-fill commit.
4. **Capture squash SHA** - `git log origin/<TARGET> --oneline -1`. Capture the SHA and the PR number from the merge commit subject. If that commit does not carry the expected PR number: **STOP and wait for dispatcher**.
5. **Fill placeholders** - replace `#TBD` and `{TBD}` markers in `docs/CONTEXT.md` and `docs/FOLLOW_UPS.md` (and any other docs the work PR added placeholders to, e.g. `docs/CLAUDE.md` Banked trailers) with the captured PR number and SHA. Fill the Rule 16 fields on the **`TARGET` copy** of those files.

   **`Current main HEAD` is the ONE exception, and it needs no judgement: update it ONLY when
   `TARGET == main`.** It means what it says. On a `staging` fill it stays put - correctly,
   because `main` has not moved - and it archives nothing that cycle. Every other Rule 16 field
   (`Recently shipped`, `Active track`, `Last updated`, `Where we left off`) fills on whichever
   branch was merged to, under its normal cap, with overflow to `docs/CONTEXT-history.md`
   verbatim.
6. **Commit** with message: `docs: post-merge fill for PR #<n>`. Include staged `graphify-out/` changes from step 3 if any. **Direct-to-branch is the norm for `main`.** For any other `TARGET`, follow whatever push policy that branch carries - if it is protected or the dispatcher's convention is PR-only, open a small docs PR against `TARGET` and HOLD rather than pushing directly.
7. **Push** to `TARGET`.
8. **Rule 15 verification (mandatory)** - `git fetch origin && git log origin/<TARGET> --oneline -1`. Confirm the SHA matches `git rev-parse HEAD` on local `TARGET`. Report explicit "pushed and verified - SHA <sha>". *(If step 6 routed through a PR, Rule 15 applies to that PR's merge, not to this run - say so explicitly rather than reporting a verification that did not happen.)*
9. **Worktree reclaim (MANDATORY, not optional)** - the merged PR's head branch almost always has a worktree, and leaving it behind is the single most repeated miss in this sequence: **every merge in the 2026-08-14 session left one, and the count only came down because the operator noticed each time.** A habit that depends on someone remembering is not a check. Do this every cycle, without being asked:

   1. Resolve the PR's head branch and look it up in `git worktree list --porcelain`.
   2. **If it has no worktree** - nothing to reclaim; go to the branch sweep below.
   3. **If the worktree is DIRTY** (`git -C <path> status --porcelain` non-empty - **the FULL status, including untracked**) - **leave it, and report it**, naming the paths. Never remove a worktree with tracked changes, and never `--force` past untracked ones: several worktrees hold untracked work.

      ⚠ **Use the full `--porcelain`, NOT `--untracked-files=no`.** The first version of this
      step checked tracked changes only, and failed on its own first case (#902): the
      worktree reported clean, then `git worktree remove` refused with *"contains modified
      or untracked files"*. `git worktree remove` gates on untracked files too, so the check
      must match what git actually enforces or it reports CLEAN and then cannot proceed.

      ⚠ **`tmp/` is gitignored on `staging` but NOT on `main`.** That divergence is why the
      gap stayed hidden: every earlier reclaim was a `staging`-based worktree where scratch
      under `tmp/` was invisible, and the first `main`-based worktree tripped on it. **Write
      scratch — PR bodies, notes, logs — to the session scratchpad, never inside the
      worktree**, and this cannot recur regardless of which branch it is cut from.
   4. **If the worktree is CLEAN** - remove it, then delete the local branch:
      - **JUNCTION SAFETY FIRST.** Worktrees are routinely given a `node_modules` **junction** pointing at the main worktree's real tree. A recursive delete that follows it destroys the SHARED tree, silently and unrecoverably. Confirm the reparse point, then unlink it without following:
        ```powershell
        $j = "<worktree>\node_modules"
        if (Test-Path $j) {
          if (-not ((Get-Item $j -Force).Attributes -match 'ReparsePoint')) { throw "NOT a junction - HARD STOP" }
          [System.IO.Directory]::Delete($j, $false)   # removes the link, never the target
        }
        ```
        `cmd /c rmdir` also works but may be intercepted by a path guard (it parses `/c` as a path), so prefer the .NET call.
      - **Verify the shared tree is unchanged** - count `C:\Projects\AgencyTrack\node_modules` entries before and after, and confirm a known package still resolves. A mismatch is a **HARD STOP**, not a warning to proceed past.
      - Then `git worktree remove <path>`, then `git branch -D <branch>` (force: with `deleteBranchOnMerge`, the remote tracking ref is already pruned so `-d` cannot verify merge status).
   5. **Never `git clean` anywhere**, and **never touch a worktree other than the merged PR's own** - several hold untracked work and at least one has no upstream at all.

   Then the branch sweep: `git fetch --prune origin`, and sweep branches in `[origin/X: gone]` state (skip worktree-attached branches via `git worktree list --porcelain`, skip live-upstream branches). Report `[gone]` branches you did not action rather than removing them silently.
10. **Re-poll both bot reviewers (Rule 21 backstop)** - Check for reviews/comments that landed after the pre-merge window. Poll both: (a) `gh pr view <pr> --json reviews` for `gemini-code-assist` entries AND `coderabbitai` entries (NO `[bot]` suffix - that's the display name, not the API login); (b) `gh pr view <pr> --json comments` for `coderabbitai` entries (CodeRabbit posts a summary comment in addition to its review). Disposition any not-yet-covered comments under the Rule 21 taxonomy: IMPLEMENT-worthy comments become a follow-up PR or banked FU (the PR is already merged - no in-PR fix); DISAGREE -> recorded in summary; OUT-OF-SCOPE -> banked as FU; ALREADY-RESOLVED -> noted; OBSOLETE -> noted.
11. **Summary report** - **the resolved `TARGET` branch and why (step 0)**, squash SHA, placeholder-fill commit SHA, verification status, **worktree reclaim outcome (removed / left-dirty-and-why / none existed) plus the shared-`node_modules` before-and-after counts**, any other cleanup actions taken, bot reviewer backstop result (late reviews dispositioned, or "absent after re-poll" per reviewer), and known gaps (Rule 22).

## Stop conditions

- **Rule 15 SHA mismatch** between local `TARGET` HEAD and `origin/<TARGET>` after push: STOP and wait for dispatcher. Do NOT retry, amend, or exit the sequence.
- **Placeholder fill ambiguity** - if multiple PRs' worth of `#TBD`/`{TBD}` markers are present and it's not clear which belong to this PR: STOP and wait for dispatcher.
- **Merge commit not found** - if `git log origin/<TARGET>` does not show the expected PR # in the most recent commit: STOP and wait for dispatcher (likely merge has not completed or operator confirmed prematurely). **Check `origin/<TARGET>`, not `origin/main`** - a `staging`-merged PR is correctly absent from `main`, and reading that absence as "merge not found" is a false stop. That is exactly what happened on #904, which is why step 0 exists.

Hard-stop phrasing in summary uses the literal "STOP and wait for dispatcher" per Rule 12.
