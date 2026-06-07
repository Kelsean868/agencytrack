param()
$nudgeFails = 0
$allFailFiles = [System.Collections.Generic.List[string]]::new()

for ($i = 1; $i -le 50; $i++) {
    $env:TZ = 'UTC'
    $output = npx vitest run 2>&1
    if ($LASTEXITCODE -ne 0) {
        # Extract FAIL file paths from vitest output
        $failFiles = @()
        foreach ($line in $output) {
            if ($line -match 'FAIL\s+(src/[^\s]+)') {
                $failFiles += $Matches[1]
            }
        }
        $failFiles = $failFiles | Sort-Object | Get-Unique

        $nudgeHit = $output | Where-Object { $_ -match 'compliance-cooldown-chip' }
        if ($nudgeHit) { $nudgeFails++ }

        Write-Output "Run $i FAILED ($($failFiles.Count) files):"
        foreach ($f in $failFiles) { Write-Output "  FAIL $f" }
        if ($failFiles.Count -gt 0) { $allFailFiles.AddRange([string[]]$failFiles) }
    }
    if ($i % 5 -eq 0) { Write-Output "Progress: $i/50  nudge_fails=$nudgeFails" }
}

Write-Output ""
Write-Output "SUITE 50x COMPLETE — nudge failures: $nudgeFails/50"
Write-Output "All unique failing files seen across all runs:"
$allFailFiles | Sort-Object | Get-Unique | ForEach-Object { Write-Output "  $_" }
