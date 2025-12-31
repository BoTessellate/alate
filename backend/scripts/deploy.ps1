# Deploy Backend to Vercel
# Deploys the backend API to Vercel

param(
    [switch]$Production,
    [switch]$Force,
    [switch]$Preview
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Deploying Backend to Vercel" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan

# Check if vercel CLI is installed
$vercelPath = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelPath) {
    Write-Host "Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
}

$args = @()

if ($Production) {
    $args += "--prod"
    Write-Host "Target: Production" -ForegroundColor Yellow
} elseif ($Preview) {
    Write-Host "Target: Preview" -ForegroundColor Yellow
} else {
    $args += "--prod"
    Write-Host "Target: Production (default)" -ForegroundColor Yellow
}

if ($Force) {
    $args += "--force"
    Write-Host "Force rebuild: Yes" -ForegroundColor Yellow
}

Write-Host "`nDeploying..." -ForegroundColor Gray

if ($args.Count -eq 0) {
    vercel
} else {
    vercel $args
}

$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "`nDeployment successful!" -ForegroundColor Green
} else {
    Write-Host "`nDeployment failed." -ForegroundColor Red
}

exit $exitCode
