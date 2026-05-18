# PR brief — Dispatcher tooling

**Sized:** S
**Branch:** `feat/dispatcher-tooling`
**Type:** Tooling + docs. No source code, no Firestore rules.

## Outcome

Reduce per-PR copy-paste between dispatcher (Claude chat), operator (Kyron), and Claude Code by shipping:

1. `scripts/dispatcher/new-brief.ps1` — one-command brief docs PR shuffle
2. `.claude/commands/dispatch.md` — `/dispatch <brief-path>` CC slash command
3. `.claude/commands/post-merge.md` — `/post-merge <pr-number>` CC slash command
4. `docs/CLAUDE.md` — new § Dispatcher tooling section

Standing methodology (Session Protocol, Methodology Rules 1–17) remains canonical. The tooling embeds the rules; it does not replace them.

First validation of `/dispatch` + `/post-merge` lands on the next PR after this one.

## Out of scope

- Modifying any canonical CLAUDE.md rule body (only adding a new § Dispatcher tooling section)
- Source code changes
- Firestore rules changes
- Any `FOLLOW_UPS.md` changes (no residual; PR is self-contained)
- Auto-enforcement via git hooks (deferred — risky, low ROI vs slash commands)
- Adding the user-level `~/.claude/commands/` install path (operator-level decision; repo ships project-level only)

## Phase 0 — gate

1. `git rev-parse --abbrev-ref HEAD` → must be `main`. If not, `git checkout main` first.
2. `git status` → working tree clean except the 6 known untracked verification scripts.
3. `git fetch --prune origin && git pull origin main` → fast-forward only.
4. `git rev-parse HEAD` → expected `c12e23f` per current CONTEXT.md "Current main HEAD".

If any divergence from Phase 0 expectations: **STOP and wait for dispatcher**.

## Phase 1 — sanity checks (Rule 17 source-verify)

1. Confirm `scripts/dispatcher/` does NOT exist: `Test-Path scripts/dispatcher` → False expected.
2. Confirm `.claude/commands/` does NOT exist: `Test-Path .claude/commands` → False expected.
3. Confirm `docs/CLAUDE.md` does NOT contain `## Dispatcher tooling`: `Select-String -Path docs/CLAUDE.md -Pattern "^## Dispatcher tooling"` → no match expected.
4. Confirm `.gitignore` does NOT exclude `.claude/commands/`: `Select-String -Path .gitignore -Pattern "\.claude/commands"` → no match expected. (The `.claude/worktrees/` exclusion from the Phase 3 accidental-commit fix is fine and stays.)
5. Read `docs/CLAUDE.md` and identify the exact insertion point for the new § Dispatcher tooling section: after the last numbered Methodology Rule, before any historical-context, appendix, or trailer section. Surface the insertion line number in summary.
6. Read `docs/CONTEXT.md` and identify the current oldest row in the Recently-shipped table for replacement.

If any premise has shifted from the above: **STOP and wait for dispatcher**.

## Phase 2 — edits (in this order)

### Edit 1 — Create `scripts/dispatcher/new-brief.ps1`

