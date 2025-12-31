# Cypress E2E Test Runner
# Runs Cypress end-to-end tests

param(
    [switch]$Open,
    [switch]$Headed,
    [string]$Browser = "chrome",
    [string]$Spec
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Running E2E Tests (Cypress)" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan

if ($Open) {
    Write-Host "Opening Cypress Test Runner..." -ForegroundColor Yellow
    npm run cy:open
} else {
    $args = @()

    if ($Headed) {
        $args += "--headed"
    }

    if ($Browser) {
        $args += "--browser"
        $args += $Browser
    }

    if ($Spec) {
        $args += "--spec"
        $args += $Spec
    }

    if ($args.Count -eq 0) {
        npm run cy:run
    } else {
        npx cypress run $args
    }
}

$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "`nAll E2E tests passed!" -ForegroundColor Green
} else {
    Write-Host "`nSome E2E tests failed." -ForegroundColor Red
}

exit $exitCode
