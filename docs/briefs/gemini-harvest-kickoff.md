# Kickoff — Gemini Review Harvest: mine, judge, and implement merged-PR review comments

**Version: v1 (2026-06-06).**
**Size:** L (window-bounded ~4h) · **Type:** review-mining + bounded remediation ·
**Channel:** harvest/report = GREEN; implemented fixes = REMEDIATION AUTO-MERGE under
the bounds below, per the operator's recorded grant: "full authority to merge where
necessary" (2026-06-06). The HARD LINES override the grant, always: firestore.rules ·
functions/** · schema/doc shapes · money-math engines (commissionMath,
goalDecomposition, calculations formulas) · token definitions · dependencies. Gemini
suggestions touching those are REPORT-ONLY dispositions.
**Branch(es):** themed batches off main, `chore/gemini-harvest-<theme>`.

## Phase 1 — Harvest (read-only)
Enumerate ALL merged PRs (gh pr list --state merged, full history). For each, pull
review comments + reviews authored by the Gemini bot (identify the bot login from any
known commented PR; cite it). Build the master table: PR# · file:line at the time ·
the suggestion (condensed) · current-code status (grep: code still exists / changed /
deleted).

## Phase 2 — Disposition (the judgment pass; every row gets one)
- IMPLEMENT — correct, still applicable, inside bounds.
- ALREADY-RESOLVED — later work fixed it (cite the fixing PR/SHA).
- OBSOLETE — the code is gone or rewritten (cite).
- DISAGREE — with a one-line technical rationale (style-only churn, conflicts with a
  recorded decision/doctrine, wrong about the framework, etc.).
- OUT-OF-BOUNDS — valid but touches a hard line or exceeds size bounds → goes to the
  operator list with a recommendation.
Doctrine and recorded decisions OUTRANK Gemini: anything contradicting CLAUDE.md rules,
the D-doctrines, characterization-protected behavior, or dispatcher rulings is DISAGREE
with the citation.

## Phase 3 — Implementation (REMEDIATION channel, bounded)
- Per-fix bounds: ≤40 changed lines / ≤3 files; bug-claims prove FAILING-TEST-FIRST
  (the test demonstrating the issue commits before the fix); behavior-preserving
  refinements carry equivalence reasoning in the commit message.
- BATCHING: group fixes by theme/area into ≤10 PRs total (not one PR per comment).
  Each batch PR body lists its comments (PR#/file/line) and dispositions.
- Per batch: full standing gates (lint · suite · build · hex-grep) · axe NO-NEW if any
  UI file is touched · CI to SUCCESS · AUTO-MERGE on full self-pass · prod deploy poll
  + health spot-check after each merged batch · two-revert circuit breaker across the
  whole program.
- Any batch where the suite reveals the "fix" changes observable behavior beyond the
  bug-claim → drop that fix from the batch, disposition flips to OUT-OF-BOUNDS.

## Phase 4 — The lasting artifact
`docs/reviews/gemini-harvest-2026-06.md` (docs PR, auto-merge): the complete master
table with dispositions and rationales, batch-PR cross-references, and the operator
list (OUT-OF-BOUNDS items with recommendations). This is the answer to "did we ever
read all of them" — permanently.

## Report
Master counts by disposition · batch PR links + SHAs (Rule 20 each) · per-batch gate
evidence · the operator list · anything parked · strike count.

## Out of scope
Hard-line files (report-only) · refactors beyond the size bounds · new features Gemini
proposed (disposition: OUT-OF-BOUNDS, operator list) · #517 (separate directive in
flight) · the S3 sweep (awaits operator).
