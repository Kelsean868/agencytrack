---
description: Land a kickoff brief (and optional build annotation) via a docs PR per Rule 10, ready for /dispatch.
argument-hint: <topic-slug>
---

Land the kickoff brief for `$ARGUMENTS` via a standalone docs PR (Rule 10). Do NOT implement; do NOT merge (Rule 19).

The brief is in the user's Downloads as `$ARGUMENTS-kickoff.md`. An optional Claude Design annotation may also be there as a single `.html`.

1. `git fetch origin`.
2. Create the docs branch off latest main WITHOUT checking out main (main is worktree-attached): `git checkout -b docs/$ARGUMENTS-brief origin/main`. If the working tree is dirty in a way that blocks the branch cut, STOP and wait for dispatcher.
3. Move the brief: `~/Downloads/$ARGUMENTS-kickoff.md` -> `docs/briefs/$ARGUMENTS-kickoff.md`. If it is not in Downloads, STOP and wait for dispatcher.
4. Annotation (only if present): if exactly one matching `.html` is in Downloads, move it to `docs/design/<kebab-name>.html`. On Windows perform a two-step rename (to a temp name, then to the target) so a case-only change actually takes. If multiple ambiguous `.html` files are present, STOP and wait for dispatcher.
5. Stage ONLY those file(s): `git add docs/briefs/$ARGUMENTS-kickoff.md [docs/design/<kebab>.html]`. Never stage stray untracked artifacts.
6. Commit: `docs(briefs): $ARGUMENTS kickoff` (append ` + build annotation` if one was moved).
7. `git push -u origin docs/$ARGUMENTS-brief`.
8. `gh pr create --base main --head docs/$ARGUMENTS-brief --title "docs(briefs): $ARGUMENTS kickoff[ + build annotation]" --body "<one-line scope>"`.
9. Report the docs PR URL and the landed brief path (`docs/briefs/$ARGUMENTS-kickoff.md`) so the dispatcher can `/dispatch` it after merge.

Hard-stop phrasing uses the literal "STOP and wait for dispatcher" (Rule 12). Open the PR; do not merge (Rule 19).