```powershell
#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Ship a kickoff brief to docs/briefs/ via a small docs PR.

.DESCRIPTION
  Automates the per-PR brief docs PR workflow (CLAUDE.md Rule 10).
  Assumes the brief file already exists in docs/briefs/ (typically written
  by the dispatcher chat via a Set-Content paste-block).

  Runs Phase 0 gate (must be on main, working tree clean), fetches origin,
  pulls main, creates a fresh branch (single-branch rule per Rule 1),
  commits the brief, pushes upstream.

.PARAMETER File
  Brief filename without path. Must exist in docs/briefs/.
  Example: "fu-foo-closure-kickoff.md"

.PARAMETER Topic
  Conventional-commit subject text. Used as: "docs(briefs): <Topic> kickoff"
  Example: "FU-foo closure"

.EXAMPLE
  .\scripts\dispatcher\new-brief.ps1 -File "fu-foo-closure-kickoff.md" -Topic "FU-foo closure"
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$File,

    [Parameter(Mandatory = $true)]
    [string]$Topic
)

$ErrorActionPreference = "Stop"

# Phase 0 gate: must be on main
$currentBranch = git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne "main") {
    Write-Error "Phase 0 gate: must be on main (currently on '$currentBranch'). Checkout main first."
    exit 1
}

# Verify brief file exists at expected path
$briefPath = Join-Path "docs" (Join-Path "briefs" $File)
if (-not (Test-Path $briefPath)) {
    Write-Error "Brief file not found: $briefPath. Write the brief content to disk first (paste-block from dispatcher)."
    exit 1
}

# Derive branch name from filename slug
$slug = [System.IO.Path]::GetFileNameWithoutExtension($File)
$branchName = "docs/$slug-brief"

# Phase 0 step 3: fetch + pull
Write-Host "==> git fetch --prune origin" -ForegroundColor Cyan
git fetch --prune origin
if ($LASTEXITCODE -ne 0) { Write-Error "fetch failed"; exit 1 }

Write-Host "==> git pull origin main" -ForegroundColor Cyan
git pull origin main
if ($LASTEXITCODE -ne 0) { Write-Error "pull failed"; exit 1 }

# Fresh branch (single-branch PR rule)
Write-Host "==> git checkout -b $branchName" -ForegroundColor Cyan
git checkout -b $branchName
if ($LASTEXITCODE -ne 0) { Write-Error "checkout -b failed (branch may already exist; single-branch rule forbids reuse)"; exit 1 }

# Stage + commit
Write-Host "==> git add $briefPath" -ForegroundColor Cyan
git add $briefPath

$commitMsg = "docs(briefs): $Topic kickoff"
Write-Host "==> git commit -m `"$commitMsg`"" -ForegroundColor Cyan
git commit -m $commitMsg
if ($LASTEXITCODE -ne 0) { Write-Error "commit failed"; exit 1 }

# Push upstream
Write-Host "==> git push -u origin $branchName" -ForegroundColor Cyan
git push -u origin $branchName
if ($LASTEXITCODE -ne 0) { Write-Error "push failed"; exit 1 }

Write-Host ""
Write-Host "OK Brief docs PR ready." -ForegroundColor Green
Write-Host "   Open PR: https://github.com/Kelsean868/agencytrack/compare/$branchName" -ForegroundColor Yellow
Write-Host ""
Write-Host "After squash-merge in GitHub UI:" -ForegroundColor Green
Write-Host "   git checkout main && git pull origin main" -ForegroundColor Yellow
Write-Host "Then tell dispatcher 'brief merged' for the CC /dispatch invocation." -ForegroundColor Green
```

### Edit 2 — Create `.claude/commands/dispatch.md`

```markdown
---
description: Execute a kickoff brief through Phases 0-5 with standing methodology applied.
argument-hint: <brief-path>
---

PR dispatch — execute the kickoff brief at `$ARGUMENTS`.

Read the brief in full before doing anything else. Then execute Phases 0–5 as the brief specifies.

Strike count opens at 0/2.

## Standing methodology (canonical CLAUDE.md applies — these are reminders)

- **Phase 0 gate** (Session Protocol step 1): if not on main with clean working tree, checkout main first. Hard-stop if Phase 0 step 3 fetch/pull surfaces unexpected divergence.
- **Single-branch PR rule** (Rule 1): fresh branch off freshly-fetched main, never reuse.
- **Source-verify at brief authoring** (Rule 17): if any Phase 1 sanity check shows a brief premise has shifted (file paths moved, grep counts changed, items already shipped, etc.), STOP and wait for dispatcher.
- **Canonical hard-stop phrasing** (Rule 12): every stop condition in summary reports uses the literal phrase "STOP and wait for dispatcher".
- **Smoke default** (Rule 9): production smoke runs autonomously via `setupBypassSession`. Waiver allowed only for pure-docs / internal-refactor / tooling changes — justify inline if waiving.
- **Direct-to-main verification** (Rule 15): any post-Phase-5 direct-to-main push (Phase 6 placeholder fill, hotfix) requires `git fetch origin && git log origin/main --oneline -1` immediately after push, SHA-match against `git rev-parse HEAD`, and explicit "pushed and verified — SHA <sha>" report.

## Scope extensions

Per Rule 9 in-PR scope extension: if a clearly-in-scope adjacency surfaces during execution, document it inline and bank — do not STOP for dispatcher unless the adjacency materially changes the PR's surface area or risk profile.

## Stop conditions

- Phase 0 gate divergence (working tree dirty, SHA mismatch, fetch/pull non-fast-forward)
- Phase 1 sanity check shows a brief premise has shifted
- `npm run lint` or `npm run build` fails in Phase 3 on a file outside the PR's edit set
- Smoke (if run) surfaces a regression
- Any premise the brief asserts that the repo state contradicts

In each case, STOP and wait for dispatcher.

## After PR is open

