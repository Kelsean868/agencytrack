# CTX-SPLIT - Verify the CLAUDE.md progressive-disclosure split - kickoff brief

**Status:** Docs-only verification. No implementation, no merge, no push.
**Model:** Opus 5, high effort.
**Estimated CC effort:** under 1 session. No PR - the commit already exists.
**Two-strike counter:** 0/2 (fresh session).
**Project carry-in:** 0/2 (clean state).

---

## Context

`CLAUDE.md` was restructured from 926 lines / 110,717 bytes into a 689-line
router plus nine `docs/agents/` reference files, applying progressive
disclosure so that specialised knowledge loads on demand rather than being
injected into every session. Always-loaded context drops from roughly 27,700
tokens to roughly 13,900.

The commit is `c8a6e916` on branch `docs/claude-md-progressive-disclosure`,
parent `c20e6288` (= `main`).

**The reason this brief exists:** the new file was authored outside this repo,
in a single pass, and no human has read all 689 lines. The claim is that
nothing binding was lost - 281 lines reproduced verbatim inline, 527 carried
into `docs/agents/`, 49 deleted as historical or dead, zero unplaced. That
claim is what you are checking.

Ground truth for every comparison is the pre-split file:

```
git show c20e6288:CLAUDE.md
```

Do not treat the new `CLAUDE.md` as authoritative about its own contents.

---

## Phase 1 - Sync

```
git fetch origin
git checkout docs/claude-md-progressive-disclosure
git log --oneline -2
```

Confirm HEAD is `c8a6e916` and its parent is `c20e6288`. If either differs,
STOP and report - the branch has moved since this brief was written.

---

## Phase 2 - Citation integrity

The methodology rules are cited by number throughout the file. Before the
split there were 42 `Rule N` citations across 12 distinct rules (Rule 16 x7,
Rule 10 x6, Rule 4 x5, Rule 17 x5, Rules 9 and 11 x4 each). The split keeps
each rule's number, name and binding sentence inline precisely so these
still resolve.

Produce a table: every `Rule N` citation in the new `CLAUDE.md`, the line it
appears on, and whether Rule N is present in the inline index.

Also confirm the "Rule 4" naming collision is still called out - some briefs
use "Rule 4" as shorthand for post-merge fill, which collides with the real
Rule 4 (env-listing safety).

---

## Phase 3 - Router integrity

For every `docs/agents/` path referenced from the router table or from any
inline sentinel line, report the path and a yes/no on whether the file exists.

Note that `docs/agents/` already contained `issue-tracker.md`,
`triage-labels.md` and `domain.md` before this change - those references must
still resolve too.

---

## Phase 4 - Binding-force audit

This is the substantive phase. For each section of `c20e6288:CLAUDE.md`,
determine whether any text that was **binding** - an instruction, prohibition,
gate or hard stop - now appears only as **description**, either inline or in a
`docs/agents/` file.

Report each as a side-by-side quote: the original wording, the new wording,
and which file the new wording lives in.

Pay particular attention to the blocks that were required to survive
byte-identical:

- the production-Firebase-preview prohibition (original line 24)
- the green channel (original lines 25-29), including
  `gh pr merge --admin is forbidden in all circumstances`,
  `CC NEVER self-promotes`, and the two-consecutive-auto-reverts HALT
- the key-removal ordering (original lines 64-69)
- the worktree junction HARD STOP (original lines 766-770)
- Linked Agent System v3 non-negotiables, including #12
- Rules 22, 23, 24, 25

For each, state whether it is byte-identical to the original or not.

---

## Phase 5 - Coverage audit

Report any content in `c20e6288:CLAUDE.md` that appears in neither the new
`CLAUDE.md` nor any `docs/agents/` file and is **not** on this deletion list:

- `## Build Phase History` (live rows were folded into `## Current Phase` -
  confirm Track D PARTIAL, Pilot Prep IN FLIGHT, P9 Planned and P10 Deferred
  all survived)
- `## Track A - Historical Items (all resolved)`
- the PR-1 / PR-2 / PR-3 status blockquote under `## Roles & Permissions`
- Session Protocol steps 1 and 3
- the stale "Methodology Rules 1-18" clause under `## Dispatcher tooling`
- the duplicated smoke mandate (original lines 772 and 774)
- the line-764 restatement of Rules 11 and 17

---

## Phase 6 - Report

Deliver Phases 2-5 as four explicit lists, empty where nothing was found.
Do not summarise them into prose.

**Evidence paste-back**, verbatim, at the end of the report:

```
git log --oneline -2
git show --stat HEAD
```

---

## Hard stops

- **Do not merge. Do not push.** Rule 19 applies - this branch is for human
  review.
- **Do not edit `CLAUDE.md` or any `docs/agents/` file.** Report findings; the
  fixes are a separate dispatch. Rule 25 also applies: CLAUDE.md edits batch
  at session boundaries.
- If Phase 4 finds a binding instruction that lost its force, that is a STOP -
  report it immediately rather than continuing to Phase 5.

---

## Known and intentional - do not report as defects

- **Session Protocol numbering has gaps at 1 and 3.** Rules 15 and 16 cite
  "step 9" and "step 9.5" by number; renumbering after the deletions would
  have broken those citations.
- **The Rules 1-25 index is 16.9 KB, not the 9 KB originally estimated.**
  Rules 3, 12, 16, 17, 18 and 21 each carry an enumerated list that is itself
  the deliverable - the two halt phrases, the five CONTEXT.md fill fields, the
  seven authoring-time checks, the three checklist bullets, the disposition
  taxonomy, the two bot API logins. Compressing those would have destroyed
  binding content.
- **Line counts are not comparable to the original.** The original averaged
  120 bytes/line; the rewrite wraps at ~90 characters. Bytes are the honest
  metric.

---

## Out of scope

- Consolidating the twelve verification gates. Three pairs overlap
  (Rules 15 / Session Protocol 9.5 / Rule 16 all govern the same post-merge
  push; Rules 11 and 17 are general-and-special case; Rules 2 and 6 both
  mandate Phase-1 enumeration). Flag them if you like, but changing them is a
  separate decision.
- Narrowing Rule 24's scope.
- Moving Linked Agent System v3 out to `docs/agents/`. It was kept inline
  deliberately.

---

## What success looks like

Four lists, a byte-identity verdict on each of the seven protected blocks, and
the evidence paste-back. If all four lists are empty, the split is clean and
the branch is ready for a human merge decision.
