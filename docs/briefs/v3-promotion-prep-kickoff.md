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

Once this merges, the promotion is Kyron's and runs in this order:

1. Confirm no open PR is based on `staging` (claim 3).
2. Merge `staging` into `main` as a **merge commit**, not a squash.
3. **Immediately** `git push origin main:staging` to recreate the branch. This is the
   banked fix for the recurring deletion; it has failed twice without it.
4. Acceptance, one command:
   `git ls-tree origin/main -- src/test-utils/flushPendingEffects.js`
   A blob means `main`'s gate is finally trustworthy. Empty means the promotion did not
   carry the flake fix and something is wrong.

---

## NOT in scope

The promotion merge itself. Any `src/`, rules or functions change. Resolving the six stale
PRs. The `tmp/` gitignore divergence. Anything in P0-F.
