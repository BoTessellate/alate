# Start Frontend Development Server
# Starts Next.js dev server with optional port

param(
    [int]$Port = 3000,
    [switch]$Turbo
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Starting Frontend Dev Server" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host "Port: $Port" -ForegroundColor Gray

if ($Turbo) {
    Write-Host "Turbopack: Enabled" -ForegroundColor Gray
    $env:NEXT_TURBO = "1"
}

Write-Host "`nStarting server..." -ForegroundColor Yellow
npm run dev -- --port $Port
