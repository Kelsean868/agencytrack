# `/land-brief` skill — Kickoff brief

- **Status:** FINAL — decisions locked (keep Rule 10's separate-docs-PR model; automate the landing as a slash command).
- **Channel:** HUMAN-MERGE + pre-review (touches CLAUDE.md).
- **Scope class:** Tooling + docs. New `.claude/commands/land-brief.md` slash command + two small CLAUDE.md notes. No app code.
- **Smoke:** WAIVED per Rule 9 (pure tooling/docs). Justified inline in the PR body; a dry-run sanity check stands in (Phase 3).
- **Branch:** `docs/land-brief-skill-brief` for the brief (bootstrap landing, done manually this once), then `<feature-branch>` off origin/main for the implementation via `/dispatch`.
- **Rules in force:** Rule 10 (unchanged — this skill *executes* it), Rule 12 (halt phrasing), Rule 15, Rule 17, Rule 19, Rule 20.

---

## 0. Why this skill

Rule 10 requires every implementation-PR brief to land via a standalone `docs(briefs)` PR before `/dispatch`. Until now the dispatcher did that landing by hand in PowerShell — the source of the 2026-06-02 worktree / merge-conflict / filename-casing failures (PRs #423/#424 churn before the clean #425). `/land-brief` moves those file ops to CC, which performs them reliably and encodes the hard-won lessons (branch off `origin/main`, never `checkout main`; case-correct rename; stage only the brief). Rule 10's intent is unchanged — the brief still lands as its own docs PR, preserving the brief↔implementation boundary in main's squash history; only the *executor* of the landing changes.

## 1. Proposed `.claude/commands/land-brief.md`

Phase 0 must confirm the skill format against the existing `.claude/commands/dispatch.md` + `post-merge.md` (YAML frontmatter `description:` + `argument-hint:`; body is the prompt; `$ARGUMENTS` interpolates). Create the file with this content, adjusting only to match the verified format:

```
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
```

## 2. CLAUDE.md notes (two small additions)

Phase 0 reads the live CLAUDE.md to confirm current wording/placement before editing.

1. **Rule 10 — append an Execution note** (do not change the rule's mandate):
   > **Execution.** The docs-PR landing is performed by the `/land-brief <topic-slug>` skill — CC creates the docs branch off `origin/main`, moves the brief (+ optional annotation) into `docs/briefs/` / `docs/design/`, and opens the `docs(briefs)` PR. The dispatcher merges it, then `/dispatch`es the merged brief. The separate-docs-PR requirement above is unchanged; only the executor moves from manual dispatcher terminal to CC. Banked from PR #{TBD}.

2. **Rule 17 — append one line** to the source-verification guidance (the repomix-masquerade trap):
   > Aggregated snapshots (e.g. `repomix` output) compress function bodies to `⋮----`; a value seen in such a snapshot is **not** verified source — open the actual file, and never substitute an embedded older brief for a compressed body. (Banked from the 2026-06-02 Daily Capture key-casing catch.)

## 3. Phases

### Phase 0 — Audit (NO writes)
1. Read `.claude/commands/dispatch.md` + `.claude/commands/post-merge.md`; confirm the exact frontmatter + body format `/land-brief` must match. Confirm `.claude/commands/` is the skill directory.
2. Read CLAUDE.md Rule 10 + Rule 17; confirm current wording so the §2 notes append cleanly (don't duplicate existing text).
3. If the skill format or rule wording differs materially from this brief's assumptions → STOP and wait for dispatcher.

### Phase 1 — Author
- Finalize the `.claude/commands/land-brief.md` content (§1), matching the verified format exactly.

### Phase 2 — Write
- Create `.claude/commands/land-brief.md`.
- Apply the two CLAUDE.md notes (§2) at the verified locations, with the `#{TBD}` PR-number placeholder in the Rule 10 trailer.

### Phase 3 — Verify (smoke waived)
- Confirm the markdown parses and the frontmatter matches the sibling commands' shape.
- **Dry-run trace (no writes):** narrate the skill's steps against the current repo state for a hypothetical `$ARGUMENTS=demo-topic` — confirm `git checkout -b docs/demo-topic-brief origin/main` is the branch command (not `checkout main`), the move targets resolve, and the stop conditions are reachable. Do not actually create a branch or move files.
- `npm run lint` / `npm run build` if either touches `.claude/` or CLAUDE.md (likely no-op; confirm green regardless).

### Phase 4 — Docs (with placeholders)
- `docs/CONTEXT.md` — Recently-shipped row for the `/land-brief` skill with `#TBD/{TBD}` placeholders + Rule 16 top-of-file refresh.
- `docs/FOLLOW_UPS.md` — none new (skill is self-contained).
- Port ledger — unchanged (not a Track J screen).

### Phase 5 — Commit / push / PR
- Conventional commit on the feature branch; push; `gh pr create` (body: scope, Rule 10-unchanged note, smoke-waiver justification).
- **STOP. Do not merge / deploy (Rule 19).**
- Report PR URL + lint/build + the dry-run trace result + the feature-branch HEAD SHA (Rule 20).

### Phase 6 — Post-merge
- `/post-merge <pr-number>` fills the `#{TBD}` Rule 10 trailer + CONTEXT placeholders, Rule 15 verify.

---

## 4. Acceptance criteria
- `.claude/commands/land-brief.md` exists, matches the sibling slash-command format, and encodes: branch off `origin/main` (never `checkout main`), case-correct annotation rename, stage-only-the-brief, Rule 12 stops, Rule 19 no-merge.
- CLAUDE.md Rule 10 carries the `/land-brief` execution note (mandate unchanged); Rule 17 carries the one-line repomix note.
- Lint/build green; dry-run trace clean; no app code touched.
