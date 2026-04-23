# run-wifi.ps1 — one-shot WiFi-debugging launcher for Alate
#
# Assumes:
#   - `adb pair` + `adb connect` have already succeeded (device shown in `adb devices`)
#   - You're running this from the /mobile folder
#   - node_modules is installed (it is, per last check)
#
# What it does:
#   1. Locates adb (PATH -> Android SDK fallback)
#   2. Verifies exactly one device is connected
#   3. Installs app-debug.apk if com.tessellate.alate is missing
#   4. Sets up `adb reverse tcp:8081` so the phone can reach Metro
#   5. Launches the app on device
#   6. Starts Metro (npx expo start) in the foreground
#
# Re-runnable: safe to invoke repeatedly.

$ErrorActionPreference = 'Stop'

$PKG      = 'com.tessellate.alate'
$APK_PATH = Join-Path $PSScriptRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
$SDK_ADB  = 'C:\Users\mailt\AppData\Local\Android\Sdk\platform-tools\adb.exe'

function Resolve-Adb {
    $cmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Path }
    if (Test-Path $SDK_ADB) { return $SDK_ADB }
    throw "adb not found on PATH or at $SDK_ADB. Add Android SDK platform-tools to PATH."
}

function Invoke-Adb {
    param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $AdbArgs)
    & $script:ADB @AdbArgs
    if ($LASTEXITCODE -ne 0) { throw "adb $($AdbArgs -join ' ') failed (exit $LASTEXITCODE)" }
}

Write-Host "==> Locating adb..." -ForegroundColor Cyan
$script:ADB = Resolve-Adb
Write-Host "    $ADB"
& $ADB version | Select-Object -First 1

Write-Host "`n==> Checking connected devices..." -ForegroundColor Cyan
$raw = & $ADB devices
# Force array: a single match would otherwise collapse to a string and .Count would be $null.
$devices = @($raw | Select-Object -Skip 1 | Where-Object { $_ -match '\tdevice$' })
if ($devices.Count -eq 0) {
    throw "No devices connected. Run: adb connect <phone-ip>:<port>"
}
if ($devices.Count -gt 1) {
    Write-Warning "Multiple devices detected:`n$($devices -join "`n")"
    Write-Warning "Using the first one. Disconnect others with ``adb disconnect <serial>`` if this is wrong."
}
$serial = ($devices[0] -split '\s+')[0]
Write-Host "    Using device: $serial" -ForegroundColor Green

Write-Host "`n==> Checking if $PKG is installed on device..." -ForegroundColor Cyan
$installed = & $ADB -s $serial shell pm list packages $PKG
if ($installed -match [regex]::Escape($PKG)) {
    Write-Host "    Already installed." -ForegroundColor Green
} else {
    Write-Host "    Not installed. Installing $APK_PATH ..." -ForegroundColor Yellow
    if (-not (Test-Path $APK_PATH)) {
        throw "APK not found at $APK_PATH. Run `npx expo run:android` once to build it."
    }
    Invoke-Adb -s $serial install -r $APK_PATH
    Write-Host "    Installed." -ForegroundColor Green
}

Write-Host "`n==> Setting up port forward (phone:8081 -> PC:8081)..." -ForegroundColor Cyan
Invoke-Adb -s $serial reverse tcp:8081 tcp:8081
# Also forward 8097 for React DevTools if the user ever runs it.
& $ADB -s $serial reverse tcp:8097 tcp:8097 2>&1 | Out-Null
Write-Host "    Done." -ForegroundColor Green

Write-Host "`n==> Launching app on device..." -ForegroundColor Cyan
# `monkey` is package-agnostic — we don't need to hardcode the main activity name.
& $ADB -s $serial shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 | Out-Null
Write-Host "    App launched. (Red screen is expected for a few seconds until Metro is ready — just shake the device and Reload once Metro prints 'Bundled'.)" -ForegroundColor Green

Write-Host "`n==> Starting Metro bundler..." -ForegroundColor Cyan
Write-Host "    (Ctrl+C to stop. If you edit code, saving reloads automatically.)`n" -ForegroundColor DarkGray

# Run in foreground so logs stream to this window.
& npx expo start