Surface the PR URL in your summary. Do NOT run Phase 6 post-merge sequence until dispatcher confirms merge — Phase 6 is invoked separately via `/post-merge <pr-number>`.
```

### Edit 3 — Create `.claude/commands/post-merge.md`

```markdown
---
description: Run the canonical post-merge sequence after dispatcher confirms PR squash-merge.
argument-hint: <pr-number>
---

Post-merge sequence — PR #$ARGUMENTS just squash-merged.

Execute the canonical sequence (CLAUDE.md Session Protocol step 9 + § Post-merge local cleanup):

1. **Phase 0 gate** — if not on main, `git checkout main` first.
2. **Sync main** — `git fetch --prune origin && git pull origin main`.
3. **Capture squash SHA** — `git log origin/main --oneline -1`. Capture the SHA and the PR number from the merge commit subject.
4. **Fill placeholders** — replace `#TBD` and `{TBD}` markers in `docs/CONTEXT.md` and `docs/FOLLOW_UPS.md` (and any other docs the work PR added placeholders to, e.g. `docs/CLAUDE.md` Banked trailers) with the captured PR number and SHA.
5. **Commit** directly to main with message: `docs: post-merge fill for PR #<n>`.
6. **Push** to main.
7. **Rule 15 verification (mandatory)** — `git fetch origin && git log origin/main --oneline -1`. Confirm the SHA matches `git rev-parse HEAD` on local main. Report explicit "pushed and verified — SHA <sha>".
8. **Optional cleanup** — per banked squash-merge stale-branch detection: `git fetch --prune origin`, then sweep branches in `[origin/X: gone]` state (skip worktree-attached branches via `git worktree list --porcelain`, skip live-upstream branches).
9. **Summary report** — squash SHA, placeholder-fill commit SHA, verification status, any cleanup actions taken.

## Stop conditions

- **Rule 15 SHA mismatch** between local main HEAD and origin/main after push: STOP and wait for dispatcher. Do NOT retry, amend, or exit the sequence.
- **Placeholder fill ambiguity** — if multiple PRs' worth of `#TBD`/`{TBD}` markers are present and it's not clear which belong to this PR: STOP and wait for dispatcher.
- **Merge commit not found** — if `git log origin/main` does not show the expected PR # in the most recent commit: STOP and wait for dispatcher (likely merge has not completed or operator confirmed prematurely).

Hard-stop phrasing in summary uses the literal "STOP and wait for dispatcher" per Rule 12.
```

### Edit 4 — Append § Dispatcher tooling to `docs/CLAUDE.md`

Insert at the line identified in Phase 1 step 5 (after the last numbered Methodology Rule, before historical/appendix sections). Match surrounding heading depth.

```markdown
---

## Dispatcher tooling

These helpers reduce per-PR copy-paste between dispatcher (Claude chat), operator (Kyron), and Claude Code. The canonical methodology (Session Protocol, § Post-merge local cleanup, Methodology Rules 1–17) remains authoritative — these tools embed the rules, they do not replace them.

### `scripts/dispatcher/new-brief.ps1`

One-command brief docs PR shuffle (Rule 10). Operator invokes after writing the brief to `docs/briefs/` via the dispatcher's paste-block.

Usage:

```powershell
.\scripts\dispatcher\new-brief.ps1 -File "fu-foo-closure-kickoff.md" -Topic "FU-foo closure"
```

The script enforces the Phase 0 gate (must be on main), fetches origin, pulls main, creates a fresh branch derived from the filename slug, commits, and pushes. Branch naming convention: `docs/<slug>-brief`. Commit message convention: `docs(briefs): <Topic> kickoff`.

### `/dispatch <brief-path>` (CC slash command)

Defined in `.claude/commands/dispatch.md`. CC reads the brief at the given path, applies the standing methodology (Phases 0–5, Rules 9 / 12 / 15 / 17), executes, opens PR, surfaces URL for dispatcher review.

Operator usage in CC:

```
/dispatch docs/briefs/fu-foo-closure-kickoff.md
```

Replaces the long-form "PR dispatch — Kickoff brief: ..." prose payload from prior PRs.

### `/post-merge <pr-number>` (CC slash command)

Defined in `.claude/commands/post-merge.md`. CC runs the canonical post-merge sequence: sync main, capture squash SHA, fill `#TBD` / `{TBD}` placeholders, commit + push direct to main, Rule 15 verification.

Operator usage in CC (after confirming squash merge in GitHub UI):

```
/post-merge 217
```

