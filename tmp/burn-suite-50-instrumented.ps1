param()
$nudgeFails = 0
$allFailFiles = [System.Collections.Generic.List[string]]::new()
$logDir = Join-Path $PSScriptRoot "burn-logs-suite"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

for ($i = 1; $i -le 50; $i++) {
    $env:TZ = 'UTC'
    $output = npx vitest run 2>&1
    if ($LASTEXITCODE -ne 0) {
        $outStr = $output -join "`n"

        # Extract failing file paths
        $failFiles = @()
        foreach ($line in $output) {
            if ($line -match 'FAIL\s+(src/[^\s]+)') {
                $failFiles += $Matches[1]
            }
        }
        $failFiles = $failFiles | Sort-Object -Unique

        # Check for nudge failure and save log
        if ($outStr -match "compliance-cooldown-chip|TestingLibraryElementError.*chip") {
            $nudgeFails++
            $logFile = Join-Path $logDir "run-$i-nudge-fail.log"
            $outStr | Out-File -FilePath $logFile -Encoding utf8
            Write-Output "Run $i NUDGE-FAIL + other ($($failFiles.Count) files):"
        } else {
            Write-Output "Run $i FAILED ($($failFiles.Count) files):"
        }
        foreach ($f in $failFiles) { Write-Output "  FAIL $f" }

        if ($failFiles -and $failFiles.Count -gt 0) {
            $allFailFiles.AddRange([string[]]$failFiles)
        }
    }
    if ($i % 5 -eq 0) { Write-Output "Progress: $i/50  nudge_fails=$nudgeFails" }
}

Write-Output ""
Write-Output "SUITE 50x COMPLETE — nudge failures: $nudgeFails/50"
Write-Output "All unique failing files across all runs:"
$allFailFiles | Sort-Object -Unique | ForEach-Object { Write-Output "  $_" }
