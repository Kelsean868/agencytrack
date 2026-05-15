# Kickoff Brief — CLAUDE.md Methodology Batch (Items A–E: indexes deploy + 4 new Methodology rules)

**Type:** Pure docs PR (S size)
**Shape:** HIGH#6 / PR #160 closure pattern
**Strike count opens at:** 0/2
**Smoke:** Waived (pure docs change to `docs/CLAUDE.md`; sets policy for future PRs, no runtime effect)

---

## Audit findings (from CLAUDE.md methodology edit pre-flight audit, 2026-05-15)

CC's audit surfaced 5 banked methodology rules with verified evidence trails and proposed wording. Two items from the methodology queue are deliberately deferred to separate work:

- **Out of scope (deferred):** env-credentials propagation audit (investigative, needs its own deeper audit) and inventory-prose-instability (CONTEXT.md L139 design fix, not a CLAUDE.md rule)

After this PR lands, the methodology-edit-queue drops from 7 → 2 items.

## Decisions locked

1. Wording per Sections below — verbatim
2. Section placement: Item A in Workflow + Commands; Items B/C/D/E as Methodology rules ### 10–13
3. Rule 1 and Rule 3 get surgical cross-reference updates to Rule 12
4. Methodology section header comment line gets a banking-note update for rules 10–13
5. Banking date: 2026-05-15 (if merge slips, dispatcher updates inline)
6. Single PR; no consolidation merging of B/C/D/E
7. Item A scope: indexes only (narrow); no generalization to other deploy surfaces
8. Existing committed briefs grandfathered re: Rule 12 language; rule applies forward only

## Phase 0 — Gate

1. Confirm on `main`, working tree clean. `git fetch origin && git pull origin main`.
2. Create fresh branch off freshly-fetched main: `docs/claude-md-methodology-batch-2`
3. Confirm CLAUDE.md Phase 0 gate checks pass (no uncommitted work, no stale worktree).

## Phase 1 — Locate sources & verify line numbers

