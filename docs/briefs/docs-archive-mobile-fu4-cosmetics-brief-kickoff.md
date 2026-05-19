# PR brief — Archive orphaned mobile-fu4-cosmetics kickoff brief

**Sized:** XS
**Branch:** `docs/archive-mobile-fu4-cosmetics-brief`
**Type:** Retroactive docs archive. Mirrors PR #211 pattern.

## Outcome

Archive the orphaned 222-line kickoff brief from `origin/docs/mobile-fu4-cosmetics-brief` (tip `9fec5fe`) to `docs/archive/briefs/mobile-fu4-cosmetics-kickoff.md`. Mirrors PR #211's treatment of 9 sibling pre-Rule-10 briefs. After this PR ships, delete the orphaned `docs/mobile-fu4-cosmetics-brief` local and remote refs (Phase 7).

## Decisions locked

1. Path B per CC's investigation report (`2026-05-20`) — preserve brief content for historical methodology reference, consistent with PR #211.
2. Source: `origin/docs/mobile-fu4-cosmetics-brief:docs/briefs/mobile-fu4-cosmetics-kickoff.md` (commit `9fec5fe`).
3. Target: `docs/archive/briefs/mobile-fu4-cosmetics-kickoff.md`.
4. Content preservation: verbatim. No edits, no reformatting, no trailing-whitespace normalization.
5. Branch deletion (Phase 7): both `docs/mobile-fu4-cosmetics-brief` local AND `origin/docs/mobile-fu4-cosmetics-brief` remote refs.

## Out of scope

- Modifying brief content (verbatim preservation)
- Adding the brief to `docs/briefs/` active (it's archived, not active)
- Touching PR #211's already-closed archive FU section
- Reviving the 3 unpushed local commits on the orphaned branch (all 3 preserved on main per audit: `630bac1` is PR #154 squash on main, `1ea1210` is a merge artifact, `f8852b3` is a functional duplicate of `b1fa62c` on main)
- Modifying any methodology rules or sub-bullets
- Searching for additional orphaned briefs (separate sweep if pattern repeats)

## Phase 0 — gate

Standard. STOP on divergence.

## Phase 1 — sanity checks (Rule 17 source-verify + brief-completeness sub-bullets apply)

1. Confirm `docs/archive/briefs/` directory exists and contains the PR #211 archived siblings:
git ls-files docs/archive/briefs/ | Measure-Object -Line
   Expected ≥9 (PR #211 archived 9 briefs). If directory missing or empty, STOP for dispatcher.

2. Confirm `origin/docs/mobile-fu4-cosmetics-brief` still exists at expected tip:
git ls-remote origin docs/mobile-fu4-cosmetics-brief
   Expected: returns `9fec5fe` (or surface the actual tip if different — premise check). If ref gone from origin, STOP for dispatcher.

3. Confirm `docs/archive/briefs/mobile-fu4-cosmetics-kickoff.md` does NOT already exist:
git ls-files | Select-String "archive/briefs/mobile-fu4-cosmetics"
   Expected: zero matches. If exists, STOP for dispatcher (PR redundant).

4. Confirm `docs/briefs/mobile-fu4-cosmetics-kickoff.md` does NOT exist on main (this is the central premise — that the brief never landed):
git ls-files | Select-String "docs/briefs/mobile-fu4-cosmetics"
   Expected: zero matches. If exists on main as active, STOP for dispatcher (audit premise wrong).

5. Read the brief content from origin via:
git show origin/docs/mobile-fu4-cosmetics-brief:docs/briefs/mobile-fu4-cosmetics-kickoff.md
   Capture verbatim. Verify line count matches audit's 222. If significantly different (±10 lines), surface in summary but proceed (line counts aren't load-bearing; content preservation is).

## Phase 2 — edits

### Edit 1 — Write archived brief

Write the content from Phase 1 step 5 verbatim to `docs/archive/briefs/mobile-fu4-cosmetics-kickoff.md`. Use `create_file` (the file does not currently exist). NO content modifications.

### Edit 2 — Update `docs/CONTEXT.md`

Standard top-table + Recently-shipped + Where-we-left-off updates with `#TBD` / `{TBD}` placeholders. Description for Recently-shipped row: "Retroactively archived mobile-fu4-cosmetics kickoff brief (orphaned from pre-Rule-10 era, 222 lines from origin/docs/mobile-fu4-cosmetics-brief tip 9fec5fe) to docs/archive/briefs/. Mirrors PR #211 archive pattern. Branch deletion follow-on in Phase 7."

Active track field: "Archive orphaned mobile-fu4-cosmetics brief — docs/archive-mobile-fu4-cosmetics-brief in flight."
Next track field: "Pending after merge + Phase 7 branch deletion: BEH-1 blocked on copy. Otherwise queue is genuinely empty."

## Phase 3 — verification

1. `npm run lint` → clean.

2. Confirm archived file content matches source exactly:
git diff origin/docs/mobile-fu4-cosmetics-brief:docs/briefs/mobile-fu4-cosmetics-kickoff.md docs/archive/briefs/mobile-fu4-cosmetics-kickoff.md
   Expected: empty diff. If non-empty, STOP for dispatcher.

3. Confirm archive count incremented:
(git ls-files docs/archive/briefs/ | Measure-Object -Line).Lines
   Expected: previous count + 1 (likely 10 if PR #211 archived 9).

## Phase 4 — smoke

**Waived.** Pure docs archive — adds a single historical reference file to an already-established archive directory. No runtime surface, no source code, no Firestore rules.

## Phase 5 — commit, push, open PR

Standard. Commit message:
docs(archive): retroactively archive mobile-fu4-cosmetics kickoff brief
Mirrors PR #211 archive pattern. Brief was authored 2026-05-14 for PR #154
(Mobile FU#4 cosmetics work) but predates Rule 10 — never went through a
brief-PR cycle, so the content lived only on a feature branch
(docs/mobile-fu4-cosmetics-brief, tip 9fec5fe).
PR #211's sweep didn't catch it because PR #211 scoped to untracked files in
main's working tree; this brief existed only as origin remote ref content
plus 3 stale local commits on a worktree-attached branch (since cleaned
up via the Worktree + branch audit closure at 3580e1f).
Content preserved verbatim from origin/docs/mobile-fu4-cosmetics-brief.
Audit confirmed all 3 unpushed local commits on the orphaned branch are
preserved on main via PR #154's squash and the placeholder-fill commit:

630bac1 (PR #154 squash, identical SHA on main)
1ea1210 (local merge artifact, no original content)
f8852b3 (functional duplicate of b1fa62c post-merge fill on main)

Phase 7 (post-merge): delete docs/mobile-fu4-cosmetics-brief local +
remote refs.
Smoke waived: pure docs archive, no runtime surface.

## Phase 6 — held, then Phase 7 branch deletion

Standard `/post-merge` invocation after squash merge. AFTER post-merge sequence completes (commit + push + Rule 15 verify), execute Phase 7 as a final step within the same CC dispatch turn (or as a follow-on inline dispatch if /post-merge slash command doesn't pass through the phase extension):
git branch -D docs/mobile-fu4-cosmetics-brief
git push origin --delete docs/mobile-fu4-cosmetics-brief

Verify both refs gone:
git branch -vv | Select-String "mobile-fu4-cosmetics"
git ls-remote origin docs/mobile-fu4-cosmetics-brief

Both expected: empty / zero matches.

If branch deletion fails, surface — orphan branch references should not persist after the archive lands.
