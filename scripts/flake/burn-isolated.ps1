<#
.SYNOPSIS
    Run ONE test file in isolation N times and report how often it fails.

.DESCRIPTION
    Measures a single file's SOLO flake rate — the rate with no other test file
    competing for the runner. This is the control instrument: a file that fails
    here is broken on its own, independently of contention.

    Note the corollary, which is the more common result on this repo: a file that
    passes 0/N here is NOT proven stable. Most members of this repo's flake family
    pass in isolation and only fail under full-suite contention. A clean isolated
    burn narrows the cause to contention; it does not clear the file.
    Use burn-suite.ps1 for that.

    Failures are classified by SHAPE, because the register's own taxonomy turns on
    it: a timeout and a sub-100ms assertion cannot share a remedy, and four
    remediation rounds were misaimed partly because that distinction was not
    recorded at collection time.

.PARAMETER TestPath
    Path to the single test file, relative to repo root.

.PARAMETER Iterations
    How many times to run it. Default 200 — enough to resolve a low-single-digit
    percentage rate. Use ~30 when proving the instrument works rather than
    measuring a rate.

.PARAMETER ExpectZero
    Exit non-zero if ANY iteration fails. For control burns and CI gates, where a
    single failure is the signal. Without it the script always exits 0, because
    observed failures are the DATA, not an error.

.PARAMETER LogDir
    Directory for per-failure logs. Default: tmp/burn-logs-isolated (gitignored).

.EXAMPLE
    .\scripts\flake\burn-isolated.ps1 -TestPath "src/components/manager/__tests__/CompliancePanel.nudge.test.jsx" -Iterations 200 -ExpectZero

.NOTES
    WORKTREE RULE — the tree is FROZEN for the duration of this burn. Any
    checkout, rebase, stash-pop or branch switch invalidates EVERY iteration, not
    just the ones after it. See scripts/flake/README.md. Ported from PR #543,
    whose first ~200-iteration attempt was discarded for exactly this reason.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$TestPath,
    [int]$Iterations = 200,
    [switch]$ExpectZero,
    [string]$LogDir = "tmp/burn-logs-isolated"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $TestPath)) {
    Write-Error "Test file not found: $TestPath"
    exit 2
}
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }

# TZ is pinned because several suites assert on date boundaries; an unpinned TZ
# turns a deterministic test into a machine-dependent one and pollutes the rate.
$env:TZ = 'UTC'

# Native commands that write to stderr (vitest does, via console.error in tests)
# raise NativeCommandError while ErrorActionPreference is 'Stop', which aborts the
# burn on the FIRST such iteration. Setup validation above wants Stop; the loop
# below must not have it. Found by running the harness against a file that emits
# stderr - the control file emits none, so this was invisible until then.
$ErrorActionPreference = 'Continue'

$failed  = 0
$shapes  = @{ timeout = @(); notfound = @(); assertion = @(); other = @() }
$started = Get-Date

Write-Output "burn-isolated | $TestPath | $Iterations iterations | TZ=UTC"
Write-Output "WORKTREE RULE: do not checkout/rebase/switch in this tree until the burn completes."
Write-Output ""

for ($i = 1; $i -le $Iterations; $i++) {
    $output = npx vitest run $TestPath 2>&1

    if ($LASTEXITCODE -ne 0) {
        $failed++
        $text = $output -join "`n"

        # Order matters: a timeout also prints assertion-ish text, so test for it first.
        if ($text -match 'Test timed out in \d+ms|timed out') {
            $shape = 'timeout'
        } elseif ($text -match 'Unable to find|Found multiple elements|not found') {
            $shape = 'notfound'
        } elseif ($text -match 'AssertionError|expected .* to') {
            $shape = 'assertion'
        } else {
            $shape = 'other'
        }

        $shapes[$shape] += $i
        $logFile = Join-Path $LogDir ("iter-{0:d4}-{1}.log" -f $i, $shape)
        $text | Out-File -FilePath $logFile -Encoding utf8
        Write-Output ("  [{0,4}] FAIL ({1}) -> {2}" -f $i, $shape.ToUpper(), $logFile)
    }

    if ($i % 25 -eq 0) {
        Write-Output ("  progress {0}/{1}  failures={2}" -f $i, $Iterations, $failed)
    }
}

$elapsed = (Get-Date) - $started
$rate = if ($Iterations -gt 0) { [math]::Round(100 * $failed / $Iterations, 1) } else { 0 }

Write-Output ""
Write-Output "----------------------------------------------------------"
Write-Output ("ISOLATED BURN COMPLETE  {0}/{1} failed ({2}%)" -f $failed, $Iterations, $rate)
Write-Output ("  file:    {0}" -f $TestPath)
Write-Output ("  elapsed: {0:hh\:mm\:ss}" -f $elapsed)
foreach ($k in 'timeout','notfound','assertion','other') {
    $v = $shapes[$k]
    Write-Output ("  {0,-10} {1,3}   {2}" -f $k, $v.Count, $(if ($v.Count) { ($v -join ', ') } else { '-' }))
}
Write-Output "----------------------------------------------------------"

if ($ExpectZero -and $failed -gt 0) {
    Write-Output "GATE FAILED: -ExpectZero was set and $failed iteration(s) failed."
    exit 1
}
exit 0
