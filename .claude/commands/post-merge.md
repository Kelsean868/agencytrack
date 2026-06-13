---
description: Run the canonical post-merge sequence after dispatcher confirms PR squash-merge.
argument-hint: <pr-number>
---

Post-merge sequence — PR #$ARGUMENTS just squash-merged.

Execute the canonical sequence (CLAUDE.md Session Protocol step 9 + § Post-merge local cleanup):

1. **Phase 0 gate** — if not on main, `git checkout main` first.
2. **Sync main** — `git fetch --prune origin && git pull origin main`.
3. **Graph refresh** — run `graphify update .` using the interpreter at `graphify-out/.graphify_python`. If it errors requiring an API key/backend (cluster labeling), fall back to `graphify update . --no-cluster` and note the fallback in the fill commit message. Stage any resulting `graphify-out/` changes (`git add graphify-out/`) so they ride the placeholder-fill commit.
4. **Capture squash SHA** — `git log origin/main --oneline -1`. Capture the SHA and the PR number from the merge commit subject.
5. **Fill placeholders** — replace `#TBD` and `{TBD}` markers in `docs/CONTEXT.md` and `docs/FOLLOW_UPS.md` (and any other docs the work PR added placeholders to, e.g. `docs/CLAUDE.md` Banked trailers) with the captured PR number and SHA.
6. **Commit** directly to main with message: `docs: post-merge fill for PR #<n>`. Include staged `graphify-out/` changes from step 3 if any.
7. **Push** to main.
8. **Rule 15 verification (mandatory)** — `git fetch origin && git log origin/main --oneline -1`. Confirm the SHA matches `git rev-parse HEAD` on local main. Report explicit "pushed and verified — SHA <sha>".
9. **Optional cleanup** — per banked squash-merge stale-branch detection: `git fetch --prune origin`, then sweep branches in `[origin/X: gone]` state (skip worktree-attached branches via `git worktree list --porcelain`, skip live-upstream branches).
10. **Summary report** — squash SHA, placeholder-fill commit SHA, verification status, any cleanup actions taken, and known gaps (Rule 22).

## Stop conditions

- **Rule 15 SHA mismatch** between local main HEAD and origin/main after push: STOP and wait for dispatcher. Do NOT retry, amend, or exit the sequence.
- **Placeholder fill ambiguity** — if multiple PRs' worth of `#TBD`/`{TBD}` markers are present and it's not clear which belong to this PR: STOP and wait for dispatcher.
- **Merge commit not found** — if `git log origin/main` does not show the expected PR # in the most recent commit: STOP and wait for dispatcher (likely merge has not completed or operator confirmed prematurely).

Hard-stop phrasing in summary uses the literal "STOP and wait for dispatcher" per Rule 12.
