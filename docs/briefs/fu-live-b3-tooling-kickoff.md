# FU — land live-b3-post-deploy.mjs as standing verification tooling (XS)

**Channel:** PR → CI → bot review → HUMAN-MERGE (it is source, not docs — no direct-to-main)
**Size:** XS | **Model tier:** Sonnet | **Strike count:** 0/2

## Context

During the PR #790 post-deploy closure (2026-07-04), CC authored
`scripts/verification/live-b3-post-deploy.mjs` — the live write-read-ack + foil-deny
protocol run against production (9/9 PASS, evidence in FOLLOW_UPS.md's resolved
PR-B3 deferred-verification entry). The script exists ONLY in the local worktree,
uncommitted. Dispatcher decision: keep it as standing tooling. It must land via its
own PR, not a docs commit.

## Phase 0 — falsification gate

1. Confirm the file exists locally at `scripts/verification/live-b3-post-deploy.mjs`
   and is untracked (`git ls-files` does not list it). If it is missing or already
   tracked → STOP and report.
2. Grep the script for any hardcoded credential, token, bypass secret, or plaintext
   password. Env-var NAMES (e.g. VERCEL_BYPASS_TOKEN) are fine; literal values are
   NOT. Any literal secret → STOP and report before staging anything.
3. Confirm SMOKES.md exists at `scripts/verification/SMOKES.md` and read its table
   format.

## Phase 1 — hygiene pass (edit-in-place, no behavior change)

1. Add a header comment block to the script stating:
   - PURPOSE: live post-deploy verification of planSuggestions rules
     (write-read-ack cycle + foil denies) against production.
   - OPERATOR-RUN-ONLY: requires Admin SDK credentials and writes/cleans real
     production docs. NEVER wire into CI. Run only after a rules deploy touching
     planSuggestions, with dispatcher authorization.
   - CLEANUP CONTRACT: every doc the script creates must be deleted by its own
     teardown; exit non-zero if orphans remain.
2. No logic changes. If the script needs a logic fix to satisfy the cleanup
   contract it already demonstrated (0 orphans on 2026-07-04), STOP and surface —
   that would contradict the closure evidence.

## Phase 2 — registration

1. Add one row to SMOKES.md: name, path, scope = planSuggestions live legs
   (post-rules-deploy), cadence = on-demand after relevant rules deploys,
   OPERATOR-RUN-ONLY flag, last-green = 2026-07-04 (9/9).

## Phase 3 — verification

1. `npm run lint` clean (script must not introduce lint errors).
2. Do NOT execute the script (it writes to production; its green run is already
   evidenced). A syntax check (`node --check`) is sufficient.

## Phase 4 — docs-with-placeholders

1. FOLLOW_UPS.md: add a one-line resolved note under the PR-B3 entry — "tooling
   landed as standing smoke via PR #{TBD}."
2. CONTEXT.md: no Recently-shipped row needed for an XS tooling PR; skip unless
   the Rule 16 fill template requires it.

## Phase 5 — commit/push/PR

1. Stage ONLY: the script + SMOKES.md + FOLLOW_UPS.md. Never `git add -A`.
2. Branch off freshly-fetched main. Commit, push, open PR titled
   `chore(verification): land live-b3-post-deploy standing smoke (operator-run-only)`.
3. Report PR-ready with feature-branch HEAD SHA (Rule 20). Poll bot reviewers
   (Rule 21). HOLD for human merge.

## Rule 22 — known gap to state in the report

The script's green evidence predates this PR; reviewers see the code without a
fresh execution. State this explicitly.

## Rule 23 — falsifier

If Phase 0.2 finds a literal secret, or the script turns out to be already
tracked, the premise of this brief is wrong — STOP, do not adapt around it.
