# Sentry bulk-resolve — Alate noise cleanup.
#
# Resolves dev-mode noise issues that the crash monitor should NEVER
# have surfaced (RNSVG dev-time double-registration, ANRs from local
# debugger stalls, the Sentry SDK sample crash, ref-errors from already-
# fixed code).
#
# Run with:
#   $env:SENTRY_AUTH_TOKEN = "sntryu_xxxxxxxxxxxx"
#   pwsh ./scripts/sentry-bulk-resolve.ps1
#
# Or interactively (PowerShell prompts for the token, never echoes):
#   pwsh ./scripts/sentry-bulk-resolve.ps1 -PromptToken
#
# Token must have the `event:admin` scope.
# Generate at: https://bot-h0.sentry.io/settings/account/api/auth-tokens/

[CmdletBinding()]
param(
    [switch]$PromptToken
)

# --- Configuration ---------------------------------------------------

$Org      = 'bot-h0'
$Project  = 'alate'
$ApiBase  = 'https://de.sentry.io/api/0'   # regional URL for bot-h0

# Issues to resolve. Each entry has the short ID + a one-line reason
# (purely cosmetic — used in console output for clarity). The Sentry
# REST API accepts short IDs at the project-scoped issues endpoint.
$NoiseIssues = @(
    # 25 RNSVG hot-reload double-registration artefacts
    @{ Id = 'ALATE-7';  Reason = 'RNSVG dev-time double-register (Group)' }
    @{ Id = 'ALATE-8';  Reason = 'RNSVG dev-time double-register (Ellipse)' }
    @{ Id = 'ALATE-9';  Reason = 'RNSVG dev-time double-register (Defs)' }
    @{ Id = 'ALATE-A';  Reason = 'RNSVG dev-time double-register (Rect)' }
    @{ Id = 'ALATE-B';  Reason = 'RNSVG dev-time double-register (Image)' }
    @{ Id = 'ALATE-C';  Reason = 'RNSVG dev-time double-register (Pattern)' }
    @{ Id = 'ALATE-D';  Reason = 'RNSVG dev-time double-register (Mask)' }
    @{ Id = 'ALATE-E';  Reason = 'RNSVG dev-time double-register (Path)' }
    @{ Id = 'ALATE-F';  Reason = 'RNSVG dev-time double-register (Circle)' }
    @{ Id = 'ALATE-G';  Reason = 'RNSVG dev-time double-register (Line)' }
    @{ Id = 'ALATE-H';  Reason = 'RNSVG dev-time double-register (ClipPath)' }
    @{ Id = 'ALATE-J';  Reason = 'RNSVG dev-time double-register (Marker)' }
    @{ Id = 'ALATE-K';  Reason = 'RNSVG dev-time double-register (LinearGradient)' }
    @{ Id = 'ALATE-M';  Reason = 'RNSVG dev-time double-register (ForeignObject)' }
    @{ Id = 'ALATE-N';  Reason = 'RNSVG dev-time double-register (TSpan)' }
    @{ Id = 'ALATE-P';  Reason = 'RNSVG dev-time double-register (TextPath)' }
    @{ Id = 'ALATE-Q';  Reason = 'RNSVG dev-time double-register (Use)' }
    @{ Id = 'ALATE-R';  Reason = 'RNSVG dev-time double-register (FeBlend)' }
    @{ Id = 'ALATE-S';  Reason = 'RNSVG dev-time double-register (RadialGradient)' }
    @{ Id = 'ALATE-T';  Reason = 'RNSVG dev-time double-register (SvgViewAndroid)' }
    @{ Id = 'ALATE-V';  Reason = 'RNSVG dev-time double-register (SvgView)' }
    @{ Id = 'ALATE-W';  Reason = 'RNSVG dev-time double-register (FeColorMatrix)' }
    @{ Id = 'ALATE-X';  Reason = 'RNSVG dev-time double-register (Text)' }
    @{ Id = 'ALATE-Y';  Reason = 'RNSVG dev-time double-register (FeOffset)' }
    @{ Id = 'ALATE-Z';  Reason = 'RNSVG dev-time double-register (Filter)' }
    @{ Id = 'ALATE-10'; Reason = 'RNSVG dev-time double-register (Symbol)' }
    @{ Id = 'ALATE-11'; Reason = 'RNSVG dev-time double-register (FeMerge)' }
    @{ Id = 'ALATE-12'; Reason = 'RNSVG dev-time double-register (FeComposite)' }
    @{ Id = 'ALATE-13'; Reason = 'RNSVG dev-time double-register (FeGaussianBlur)' }
    @{ Id = 'ALATE-14'; Reason = 'RNSVG dev-time double-register (FeFlood)' }

    # Element-type-invalid hot-reload artefact (HeadingImage); also
    # guarded in code via a runtime type-check.
    @{ Id = 'ALATE-15'; Reason = 'react-refresh module-id resolution race; guarded in code' }

    # Already-fixed reference errors (PR #65 + earlier)
    @{ Id = 'ALATE-16'; Reason = 'cardGesture rename, fixed in PR #65' }
    @{ Id = 'ALATE-2';  Reason = 'Platform import, already fixed' }
    # ALATE-3 already resolved.

    # Native dev-debugger ANRs
    @{ Id = 'ALATE-4';  Reason = 'Dev debugger stall ANR' }
    @{ Id = 'ALATE-6';  Reason = 'Dev debugger stall ANR' }

    # Old @react-native-community/blur crash (we switched libraries)
    @{ Id = 'ALATE-5';  Reason = 'BlurView NoSuchMethodError; fixed by switching to @sbaiahmed1/react-native-blur' }

    # Sentry SDK initialisation sample event
    @{ Id = 'ALATE-1';  Reason = 'io.sentry.sample.MainActivity SDK init event' }
)

