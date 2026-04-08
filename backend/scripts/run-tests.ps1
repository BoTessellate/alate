# Backend Test Runner
# Runs Vitest unit tests and outputs results

param(
    [switch]$Watch,
    [switch]$Coverage,
    [switch]$UI,
    [string]$Filter
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Running Backend Tests (Vitest)" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

$args = @()

if ($Watch) {
    $args += "--watch"
}

if ($Coverage) {
    $args += "--coverage"
}

if ($UI) {
    $args += "--ui"
}

if ($Filter) {
    $args += "--testNamePattern=$Filter"
}

if ($args.Count -eq 0) {
    npm test
} else {
    npx vitest run $args
}

$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "`nAll tests passed!" -ForegroundColor Green
} else {
    Write-Host "`nSome tests failed." -ForegroundColor Red
}

exit $exitCode
