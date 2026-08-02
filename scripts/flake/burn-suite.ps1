<#
.SYNOPSIS
    Run the FULL test suite N times and tally which files fail, and how often.

.DESCRIPTION
    This is the instrument that actually reproduces this repo's flake family.
    Nearly every named member passes in isolation and fails only under full-suite
    contention, so an isolated burn cannot see them — burn-isolated.ps1 answers a
    different question.

    The output that matters is the per-file tally at the end. A family driven by
    shared contention shows a ROTATING population — many files failing once or
    twice each, rather than one file failing repeatedly. A single file dominating
    the tally points at that file instead, which is a different and much easier
    problem.

    Expensive by construction: each iteration is a full suite run (minutes, not
    seconds). Use a small N to prove the instrument fires, a large N to measure.

.PARAMETER Iterations
    How many full-suite runs. Default 50.

.PARAMETER ExpectZero
    Exit non-zero if ANY iteration fails. Off by default — observed failures are
    the DATA here, not an error.

.PARAMETER LogDir
    Directory for per-failure logs. Default: tmp/burn-logs-suite (gitignored).

.EXAMPLE
    .\scripts\flake\burn-suite.ps1 -Iterations 50

.EXAMPLE
    .\scripts\flake\burn-suite.ps1 -Iterations 8      # prove it fires, cheaply

.NOTES
    WORKTREE RULE — the tree is FROZEN for the duration of this burn. Any
    checkout, rebase, stash-pop or branch switch invalidates EVERY iteration, not
    just the ones after it. See scripts/flake/README.md.

    Do NOT run two burns concurrently on one machine. Concurrent full-suite runs
    produce their own Windows worker-contention failures (CLAUDE.md § Vitest on
    Windows), which would be indistinguishable from the effect being measured.
#>
[CmdletBinding()]
param(
    [int]$Iterations = 50,
    [switch]$ExpectZero,
    [string]$LogDir = "tmp/burn-logs-suite"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }

$env:TZ = 'UTC'

# Native commands that write to stderr (vitest does, via console.error in tests)
# raise NativeCommandError while ErrorActionPreference is 'Stop', which aborts the
# burn on the FIRST such iteration. Setup validation above wants Stop; the loop
# below must not have it. Found by running the harness against a file that emits
# stderr - the control file emits none, so this was invisible until then.
$ErrorActionPreference = 'Continue'

$failedRuns = 0
$tally      = @{}   # file -> times seen failing
$perRun     = @{}   # iteration -> files that failed in it
$started    = Get-Date

Write-Output "burn-suite | FULL SUITE | $Iterations iterations | TZ=UTC"
Write-Output "WORKTREE RULE: do not checkout/rebase/switch in this tree until the burn completes."
Write-Output "Do not run a second burn concurrently on this machine."
Write-Output ""

for ($i = 1; $i -le $Iterations; $i++) {
    $runStart = Get-Date
    $output = npx vitest run 2>&1
    $runElapsed = (Get-Date) - $runStart

    if ($LASTEXITCODE -ne 0) {
        $failedRuns++
        $text = $output -join "`n"

        $failFiles = @()
        foreach ($line in $output) {
            if ($line -match 'FAIL\s+(src/\S+)') { $failFiles += $Matches[1] }
        }
        $failFiles = @($failFiles | Sort-Object -Unique)

        foreach ($f in $failFiles) {
            if ($tally.ContainsKey($f)) { $tally[$f]++ } else { $tally[$f] = 1 }
        }
        $perRun[$i] = $failFiles

        $logFile = Join-Path $LogDir ("run-{0:d3}.log" -f $i)
        $text | Out-File -FilePath $logFile -Encoding utf8

        Write-Output ("  [{0,3}] FAILED  {1} file(s)  ({2:mm\:ss})  -> {3}" -f $i, $failFiles.Count, $runElapsed, $logFile)
        foreach ($f in $failFiles) { Write-Output ("          FAIL {0}" -f $f) }
    } else {
        Write-Output ("  [{0,3}] pass    ({1:mm\:ss})" -f $i, $runElapsed)
    }
}

$elapsed = (Get-Date) - $started
$rate = if ($Iterations -gt 0) { [math]::Round(100 * $failedRuns / $Iterations, 1) } else { 0 }

Write-Output ""
Write-Output "----------------------------------------------------------"
Write-Output ("SUITE BURN COMPLETE  {0}/{1} runs failed ({2}%)" -f $failedRuns, $Iterations, $rate)
Write-Output ("  elapsed: {0:hh\:mm\:ss}" -f $elapsed)
Write-Output ""
if ($tally.Count -eq 0) {
    Write-Output "  no failing files observed"
} else {
    Write-Output "  per-file tally (times seen failing across all runs):"
    $tally.GetEnumerator() | Sort-Object -Property Value -Descending | ForEach-Object {
        Write-Output ("    {0,3}x  {1}" -f $_.Value, $_.Key)
    }
    Write-Output ""
    $distinct = $tally.Count
    $repeat   = @($tally.GetEnumerator() | Where-Object { $_.Value -gt 1 }).Count
    Write-Output ("  distinct files seen failing: {0}   (of which repeated: {1})" -f $distinct, $repeat)
    Write-Output "  A rotating population (many files, each seen once) indicates shared"
    Write-Output "  contention. One file dominating indicates that file."
}
Write-Output "----------------------------------------------------------"

if ($ExpectZero -and $failedRuns -gt 0) {
    Write-Output "GATE FAILED: -ExpectZero was set and $failedRuns run(s) failed."
    exit 1
}
exit 0
