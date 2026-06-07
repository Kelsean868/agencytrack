param()
$failed = 0
$timeouts = @()
$chipFails = @()

for ($i = 1; $i -le 200; $i++) {
    $env:TZ = 'UTC'
    $output = npx vitest run "src/components/manager/__tests__/CompliancePanel.nudge.test.jsx" 2>&1
    if ($LASTEXITCODE -ne 0) {
        $failed++
        $isTimeout  = $output | Where-Object { $_ -match 'timed out|5000ms' }
        $isChipFail = $output | Where-Object { $_ -match 'compliance-cooldown-chip' }
        if ($isTimeout) {
            $timeouts += $i
            Write-Output "TIMEOUT at run $i"
        } elseif ($isChipFail) {
            $chipFails += $i
            Write-Output "CHIP-FAIL at run $i"
        } else {
            Write-Output "FAIL-OTHER at run $i"
            $output | Where-Object { $_ -match 'FAIL|Unable to find' } | Select-Object -First 3 | ForEach-Object { Write-Output "  $_" }
        }
    }
    if ($i % 25 -eq 0) { Write-Output "Progress: $i/200  fails=$failed" }
}

Write-Output ""
Write-Output "ISOLATED 200x COMPLETE: $failed/200 failed"
Write-Output "  Timeouts at runs: $(if ($timeouts.Count) { $timeouts -join ', ' } else { 'none' })"
Write-Output "  Chip-fail at runs: $(if ($chipFails.Count) { $chipFails -join ', ' } else { 'none' })"