### When NOT to use the tooling

- **Audit-only dispatches** stay inline (no brief commit PR, no slash command). Short, scoped, no-PR-output investigations are not subject to Rule 10.
- **Decision points** — scope judgment, smoke waiver evaluation, hard-stop recovery options — handled by dispatcher in chat. Tooling embeds methodology, not judgment.
- **Verbatim `git log` paste-back** (Rule 16) — operator pastes raw output to dispatcher. Slash commands report verification, but the operator-side paste-back remains manual per banked rule.

Banked: PR #TBD ({TBD}).
```

### Edit 5 — Update `docs/CONTEXT.md`

1. **Current main HEAD** field in top table → `{TBD}` (Phase 6 fills).
2. **Active track** field → "Dispatcher tooling — feat/dispatcher-tooling in flight."
3. **Next track** field → "First validation of `/dispatch` + `/post-merge` on next dispatched PR. Wizard R2-R5 residual queued after."
4. **Where we left off** prose: 1–2 short paragraphs noting this PR shipped the dispatcher tooling (new-brief.ps1 + 2 slash commands + § Dispatcher tooling section), and that the next dispatched PR will be the first validation of the new flow.
5. **Recently shipped table** — drop the oldest row, add a new row at the top:
   - PR: `#TBD`
   - SHA: `{TBD}`
   - Description: `Dispatcher tooling — new-brief.ps1 + /dispatch + /post-merge slash commands + CLAUDE.md § Dispatcher tooling.`

## Phase 3 — verification

1. `npm run lint` → expect clean (no source files touched). If lint fails on a file outside this PR's edit set: STOP and wait for dispatcher.
2. `npm run build` → expect clean. If build fails: STOP and wait for dispatcher.
3. PowerShell syntax check: `pwsh -NoProfile -Command "& { . .\scripts\dispatcher\new-brief.ps1 -File 'test.md' -Topic 'test' -WhatIf }"` — if `-WhatIf` is not supported on the script, at minimum confirm `Get-Command .\scripts\dispatcher\new-brief.ps1` parses without errors. Do NOT actually invoke the script (would create a real branch).
4. Markdown lint check on the two new slash command files: confirm frontmatter parses (YAML between `---` markers, `description:` and `argument-hint:` keys present, no tabs).

## Phase 4 — smoke

**Waived.** Justification: pure tooling addition — 1 PowerShell script (operator-side, not part of app runtime), 2 markdown files in `.claude/commands/` (CC-only, not bundled into app build), `docs/CLAUDE.md` and `docs/CONTEXT.md` updates. No source code, no Firestore rules, no user-visible surface, no runtime behavior change. Smoke waiver permitted per Rule 9 banked rule for pure-docs / internal-tooling changes.

Justification text to include in PR description.

## Phase 5 — commit, push, open PR

1. Fresh branch off Phase 0 SHA: `git checkout -b feat/dispatcher-tooling` (Rule 1).
2. Stage all 5 changes.
3. Commit message:

```
feat(dispatcher): tooling scripts + CC slash commands + CLAUDE.md section

- scripts/dispatcher/new-brief.ps1 — brief docs PR shuffle (Phase 0 gate, fresh branch, commit, push)
- .claude/commands/dispatch.md — /dispatch <brief-path> CC slash command with standing methodology embedded
- .claude/commands/post-merge.md — /post-merge <pr-number> CC slash command for placeholder fill + Rule 15 verification
- docs/CLAUDE.md — new § Dispatcher tooling section (canonical methodology remains authoritative; tooling embeds rules)
- docs/CONTEXT.md — placeholder row for this PR, drop oldest, top-table state updated

Validation: first /dispatch + /post-merge use lands on next PR after this one.
Smoke waived: pure tooling addition, no runtime surface.
```

4. `git push -u origin feat/dispatcher-tooling`.
5. Open PR via `gh pr create` or GitHub UI. Title: `feat(dispatcher): tooling scripts + CC slash commands`.
6. PR description: brief outcome summary + smoke-waiver justification text.
7. Surface PR URL in summary for dispatcher review.

## Phase 6 — post-merge

**Do not execute Phase 6 automatically.** Wait for dispatcher to confirm merge, then dispatcher invokes `/post-merge <pr-number>` separately (this is the first deployment of the new slash command — validates the round trip).

If `/post-merge` slash command discovery fails (CC doesn't recognize the command), fall back to the canonical Session Protocol step 9 + § Post-merge local cleanup sequence manually, and bank a FU for slash command discovery.
