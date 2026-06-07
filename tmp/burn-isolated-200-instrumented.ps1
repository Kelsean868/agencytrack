param()
$fails = 0
$logDir = Join-Path $PSScriptRoot "burn-logs-isolated"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

for ($i = 1; $i -le 200; $i++) {
    $env:TZ = 'UTC'
    $output = npx vitest run src/components/manager/__tests__/CompliancePanel.nudge.test.jsx 2>&1
    if ($LASTEXITCODE -ne 0) {
        $fails++
        $outStr = $output -join "`n"

        # Classify failure type
        $class = "UNKNOWN"
        $keyLine = ""

        if ($outStr -match "timed out in 5000ms") {
            $class = "STARVATION-TIMEOUT"
        } elseif ($outStr -match "compliance-cooldown-chip|TestingLibraryElementError.*chip|Unable to find.*compliance-cooldown-chip") {
            $class = "CHIP-MISSING"
        }

        # Extract first stack line referencing the nudge test file
        foreach ($line in $output) {
            if ($line -match "CompliancePanel\.nudge\.test\.jsx:\d+") {
                $keyLine = $line.Trim()
                break
            }
        }
        # Fallback: first Error line
        if (-not $keyLine) {
            foreach ($line in $output) {
                if ($line -match "Error:") {
                    $keyLine = $line.Trim()
                    break
                }
            }
        }

        # Persist full output to per-run log
        $logFile = Join-Path $logDir "run-$i-$class.log"
        $outStr | Out-File -FilePath $logFile -Encoding utf8

        Write-Output "$class at run $i  || $keyLine"
    }
    if ($i % 10 -eq 0) { Write-Output "Progress: $i/200  fails=$fails" }
}

Write-Output ""
Write-Output "ISOLATED 200x COMPLETE — failures: $fails/200"
