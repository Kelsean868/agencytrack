<#
.SYNOPSIS
  Deploy Firestore rules + indexes + Cloud Functions to the STAGING project only
  (agencytrack-staging). Refuses to run against production (agencytrack-2a610).

.DESCRIPTION
  Safety model (three independent layers):
    1. Every `firebase deploy` is passed an explicit `--project agencytrack-staging`,
       so the deploy target never depends on ambient alias state.
    2. After `firebase use staging`, the resolved active project is inspected and
       the script ABORTS LOUD if it is (or contains) the production project id.
    3. The target string is asserted `!= agencytrack-2a610` before each deploy.

  This script NEVER deploys to production. There is no code path that targets
  agencytrack-2a610. Per CLAUDE.md Rule 19, deploys are an explicit human action —
  the operator runs this script; Claude Code never invokes it autonomously.

  PRE-FLIGHT (CLAUDE.md "firebase deploy pre-flight"):
    - Authenticated firebase CLI (`firebase login`) with access to agencytrack-staging.
    - The `staging` alias present in .firebaserc (added by this change set).
    - functions/node_modules installed (functions deploy packages from it).

.PARAMETER DryRun
  Print the deploy plan and run the guards, but do NOT deploy.

.EXAMPLE
  pwsh scripts/staging/deploy-staging.ps1 -DryRun
  pwsh scripts/staging/deploy-staging.ps1
#>

param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$StagingProject = 'agencytrack-staging'
$ProdProject    = 'agencytrack-2a610'

function Abort($msg) {
  Write-Host ''
  Write-Host '============================================================' -ForegroundColor Red
  Write-Host "  DEPLOY ABORTED — $msg" -ForegroundColor Red
  Write-Host '============================================================' -ForegroundColor Red
  exit 1
}

# ── Layer 0: paranoia — the two ids must differ ───────────────────────────────
if ($StagingProject -eq $ProdProject) {
  Abort "staging and prod project ids are identical ('$StagingProject') — refusing."
}

Write-Host "Staging deploy — target project: $StagingProject" -ForegroundColor Cyan
Write-Host "Production project ($ProdProject) is NEVER a target of this script." -ForegroundColor DarkGray

# ── Pre-flight: firebase CLI present ──────────────────────────────────────────
$firebaseCmd = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebaseCmd) {
  Abort 'firebase CLI not found on PATH. Install with: npm i -g firebase-tools'
}

# ── Pre-flight: functions dependencies installed ──────────────────────────────
$repoRoot     = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$functionsDir = Join-Path $repoRoot 'functions'
$fnNodeMods   = Join-Path $functionsDir 'node_modules'
if (-not (Test-Path $fnNodeMods)) {
  Write-Host "functions/node_modules missing — installing…" -ForegroundColor Yellow
  Push-Location $functionsDir
  npm install
  $installExit = $LASTEXITCODE
  Pop-Location
  if ($installExit -ne 0) { Abort "npm install in functions/ failed (exit $installExit)." }
}

# ── Set active alias to staging ───────────────────────────────────────────────
Write-Host ''
Write-Host "Running: firebase use staging" -ForegroundColor Cyan
firebase use staging
if ($LASTEXITCODE -ne 0) {
  Abort "firebase use staging failed — is the 'staging' alias in .firebaserc and are you logged in?"
}

# ── Layer 2 GUARD: inspect resolved active project, abort if it is production ──
$activeRaw = (firebase use 2>&1 | Out-String)
Write-Host "Active project resolution:" -ForegroundColor DarkGray
Write-Host $activeRaw.Trim() -ForegroundColor DarkGray

if ($activeRaw -match [regex]::Escape($ProdProject)) {
  Abort "active project resolves to PRODUCTION ($ProdProject). Refusing to deploy."
}
if ($activeRaw -notmatch [regex]::Escape($StagingProject)) {
  Abort "active project does not resolve to $StagingProject. Refusing to deploy."
}
Write-Host "Guard passed: active project is $StagingProject, not production." -ForegroundColor Green

# ── Layer 3 GUARD: explicit target must not be prod ───────────────────────────
if ($StagingProject -eq $ProdProject) { Abort 'target equals production — refusing.' }

if ($DryRun) {
  Write-Host ''
  Write-Host 'DRY RUN — would deploy the following to STAGING only:' -ForegroundColor Yellow
  Write-Host "  firebase deploy --only firestore:rules   --project $StagingProject"
  Write-Host "  firebase deploy --only firestore:indexes --project $StagingProject"
  Write-Host "  firebase deploy --only functions         --project $StagingProject"
  Write-Host ''
  Write-Host 'No deploy performed (DryRun).' -ForegroundColor Yellow
  exit 0
}

# ── Deploy — each surface, explicit --project, exit-code checked ───────────────
Write-Host ''
Write-Host "Deploying firestore:rules to $StagingProject…" -ForegroundColor Cyan
firebase deploy --only firestore:rules --project $StagingProject
if ($LASTEXITCODE -ne 0) { Abort "firestore:rules deploy failed (exit $LASTEXITCODE)." }

Write-Host ''
Write-Host "Deploying firestore:indexes to $StagingProject…" -ForegroundColor Cyan
firebase deploy --only firestore:indexes --project $StagingProject
if ($LASTEXITCODE -ne 0) { Abort "firestore:indexes deploy failed (exit $LASTEXITCODE)." }

Write-Host ''
Write-Host "Deploying functions to $StagingProject…" -ForegroundColor Cyan
firebase deploy --only functions --project $StagingProject
if ($LASTEXITCODE -ne 0) { Abort "functions deploy failed (exit $LASTEXITCODE)." }

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host "  STAGING DEPLOY COMPLETE — $StagingProject" -ForegroundColor Green
Write-Host "  rules + indexes + functions deployed to staging only." -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
