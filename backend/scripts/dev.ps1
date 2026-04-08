# Start Backend Development Server
# Starts Vercel dev server locally

param(
    [int]$Port = 3001
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Starting Backend Dev Server" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan
Write-Host "Port: $Port" -ForegroundColor Gray

# Check if vercel CLI is installed
$vercelPath = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelPath) {
    Write-Host "Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
}

Write-Host "`nStarting Vercel dev server..." -ForegroundColor Yellow
vercel dev --listen $Port
