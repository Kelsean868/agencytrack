# Deploy, preview and post-merge mechanics

Moved out of CLAUDE.md (§ Workflow, original lines 21–22, 41–63; Session Protocol step
9.5's rationale, line 376; § Post-merge local cleanup, lines 378–394) on the router split.

CLAUDE.md keeps the prohibitions and the ordered sequences — the production-Firebase
preview warning, the green-channel merge-authority policy, `gh pr merge --admin is
forbidden`, the key-removal ordering, the Phase 0 branch gate, and the Rule 16 / Rule 15
anchors. This file carries the mechanics, the fallbacks and the incident evidence.

## Vercel preview URLs and the 63-character DNS limit

- Vercel preview URL pattern: `agencytrack-git-{branch}-kyron-marchan-s-projects.vercel.app`. The bare `agencytrack-git-{branch}.vercel.app` form is NOT what Vercel emits — per-team URLs include the team slug. Banked from PR #52 retrospective.
  - **63-char DNS label limit:** the branch-alias hostname is a single DNS label and silently fails to resolve when `len("agencytrack-git-" + branch + "-kyron-marchan-s-projects") > 63` — long branch names (e.g. `feat/gpm1-team-plans-reader` → 68 chars) get NO working alias at all, not an error page. Fallback: use the immutable per-deployment URL (`agencytrack-<hash>-kyron-marchan-s-projects.vercel.app`) read from the GitHub deployment status — `gh api repos/{owner}/{repo}/deployments` → statuses → `environment_url` with state `success`. Check the length BEFORE relying on the alias in smokes. Banked from PR #785 smoke; codified via the verification-hygiene FU batch.

> The production-Firebase binding of feature-branch previews (original line 24) is
> reproduced **in full and inline** in CLAUDE.md § Workflow. It is not duplicated here;
> it is too load-bearing to live behind a router hop.

## Pre-merge deploys — additive rules and Cloud Functions

- **Additive Firestore rules / Cloud Functions — deploy from the feature worktree before the PR merges.** When a PR introduces a *purely additive* change, it is safe to deploy from the feature worktree ahead of merge so the Vercel preview can exercise the new code path against real production rules / functions. Capture the deploy output in the PR description. Pre-merge deploys are permitted for:
  - `firestore.rules`: new `match /...` blocks for new paths (no edits to existing rules).
  - Cloud Functions: new exports (no edits to existing functions).
  - Cloud Functions: modifications to existing exports where new behavior is gated by new input fields not present in existing callers (defense: existing callers fall through to existing behavior, no regression vector). C2's `doCreateUser` extension for optional `data.branchId` / `data.csvImportBatchId` / `data.importedFromCsv` is the canonical example.
  Modifications where existing callers exercise the new behavior → post-merge only. Banked from C1 close (rules block deployed pre-merge for BranchesPanel preview); generalized to Cloud Functions in C2.

## Composite indexes require an explicit deploy

- **`firestore.indexes.json` changes require explicit deploy confirmation.** Adding or modifying a composite index in `firestore.indexes.json` does NOT auto-deploy via Vercel — `firebase deploy --only firestore:indexes` must be run from a worktree authenticated against the production project. Capture the deploy output (or Firebase Console index ID + status) in the PR description before merge. Pre-merge deploy is safe for additive index changes (new composites that don't redefine an existing one); modifications/removals deploy post-merge with the same staging discipline as rules. Verification path: Firebase Console → Firestore Database → Indexes → Composite tab, confirm status `Enabled`. Banked from PR #162 closure audit (composite `(unitId, weekStarting)` deploy state required manual Console verification because no rule existed).

## `firebase deploy` pre-flight — full rationale

- **`firebase deploy` pre-flight: worktree at `origin/main` HEAD + `node_modules` installed.** Before any `firebase deploy --only functions` / `--only firestore:rules` / `--only firestore:indexes` from a feature worktree:
  1. **Confirm the worktree's HEAD matches `origin/main`** (unless this is a pre-merge additive-rule deploy per the existing "Additive Firestore rules / Cloud Functions — deploy from the feature worktree before the PR merges" carve-out). Pattern: `git fetch origin && git rev-parse HEAD == git rev-parse origin/main`. Mismatch → STOP and surface.
  2. **Confirm `node_modules` is installed and current** at the worktree's package root for whichever surface is being deployed: `functions/node_modules` for functions deploys, repo-root `node_modules` for any build-step that runs ahead of the deploy. Pattern: a quick `npm install --silent` in the relevant directory (idempotent if already installed). Missing → install before proceeding.
  3. **Confirm authenticated against the correct Firebase project** via `firebase use` or the project flag.
  Why: stale-worktree deploys ship code that doesn't match what the PR proved; missing-`node_modules` deploys fail mid-flight with cryptic errors that look like Firebase issues. Both classes are silent until they bite. Carve-out for pre-merge additive rules / function exports: the existing § Workflow bullet ("Additive Firestore rules / Cloud Functions — deploy from the feature worktree before the PR merges") authorizes a deploy from a worktree NOT at `origin/main` HEAD — step 1 is waived for that specific case; steps 2 + 3 still apply. Banked 2026-06-01; codified Track J overnight queue 2026-06-04.

## Squash SHA vs feature-branch SHA

- **Squash SHA ≠ feature-branch SHA.** GitHub generates a fresh SHA on squash-merge (the feature branch's pre-squash final commit is NOT what lands on main). Kickoff briefs and CONTEXT.md `Recently shipped` rows must record the squash SHA captured from `git log origin/main --oneline -1` post-merge, not the feature branch's pre-squash final SHA. Banked from C2 close.
  - **Brief drafting from FOLLOW_UPS.md items must verify codebase state first.** Before drafting a kickoff brief for a follow-up item, grep git log + PR history for the topic (`git log --all --grep="<topic>"`). If the work is already shipped, the brief is unnecessary — update FOLLOW_UPS.md to reflect actual state instead. Banked from PR #124 close (wizard hardening brief was drafted while PR #88 had already shipped the work, causing ~45 min of wasted CC discovery). (see Methodology Rule 10 for brief commit convention; Rule 11 for FU-body re-audit before first work).

## Cloud Functions auth — ambient credentials and the one-time IAM grant

- **Cloud Functions auth: ambient credentials, not key files.** Functions that mint custom tokens (`admin.auth().createCustomToken(...)`) or otherwise call `signBlob` must use the App Engine default service account's ambient credentials via plain `admin.initializeApp()` — **never ship `service-account-key.json` in the deploy bundle**. Ambient credentials need `roles/iam.serviceAccountTokenCreator` granted to the SA on itself. One-time setup:
  ```
  gcloud iam service-accounts add-iam-policy-binding \
    <project>@appspot.gserviceaccount.com \
    --member=serviceAccount:<project>@appspot.gserviceaccount.com \
    --role=roles/iam.serviceAccountTokenCreator
  ```
  Why: a checked-in (or bundled-but-gitignored) key file is a long-lived credential leak vector. Ambient credentials rotate automatically and never sit on disk. Reference: PR #78 — `chore(security): remove service-account-key.json from CF deploy, use ambient credentials`.

## Post-merge sequence — rationale and the collision procedure

Session Protocol step 9.5, in full as it stood before the split:

9.5. After merge, before running production verification: `git fetch origin --prune && git pull origin main`. The pull ensures worktree-local tooling (especially `scripts/exploration-walk.cjs` and any other verification scripts) matches the merged state on origin. Fetching alone leaves verification scripts at pre-merge versions and they may run stale (lesson from B3 post-merge — PR #49). The `--prune` flag deletes stale remote-tracking refs for branches GitHub already removed via `deleteBranchOnMerge`, so `git branch -r` stays clean and `git branch --merged` returns accurate results — without it, post-squash refs accumulate across PRs (banked from PR #57 cleanup).

### Post-merge local cleanup (standard sequence, not exception)

**Phase 0 — branch confirmation gate (validated PRs #154–#158).** Before step 9.5's pull, verify `git rev-parse --abbrev-ref HEAD` returns `main`. If not, `git checkout main` before any further command. Step 9.5's `git pull origin main` from a feature branch creates an unintended merge commit or operates on the wrong working tree; the Phase 0 gate eliminates both modes. Surfaced after PR #154 hiccup (placeholder edits applied to wrong branch, required recovery); validated in PRs #155, #156, #157, #158.

After step 9.5's pull and after capturing the squash SHA from `git log origin/main --oneline -5`:

- **Local branch deletion uses `git branch -D <feature-branch>` (force).** With GitHub's `deleteBranchOnMerge: true` enabled on the repo, the remote tracking ref is pruned automatically before local cleanup runs, so `git branch -d` (lowercase) cannot verify merge status and will refuse. `git branch -D` is the correct tool here — the squash SHA captured one step earlier verifies the diff is preserved in main. Reference: PR #50 retrospective, B3 post-merge.
- **Untracked-doc collision on `git pull`:** If `git pull` aborts with `error: The following untracked working tree files would be overwritten by merge: <path>` for a doc that was drafted in the main worktree before opening its PR from a sibling worktree, this is the expected collision pattern (origin has the merged version, main worktree still has the local untracked draft). Resolve by:
  1. `git hash-object <local-path>` and compare against `git show origin/main:<path> | git hash-object --stdin`.
  2. If hashes match, content is identical — `rm <local-path>` and re-run `git pull`.
  3. If hashes don't match, the local copy has unmerged edits — surface as a real conflict, do not auto-resolve.

  Prevention (preferred): When opening a docs-only PR, draft the file directly inside the PR's feature worktree, not the main worktree. This keeps main's working tree clean and avoids the collision entirely. Reference: PR #51 retrospective, B-series cleanup pattern across PRs #45, #50, #51.
- **Verification target = no NEW stale state from this PR.** After cleanup, "clean" means this PR's branch is deleted, its worktree (if any) removed, no PR-specific untracked artifacts remain. Pre-existing stale branches from prior sessions fall under the running Worktree + branch audit FU, not this PR's cleanup. Verification must scope honestly to what this PR introduced; "only main + remote refs" is aspirational across all PRs, not a per-PR-enforceable target. Banked from PR #155 (arbitrary-syntax sweep) surfacing 4 pre-existing stale branches that were correctly identified as out-of-scope.

Rule 16 governs the fill scope for this sequence; Rule 15 governs the origin-verification step for any commit produced by it.


## Always sync before branching — the incident

- **Always sync before branching:** run `git fetch origin && git pull origin main` before
  creating a new branch off main. PR #31 (lint cleanup) was cut while A11Y PR2 was still
  open; PR2 merged first and both had touched `ManagerAwardsPanel.jsx`, producing a
  conflict that required a manual merge commit. Pulling latest main before branching
  eliminates this class of conflict entirely.

## Doc placement follows propagation direction

**Doc placement follows PROPAGATION DIRECTION, not content type.** `staging → main` runs automatically at promotion; `main → staging` only fires at promotion boundaries, which is always **after** the work a mid-cycle rule was meant to govern. So:

- **STAGING — `CLAUDE.md`, `docs/FOLLOW_UPS.md`.** Read from the working tree **during** a build, which always runs on a branch cut from `staging`. Reaches `main` for free at promotion.
- **MAIN — `docs/CONTEXT.md`, `docs/briefs/`.** Read at **dispatch** time, when the tree is still on `main`. `CONTEXT.md`'s *Current main HEAD* row is literally about main, and `/land-and-dispatch` hardwires briefs there.

**Consequence: `CLAUDE.md` edits ride in PRs rather than direct-to-main commits.** That is an improvement, not a cost — a rule governing every future build should get CI and reviewer coverage. Banking a rule between builds costs one small docs PR against `staging`.

Learned the expensive way: three rules — the v3 binding rules, the mutation rule (now `docs/agents/test-and-lint-notes.md` § Property tests must be mutation-verified), and the junction rule (now `CLAUDE.md` § Banked patterns) — each landed where the builds they governed **could not see them**, and two of them collided at the same anchor and would have conflicted at promotion. See PR #886.

## `git diff A B` is a two-endpoint diff — use the merge-base as a scope gate

**`git diff A B` is a TWO-ENDPOINT diff** — it lists every file differing in **either** direction, so it sweeps in `B`'s own additions. To ask *"what does A add relative to B"*, diff against the merge-base: `git diff $(git merge-base A B) A`, or the triple-dot `git diff B...A`. Using the two-endpoint form as a **scope gate** produced a false STOP on PR #886 that was indistinguishable from a real scope violation. Same family as the `slice(indexOf(a), indexOf(b))` rule: **a check that appears to work while answering a different question is the most expensive kind.**

## The reference point must match the question — the general rule, with three instances

The rule above is one case of a larger one, and the general form is worth carrying because
it has now bitten three times in three different shapes, twice in a single session:

> **A check has two parts: the comparison, and the reference point it compares against. A
> correct comparison against the wrong reference point runs, returns, and answers a
> different question than the one asked.** It does not error. It produces a plausible
> number that a reader will act on.

The three instances, deliberately listed together because no two look alike:

| # | The question asked | Reference point used | Correct reference point |
|---|---|---|---|
| 1 | *"What did this branch change?"* | two endpoints (`git diff A B`) | the **merge-base** (PR #886) |
| 2 | *"Has `main` moved since I computed this resolution?"* | the **merge-base** | a **fixed ref** — `main`'s tip at computation time (PR #907 §5 pre-flight) |
| 3 | *"Is production's ruleset stale?"* | **git** (`git diff <old main> <merge>`) | **Firebase** — the deploy target (post-promotion, 2026-08-16) |

Instances 1 and 2 are mirror images of each other, which is the trap: having learned to
reach for the merge-base, the natural next error is reaching for it when a fixed ref was
needed. Instance 3 is the sharpest, because the reference point was not a git ref at all.

**Instance 3, stated plainly since it is the newest.** After the `b4d9be7b` promotion,
`git diff --stat 219cf324 b4d9be7b -- firestore.rules` showed `+18/−2` and was read as
evidence of a production gap. **It is not, and git cannot be.** A git diff answers *"did
this file change between two commits"*. **Nothing in git knows what ruleset Firebase is
serving** — only Firebase does. The diff was correct; the question it was asked to answer
was not one it can answer. Running the deploy reported *"latest version of firestore.rules
already up to date, skipping upload"*: production had carried the rules since #878
(`74a321bc`) landed, because that PR was itself DEPLOY-GATED and deployed on landing.
**There was no gap.**

**The remedy is the same in all three cases: name the question in words before choosing
the reference point, then check that the reference point can even see the thing the
question is about.** For deploy state specifically, the only authority is the deploy
target, and the deploy command is idempotent — so *running* it is cheaper and strictly
more truthful than any attempt to infer staleness from the repository.

## Per-slice "zero backend delta" claims do NOT compose across a range

A separate lesson from the same episode, and the reason the audit below is worth keeping
even though its first run came back clean.

Every v3 Phase 0 slice recorded **"zero backend delta; nothing to deploy"** in
`CONTEXT.md`, and each claim was true of that slice. **A promotion range is not a slice.**
The `219cf324..b4d9be7b` range contained 98 files and one `firestore.rules` change
(`74a321bc`, #878) that no Phase 0 entry mentioned, because #878 was not a Phase 0 slice —
it simply sat in the same range. **Reading a sequence of true per-slice claims as a
property of their union is an induction that does not hold**, and the larger the range the
less it holds.

### Runbook step — between the merge and the acceptance check

Run the **trigger**, on the promoted range:

```
git diff --stat <old main HEAD> <merge commit> -- firestore.rules firestore.indexes.json functions/
```

**Non-empty means a deploy MIGHT be needed. It is a trigger, not a verdict** — and the
distinction is the whole point of instance 3 above. Do not report a production gap from
this output; git cannot see the deploy target.

**The verdict comes from running the deploy** (`firebase deploy --only firestore:rules` /
`firestore:indexes` / `functions`, as the output indicates). It is idempotent and reports
`already up to date, skipping upload` when nothing is stale, which is itself the evidence
worth capturing. **Empty output means no deploy-gated surface moved in the range** and the
step is genuinely done.

**First run, 2026-08-16 (`b4d9be7b`): trigger fired** — `firestore.rules +18/−2`,
`firestore.indexes.json` and `functions/` untouched. **Deploy run: NO-OP**, ruleset already
live. The step earned its place by being cheap and by producing a recorded negative, not by
catching anything.
