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
