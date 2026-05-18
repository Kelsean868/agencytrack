---
description: Run the canonical post-merge sequence after dispatcher confirms PR squash-merge.
argument-hint: <pr-number>
---

Post-merge sequence — PR #$ARGUMENTS just squash-merged.

Execute the canonical sequence (CLAUDE.md Session Protocol step 9 + § Post-merge local cleanup):

1. **Phase 0 gate** — if not on main, `git checkout main` first.
2. **Sync main** — `git fetch --prune origin && git pull origin main`.
3. **Capture squash SHA** — `git log origin/main --oneline -1`. Capture the SHA and the PR number from the merge commit subject.
4. **Fill placeholders** — replace `#TBD` and `{TBD}` markers in `docs/CONTEXT.md` and `docs/FOLLOW_UPS.md` (and any other docs the work PR added placeholders to, e.g. `docs/CLAUDE.md` Banked trailers) with the captured PR number and SHA.
5. **Commit** directly to main with message: `docs: post-merge fill for PR #<n>`.
6. **Push** to main.
7. **Rule 15 verification (mandatory)** — `git fetch origin && git log origin/main --oneline -1`. Confirm the SHA matches `git rev-parse HEAD` on local main. Report explicit "pushed and verified — SHA <sha>".
8. **Optional cleanup** — per banked squash-merge stale-branch detection: `git fetch --prune origin`, then sweep branches in `[origin/X: gone]` state (skip worktree-attached branches via `git worktree list --porcelain`, skip live-upstream branches).
9. **Summary report** — squash SHA, placeholder-fill commit SHA, verification status, any cleanup actions taken.

## Stop conditions

- **Rule 15 SHA mismatch** between local main HEAD and origin/main after push: STOP and wait for dispatcher. Do NOT retry, amend, or exit the sequence.
- **Placeholder fill ambiguity** — if multiple PRs' worth of `#TBD`/`{TBD}` markers are present and it's not clear which belong to this PR: STOP and wait for dispatcher.
- **Merge commit not found** — if `git log origin/main` does not show the expected PR # in the most recent commit: STOP and wait for dispatcher (likely merge has not completed or operator confirmed prematurely).

Hard-stop phrasing in summary uses the literal "STOP and wait for dispatcher" per Rule 12.