# --- Auth ------------------------------------------------------------

if ($PromptToken -and -not $env:SENTRY_AUTH_TOKEN) {
    $secure = Read-Host -AsSecureString "Sentry auth token (event:admin scope)"
    $bstr   = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $env:SENTRY_AUTH_TOKEN = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if (-not $env:SENTRY_AUTH_TOKEN) {
    Write-Error 'SENTRY_AUTH_TOKEN env var not set. Run with -PromptToken or set it first.'
    exit 1
}

$Headers = @{
    'Authorization' = "Bearer $($env:SENTRY_AUTH_TOKEN)"
    'Content-Type'  = 'application/json'
}

# --- Sanity check: hit /api/0/ with auth, fail loud on bad token ----

try {
    $whoami = Invoke-RestMethod -Method GET -Uri "$ApiBase/" -Headers $Headers -ErrorAction Stop
    Write-Host "Authenticated against $ApiBase/" -ForegroundColor Green
} catch {
    Write-Error "Auth probe failed: $($_.Exception.Message)"
    Write-Error 'Verify your token has event:admin and that the regional URL matches your org.'
    exit 1
}

# --- Resolve loop ----------------------------------------------------

$Body = @{ status = 'resolved' } | ConvertTo-Json -Compress

$Resolved = New-Object System.Collections.ArrayList
$Failed   = New-Object System.Collections.ArrayList

foreach ($issue in $NoiseIssues) {
    $id     = $issue.Id
    $reason = $issue.Reason
    # Per-issue PUT — most reliable. Bulk endpoint exists but is more
    # finicky about ID format.
    $url = "$ApiBase/issues/$id/"

    try {
        $resp = Invoke-RestMethod -Method PUT -Uri $url -Headers $Headers -Body $Body -ErrorAction Stop
        Write-Host ("[OK]   {0,-10} {1}" -f $id, $reason) -ForegroundColor Green
        [void]$Resolved.Add($id)
    } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        $message = $_.Exception.Message
        if ($statusCode) {
            Write-Host ("[FAIL] {0,-10} (HTTP {1}) {2}" -f $id, $statusCode, $reason) -ForegroundColor Red
        } else {
            Write-Host ("[FAIL] {0,-10} {1}" -f $id, $message) -ForegroundColor Red
        }
        [void]$Failed.Add(@{ Id = $id; Status = $statusCode; Message = $message })
    }
}

# --- Summary --------------------------------------------------------

Write-Host ''
Write-Host '=== Summary ===' -ForegroundColor Cyan
Write-Host ("Resolved: {0}" -f $Resolved.Count) -ForegroundColor Green

# PowerShell does NOT support inline if-expressions inside argument
# lists. Compute the colour first, then pass it.
$failColor = 'Green'
if ($Failed.Count -gt 0) { $failColor = 'Red' }
Write-Host ("Failed:   {0}" -f $Failed.Count) -ForegroundColor $failColor

if ($Failed.Count -gt 0) {
    Write-Host ''
    Write-Host 'Failures:' -ForegroundColor Yellow
    foreach ($f in $Failed) {
        Write-Host ("  - {0} : HTTP {1} : {2}" -f $f.Id, $f.Status, $f.Message)
    }
    Write-Host ''
    Write-Host 'Common causes:' -ForegroundColor Yellow
    Write-Host '  HTTP 401 / 403 -> token missing event:admin scope, or expired'
    Write-Host '  HTTP 404       -> issue ID does not exist for this project, or wrong region URL'
    Write-Host '  HTTP 500       -> Sentry temporary error, retry'
    exit 1
}

Write-Host ''
Write-Host 'All flagged noise resolved. The next crash-monitor run should produce zero PRs/issues if no real new crashes are present.' -ForegroundColor Green
exit 0