1. Read `docs/CLAUDE.md` in full. Confirm:
   - `## Commands` section exists and lists `firebase deploy --only firestore:rules — Deploy Firestore rules` (we'll add an indexes equivalent)
   - `## Workflow — IMPORTANT` has the "Additive Firestore rules / Cloud Functions — deploy from the feature worktree" bullet (we'll insert beside it)
   - `## Workflow — IMPORTANT` has the "Brief drafting from FOLLOW_UPS.md items must verify codebase state first" sub-bullet under "Squash SHA ≠ feature-branch SHA"
   - `## Methodology requirements` section exists with ### 1. through ### 9. and a header comment line about banking dates
   - Methodology Rule 1 and Rule 3 are quotable verbatim
2. Quote the exact current text of every section/line to be modified — preserve in the brief's `Phase 1 findings` capture so Phase 2 edits target precise text.
3. If any section text has drifted from the audit surface (another PR landed between audit and this PR), **STOP and wait for dispatcher** for line-number reconciliation.

## Phase 2 — Apply edits

Order matters — apply in this sequence:

### Step 2.1 — `## Commands`: add indexes deploy command

Add one line in the `## Commands` section beside the existing rules-deploy entry:

```
firebase deploy --only firestore:indexes — Deploy Firestore composite indexes
```

### Step 2.2 — `## Workflow — IMPORTANT`: add Item A bullet

Insert immediately after the existing "Additive Firestore rules / Cloud Functions — deploy from the feature worktree" bullet:

```
- **firestore.indexes.json changes require explicit deploy confirmation.** Adding or modifying a composite index in `firestore.indexes.json` does NOT auto-deploy via Vercel — `firebase deploy --only firestore:indexes` must be run from a worktree authenticated against the production project. Capture the deploy output (or Firebase Console index ID + status) in the PR description before merge. Pre-merge deploy is safe for additive index changes (new composites that don't redefine an existing one); modifications/removals deploy post-merge with the same staging discipline as rules. Verification path: Firebase Console → Firestore Database → Indexes → Composite tab, confirm status `Enabled`. Banked from PR #162 closure audit (composite `(unitId, weekStarting)` deploy state required manual Console verification because no rule existed).
```

### Step 2.3 — `## Workflow — IMPORTANT`: update brief-drafting sub-bullet

Find the "Brief drafting from FOLLOW_UPS.md items must verify codebase state first" sub-bullet under "Squash SHA ≠ feature-branch SHA". Append at end:

```
 (see Methodology Rule 10 for brief commit convention; Rule 11 for FU-body re-audit before first work).
```

### Step 2.4 — `## Methodology requirements`: update header comment line

Find the existing comment line that reads (paraphrase): `(originally 8 from pilot prep 2026-05-14; rule 9 added 2026-05-15 from FU#4 → border-border arc)`.

Replace with:

```
(originally 8 from pilot prep 2026-05-14; rule 9 added 2026-05-15 from FU#4 → border-border arc; rules 10–13 added 2026-05-15 from CLAUDE.md methodology batch — firestore-indexes + brief-discipline arc)
```

### Step 2.5 — `## Methodology requirements`: append Rule 10 (Item B)

```
### 10. Kickoff briefs commit before CC dispatch

Every kickoff brief for an implementation PR (any size — XS, S, M, L, XL — no exception) commits to `docs/briefs/` via a small standalone docs PR BEFORE CC is dispatched against it. The pattern: dispatcher drafts brief → opens `docs(briefs): <topic> kickoff` PR → merges → dispatches CC against the merged brief on a fresh feature branch. This preserves the dispatch-vs-implementation boundary in git history (the brief's authorship and timing is separate from CC's execution) and lets reviewers trace methodology drift across PRs.

Audit-only dispatches stay inline. Pre-flight surface audits, read-only investigations, and any task that produces no source/docs commit do NOT require a committed brief — the chat prompt is the brief.

Banked from May 2026 closure cadence (PRs #161/#162, #163/#164, #165/#166 all followed this pattern).
```

### Step 2.6 — `## Methodology requirements`: append Rule 11 (Item C)

```
### 11. FU body re-audit before first work

When a FU is referenced for first implementation work after any gap (banking-date to dispatch-date), the brief author must verify the FU body's diagnosis claims against current source code BEFORE locking the brief's "Decisions locked" section. Specifically, for any FU body that names:

- a root cause / mechanism (e.g., "regex adjustment", "downstream of bug X", "race condition in handler Y")
- a file:line target
- a suggested fix shape ("just adjust the regex", "wrap in useMemo")

the brief MUST quote the current source at that location and either (a) confirm the FU diagnosis matches reality, or (b) document the corrected diagnosis in the brief's audit-findings section. The corrected diagnosis lands in the RESOLVED note when the FU closes — preserving the drift trail.

Banked from PR #164 (react-hooks Item 2: FU body claimed "downstream of Item 1"; reality was "eslint-disable was vestigial — unused at any baseline") and PR #166 Bug 001 (FU body claimed "regex adjustment only"; reality was navigator off-by-one).
```

### Step 2.7 — `## Methodology requirements`: append Rule 12 (Item D)

```
### 12. Hard-stop language must be unambiguous

Briefs use only two phrases for halt conditions, no synonyms:

- **STOP and wait for dispatcher** — CC halts execution, posts the surface finding to chat, and does NOT proceed until receiving an explicit dispatcher reply. No autonomous next step, no "I'll continue with a defensible path." This is the default for any condition the brief identifies as a stop.
- **STOP IMMEDIATELY** — reserved for data-safety / production-touch / cross-tenant risk (carried from Rule 3). Same halt semantics, escalated visual weight.

Forbidden synonyms: "hard stop and surface", "flag to Kelsean", "note and continue", "surface for review". These are interpretable as either halt-and-wait OR proceed-with-note; the ambiguity caused PR #166's first-turn methodology miss (CC encountered an env-gap stop, rationalized continuation via the smoke waiver, and only halted on the second turn). Brief authors must rewrite any halt condition into one of the two canonical phrases.

Existing committed briefs (pre-banking) are grandfathered. Rule applies to all new briefs from banking date forward.
```

### Step 2.8 — `## Methodology requirements`: append Rule 13 (Item E)

```
### 13. Acceptance-criteria waiver protocol

When environment conditions prevent a brief's acceptance criteria from being verified at Phase 3 (seeded data absent, third-party service unavailable, indexed-state not yet propagated, etc.), the dispatcher MAY authorize merge with an explicit waiver. The waiver requires BOTH artifacts to land at merge time:

- **Waiver decision in PR body** — dispatcher's explicit "verification waived because <env condition>" note. Not implicit. Not "merge anyway, will verify later."
- **Deferred-verification FU banked in `docs/FOLLOW_UPS.md`** — full re-run instructions (commands, env prerequisites, seed paths) and the unverified acceptance criteria copied verbatim. Banked in the same merge cycle as the resolving PR — never deferred to a follow-up commit.

CC's Phase 3 surfaces the env gap (via Rule 12's STOP and wait for dispatcher); dispatcher authorizes waiver or instructs CC to resolve the env condition. Banked from PR #166 (shakedown harness re-run blocked by absent `*@agencytrack.test` accounts; deferred FU at `docs/FOLLOW_UPS.md:44`, PR #166 squash commit `eedd2bb`).
```

### Step 2.9 — Update Rule 1 to cite Rule 12

Find Rule 1's existing paragraph (the surface-before-architectural-decisions rule). Insert a parenthetical reference to Rule 12 at the appropriate place — minimally invasive edit. Example shape (CC adapts to actual existing wording):

```
... CC must surface (per Rule 12's STOP and wait for dispatcher semantics) BEFORE making architectural decisions outside the brief's locked scope ...
```

### Step 2.10 — Update Rule 3 to note STOP IMMEDIATELY as data-safety variant

Find Rule 3's existing paragraph (autonomous-mode strike calibration with STOP IMMEDIATELY language). Append a one-sentence cross-link to Rule 12:

```
STOP IMMEDIATELY is the data-safety variant of Rule 12's halt-condition vocabulary.
```

## Phase 3 — Verification

1. `npm run lint` — trivial pass expected (no JS touched). Capture output.
2. `npm run build` — clean build expected. Capture output.
3. `git diff docs/CLAUDE.md` — review the full diff. Confirm: ~60–90 lines added; 1–2 lines edited (header comment + Rule 1 + Rule 3 cross-refs + brief-drafting sub-bullet appendage).
4. Confirm `git status` shows only `docs/CLAUDE.md` and `docs/CONTEXT.md` modified.

If lint or build fails (it shouldn't — docs only), **STOP and wait for dispatcher**.

## Phase 4 — Docs (CONTEXT.md)

1. Add a recently-shipped placeholder row in `docs/CONTEXT.md` matching the standard Rule 4 placeholder pattern (PR# + SHA placeholders for post-merge fill).
2. No `FOLLOW_UPS.md` entries to close in this PR — the 5 methodology items live in chat queue, not as FU entries.

## Phase 5 — Commit, push, PR

1. `git add docs/CLAUDE.md docs/CONTEXT.md`
2. `git commit -m "docs(CLAUDE): bank 5 methodology rules from May 14-15 closure arcs (indexes deploy + rules 10-13)"`
3. `git push -u origin docs/claude-md-methodology-batch-2`
4. Open PR with body containing:
   - Reference to CLAUDE.md methodology edit pre-flight audit (2026-05-15)
   - Summary of 5 rules banked (Item A → Workflow + Commands; Rules 10/11/12/13 → Methodology)
   - Note Rule 1 and Rule 3 cross-reference updates (surgical, no semantic change)
   - Banking date 2026-05-15
   - **Smoke waiver justification:** "Pure docs change to `docs/CLAUDE.md` only — no source, no config, no rules, no indexes touched. Rule additions set policy for future PRs; no runtime behavior affected. Lint + build verified."
5. Stop after PR is open. Wait for Kelsean to merge.

---

## Acceptance criteria

- `## Commands`: new `firebase deploy --only firestore:indexes` line added
- `## Workflow — IMPORTANT`: new Item A bullet inserted beside existing additive-deploy rule
- `## Workflow — IMPORTANT`: brief-drafting sub-bullet appended with Rule 10/11 cross-refs
- `## Methodology requirements`: header comment updated; Rules 10/11/12/13 appended verbatim per Phase 2 wording
- Rule 1 cites Rule 12 (surgical edit)
- Rule 3 notes STOP IMMEDIATELY as Rule 12's data-safety variant (one-sentence append)
- `CONTEXT.md` recently-shipped placeholder row added
- Lint clean, build clean
- Smoke waiver justified inline in PR body

## Hard stops (using Rule 12 canonical phrasing — practicing what the rule preaches)

- **Phase 1:** If any quoted CLAUDE.md section text has drifted from the audit surface report's quotes (another PR landed on main between audit and this PR), **STOP and wait for dispatcher** for line-number reconciliation.
- **Phase 2:** If proposed wording produces semantic ambiguity with any existing CLAUDE.md rule not enumerated in this brief, **STOP and wait for dispatcher**.
- **Phase 3:** If `npm run lint` or `npm run build` fails, **STOP and wait for dispatcher**.

## Out of scope

- Backfilling existing committed briefs with Rule 12 canonical phrasing (grandfathered per dispatcher decision)
- Updating local untracked briefs in `docs/briefs/` (dispatcher will handle manually when next dispatched)
- env-credentials propagation audit (separate work; remains queue item)
- inventory-prose-instability fix (separate work; remains queue item)
- Any source code changes
- Any `FOLLOW_UPS.md` changes (no FU closures associated with this PR)

## Standing rule reminders

- Single-branch PR rule applies (fresh branch off freshly-fetched main, never reuse)
- Phase 0 gate fires as usual
- Smoke waiver allowed for pure docs changes per banked May 14 rule; justification required inline
- Post-merge sequence (Rule 4) runs automatically after Kelsean merges
