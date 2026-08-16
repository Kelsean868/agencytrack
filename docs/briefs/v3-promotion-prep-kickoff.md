# KICKOFF — promotion prep: converge the governance files before merging staging → main

**Dispatched:** 2026-08-16
**run_model:** `claude-opus-5` (a structural reconciliation of the document that governs
every future session; getting it wrong silently deletes rules or undoes a restructure)
**Effort:** high
**Branch:** `docs/promotion-prep-governance` off `origin/staging`
**Merge authority:** NONE. Build to PR-open and HOLD.
**The dispatcher (Kyron) merges, and the promotion merge itself is his alone.**
**Does NOT edit `firestore.rules`, `functions/`, or any `src/` file. Docs only.**

---

## WHY

`staging` is **18 ahead** of `main`; `main` is **16 ahead** of `staging`. This is not a
promotion, it is a reconciliation — 98 files differ.

Most of that is Phase 0 code `main` simply lacks, which merges cleanly. The danger is
concentrated in three files, and one of them is structural:

- **`CLAUDE.md` — 1675 changed lines.** `main` was restructured into a router plus
  `docs/agents/*.md` detail files (`e0ca61b6`). `staging` still carries the monolith —
  and tonight's rules were appended to that monolith: the **burn-freeze** rule and the
  **worktree-reclaim** rule (#895), and the **`userEvent` vs `fireEvent`** principle
  (#899 era). **Those three exist only on `staging`, in a file `main` has replaced.** A
  naive merge either drops them or resurrects the monolith and undoes the restructure.
- **`docs/CONTEXT.md` — 53 lines.** Edited independently on both sides. `main` carries
  fills `c20e6288` and `6bc54978`; `staging` carries the #901 reconciliation and the #905
  P0-G fill. Neither is a superset.
- **`docs/FOLLOW_UPS.md` — 689 lines.** Same problem, larger.

And promotion has a documented recurring failure: **it deletes `staging`, silently
retargeting open PRs onto `main`** — that put #872 and #873 into `main` ungated, and
recurred on #877. The banked fix is a runbook step, `git push origin main:staging`,
immediately after the merge.

**This slice does not promote.** It makes the three governance files the same shape on
both branches, so the promotion that follows is mechanical.

---

## PHASE 0 — RECON (mandatory, before any edit)

Cite `file:line`. If any claim fails, **STOP and wait for dispatcher.**

1. **Enumerate `docs/agents/*.md` on `main`** — every file, and one line on what each
   owns. This is the target structure.
2. **Enumerate exactly which rule blocks exist in `staging`'s `CLAUDE.md` and have no
   equivalent on `main`.** Not a diff dump — a list of distinct rules, each with the PR
   that banked it. My reading is three (burn-freeze, worktree reclaim,
   userEvent-vs-fireEvent) but I have not counted, and I have been wrong about counts
   three times this month. **Verify and correct me.**
3. **Report the base branch of all six open PRs** (#398, #540, #546, #621, #825, #854).
   If any is based on `staging`, it will retarget on deletion — that is the acute risk
   and it changes the promotion order.
4. **Confirm `main`'s branch protection**: FOLLOW_UPS says 2 required checks,
   admin-bypassable, and says `CLAUDE.md` still carries the false claim that `main` has
   none. Report both — the actual setting and the false claim's `file:line`.
5. Report whether `docs/CONTEXT.md`'s divergence is additive on both sides or whether
   either side deleted something the other kept.

---

## 1. `CLAUDE.md` — adopt main's structure on staging

**`main`'s router structure wins.** It is the newer decision and it is the one every
future session will read. Bring it to `staging`, and re-home the staging-only rules into
whichever `docs/agents/*.md` file owns their subject, leaving a router line in `CLAUDE.md`
in the house style.

**Do not paraphrase a rule while moving it.** Move the text, then adjust only what the new
location requires. A rule that changes meaning during a file move is undetectable
afterwards — nobody diffs a move.

If a staging-only rule has no obvious home among the existing `docs/agents/*` files,
**STOP and report** rather than inventing a file or dropping it into the nearest one.

## 2. `CONTEXT.md` and `FOLLOW_UPS.md` — union, never pick

Neither side is a superset, so taking either wholesale loses content.

- Bring `main`'s fills onto `staging`: `c20e6288` and `6bc54978`.
- Keep `staging`'s #901 reconciliation and #905 P0-G fill.
- Honour the Rule 16 caps after merging; overflow to `CONTEXT-history.md` **verbatim**,
  nothing dropped.
- If an entry exists on both sides in different words, keep the more specific one and say
  in the PR body which you dropped and why.

**Report the entry count before and after on both files.** A union that shrinks either
file has lost something.

## 3. Correct the branch-protection claim

Per claim 4, `CLAUDE.md` states `main` has no branch protection and that is false. Correct
it to what claim 4 actually found. A governing document asserting a false fact about the
repo's safety posture is worse than silence.

---

## 4. Deliverables

- One PR to `staging`, docs only.
- **Evidence paste-back — the staging-only rule inventory** from claim 2, with each rule's
  origin PR and its new home.
- **Evidence paste-back — entry counts before and after** on `CONTEXT.md` and
  `FOLLOW_UPS.md`.
- **Evidence paste-back — `git diff --stat origin/main <branch> -- CLAUDE.md
  docs/CONTEXT.md docs/FOLLOW_UPS.md`.** After this slice those three should be *close to
  identical*; whatever remains is the real content delta and must be enumerated, not
  waved at.
- Full gate: lint, suite, build, CI.

## 5. What happens after — NOT this slice, for the record

**REVISED 2026-08-16, after the dry run. The original recipe rested on a conceptual error
and is superseded.**

The error, stated plainly because it is the reusable lesson: this brief told CC to
*minimise the tip-to-tip diff* between `staging` and `main`. **Git does not merge tip
against tip — it merges each side against the MERGE-BASE.** Both branches diverged from a
650-line `CLAUDE.md` at `485360ed`; `main` restructured it into a router plus
`docs/agents/*`, `staging` appended to the monolith. That conflicts whether the tips are
1675 lines apart or 32. The strategy could not have worked, and a shrinking diff was never
evidence that it had.

**Measured, not predicted** (scratch clone, `git merge --no-commit --no-ff`):

| | conflicted files |
|---|---|
| control — `main` ← `staging` | **3** (`CLAUDE.md`, `docs/CONTEXT.md`, `docs/CONTEXT-history.md`) |
| with the prep branch — `main` ← `docs/promotion-prep-governance` | **7** |

The four added conflicts, each with its cause:

- **3 add/add on `docs/agents/`** — `methodology-rules.md`, `release-and-post-merge.md`,
  `test-and-lint-notes.md`. These files are absent from the merge-base, so both sides
  "added" them. The other **six** `docs/agents` files the prep branch copied across do
  **not** conflict — git auto-resolves an identical add/add. Only the three the branch
  *edited* collide.
- **1 new on `docs/FOLLOW_UPS.md`** — in the control this file auto-merges cleanly, both
  sides being append-only in disjoint regions (Rule 7(b) working exactly as designed).
  The prep branch ported `main`'s 46-line addition onto `staging` at `main`'s own anchor,
  so both sides now carry it and it collides.

**So the prep branch RAISES the conflict count, and that is fine.** It is not a
conflict-avoider. **It is the PRE-COMPUTED RESOLUTION** — the correct merged content for
every governance file, worked out under review rather than hand-merged live at the merge
prompt. That is strictly better than an automatic merge would have been: an auto-merge of
`CONTEXT.md` would have resurrected rows #862 / #860 / #858, undoing a correct Rule 16
rotation, which is precisely the defect the Phase 0 claim-5 audit caught.

### The promotion, revised — Kyron's, in this order

**a. Pre-flight.** Confirm `main` has not touched `CLAUDE.md`, `docs/CONTEXT*.md`,
`docs/FOLLOW_UPS.md` or `docs/agents/*` since the prep branch was cut. If it has, the
pre-computed resolution is **stale** — **STOP and wait for dispatcher**; it must be
recomputed before the merge, not patched at the prompt.

```
git fetch origin
git log --oneline <prep-branch-merge-sha>..origin/main -- CLAUDE.md docs/CONTEXT.md docs/CONTEXT-history.md docs/FOLLOW_UPS.md docs/agents/
```

Empty output means the resolution is current.

**b. Merge.** `git merge staging` into `main`, as a **merge commit, not a squash**.
**Expect 7 conflicts. This is normal, not a failure** — do not abort on seeing them.

**c. Resolve.** For each of the 7, take **`staging`'s side wholesale**. It is the union
computed in the prep PR and is a superset of `main`'s content for every one of them:

```
for f in CLAUDE.md docs/CONTEXT.md docs/CONTEXT-history.md docs/FOLLOW_UPS.md \
         docs/agents/methodology-rules.md docs/agents/release-and-post-merge.md \
         docs/agents/test-and-lint-notes.md ; do
  git checkout --theirs -- "$f" && git add -- "$f"
done
```

**d. Verify BEFORE committing the merge.** Both checks, not one:

```
grep -c '#891\|#894\|RULING 18\|Rule 16(b)' docs/CONTEXT.md      # the recovered fills: must be present
grep -E '^\| \[#(862|860|858)\]' docs/CONTEXT.md                 # must return NOTHING
grep -cE '^\| \[#[0-9]+\]' docs/CONTEXT.md                       # must be 5 (Rule 16 cap)
```

A resurrection of #862 / #860 / #858 means step (c) was applied to the wrong side.

**e. Commit the merge. Then IMMEDIATELY `git push origin main:staging`** to recreate the
branch. This is the banked fix for the recurring deletion; it has failed twice without it.

**f. Acceptance.** `git ls-tree origin/main -- src/test-utils/flushPendingEffects.js`

A blob proves **the fix ARRIVED**. It does **not** prove `main`'s gate is clean —
#899 fixed **two** of the flake family's ~10 named members and the rest were deliberately
left unruled. After promotion `main` inherits a gate that is better by two files and still
intermittent; expect occasional reds on inert diffs and re-run to separate flake from
regression. Empty output means the promotion did not carry the fix and something is wrong.

**Dry-run status:** steps (b)–(d) were rehearsed end-to-end in a scratch clone —
7 conflicts, take-theirs on all 7, **0 remaining**, all four recovered facts present,
no resurrection, 5 rows at cap.

---

## NOT in scope

The promotion merge itself. Any `src/`, rules or functions change. Resolving the six stale
PRs. The `tmp/` gitignore divergence. Anything in P0-F.
