# Frontend Test Runner
# Runs Jest unit tests and outputs results

param(
    [switch]$Watch,
    [switch]$Coverage,
    [switch]$Verbose,
    [string]$Filter
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Running Frontend Tests (Jest)" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

$args = @()

if ($Watch) {
    $args += "--watch"
}

if ($Coverage) {
    $args += "--coverage"
}

if ($Verbose) {
    $args += "--verbose"
}

if ($Filter) {
    $args += "--testPathPattern=$Filter"
}

if ($args.Count -eq 0) {
    npm test
} else {
    npm test -- $args
}

$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "`nAll tests passed!" -ForegroundColor Green
} else {
    Write-Host "`nSome tests failed." -ForegroundColor Red
}

exit $exitCode
