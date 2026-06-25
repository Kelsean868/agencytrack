---
description: Run the canonical post-merge sequence after dispatcher confirms PR squash-merge.
argument-hint: <pr-number>
model: sonnet
---

Post-merge sequence â€” PR #$ARGUMENTS just squash-merged.

Execute the canonical sequence (CLAUDE.md Session Protocol step 9 + Â§ Post-merge local cleanup):

1. **Phase 0 gate** â€” if not on main, `git checkout main` first.
2. **Sync main** â€” `git fetch --prune origin && git pull origin main`.
3. **Graph refresh** â€” run `graphify update .` using the interpreter at `graphify-out/.graphify_python`. If it errors requiring an API key/backend (cluster labeling), fall back to `graphify update . --no-cluster` and note the fallback in the fill commit message. Stage any resulting `graphify-out/` changes (`git add graphify-out/`) so they ride the placeholder-fill commit.
4. **Capture squash SHA** â€” `git log origin/main --oneline -1`. Capture the SHA and the PR number from the merge commit subject.
5. **Fill placeholders** â€” replace `#TBD` and `{TBD}` markers in `docs/CONTEXT.md` and `docs/FOLLOW_UPS.md` (and any other docs the work PR added placeholders to, e.g. `docs/CLAUDE.md` Banked trailers) with the captured PR number and SHA.
6. **Commit** directly to main with message: `docs: post-merge fill for PR #<n>`. Include staged `graphify-out/` changes from step 3 if any.
7. **Push** to main.
8. **Rule 15 verification (mandatory)** â€” `git fetch origin && git log origin/main --oneline -1`. Confirm the SHA matches `git rev-parse HEAD` on local main. Report explicit "pushed and verified â€” SHA <sha>".
9. **Optional cleanup** â€” per banked squash-merge stale-branch detection: `git fetch --prune origin`, then sweep branches in `[origin/X: gone]` state (skip worktree-attached branches via `git worktree list --porcelain`, skip live-upstream branches).
10. **Re-poll both bot reviewers (Rule 21 backstop)** â€” Check for reviews/comments that landed after the pre-merge window. Poll both: (a) `gh pr view <pr> --json reviews` for `gemini-code-assist` entries; (b) `gh pr view <pr> --json comments` for `github-actions` entries (NO `[bot]` suffix â€” that's the display name, not the API login) whose body starts with `"## ðŸ¤–"` (GLM). Disposition any not-yet-covered comments under the Rule 21 taxonomy: IMPLEMENT-worthy comments become a follow-up PR or banked FU (the PR is already merged â€” no in-PR fix); DISAGREE â†’ recorded in summary; OUT-OF-SCOPE â†’ banked as FU; ALREADY-RESOLVED â†’ noted; OBSOLETE â†’ noted.
11. **Summary report** â€” squash SHA, placeholder-fill commit SHA, verification status, any cleanup actions taken, bot reviewer backstop result (late reviews dispositioned, or "absent after re-poll" per reviewer), and known gaps (Rule 22).

## Stop conditions

- **Rule 15 SHA mismatch** between local main HEAD and origin/main after push: STOP and wait for dispatcher. Do NOT retry, amend, or exit the sequence.
- **Placeholder fill ambiguity** â€” if multiple PRs' worth of `#TBD`/`{TBD}` markers are present and it's not clear which belong to this PR: STOP and wait for dispatcher.
- **Merge commit not found** â€” if `git log origin/main` does not show the expected PR # in the most recent commit: STOP and wait for dispatcher (likely merge has not completed or operator confirmed prematurely).

Hard-stop phrasing in summary uses the literal "STOP and wait for dispatcher" per Rule 12.

