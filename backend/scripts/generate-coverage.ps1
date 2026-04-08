# Generate Backend Test Coverage Report
# Runs Vitest with coverage and generates JSON for admin dashboard

param(
    [switch]$Html
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Generating Backend Test Coverage" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Run Vitest with coverage
Write-Host "`nRunning Vitest with coverage..." -ForegroundColor Yellow

$coverageArgs = @("--coverage")
if ($Html) {
    $coverageArgs += "--coverage.reporter=html"
}

npm run test:coverage

$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "`nCoverage report generated!" -ForegroundColor Green

    if ($Html) {
        Write-Host "HTML report available at: coverage/index.html" -ForegroundColor Gray
    }
} else {
    Write-Host "`nCoverage generation failed." -ForegroundColor Red
}

exit $exitCode
