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
