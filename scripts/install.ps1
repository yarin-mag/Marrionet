# Marionette installer for Windows (PowerShell)
# Usage: irm https://raw.githubusercontent.com/yarin-mag/Marionette/master/scripts/install.ps1 | iex
#
# Or save locally and run: .\scripts\install.ps1

$ErrorActionPreference = "Stop"

$Repo       = "yarin-mag/Marionette"
$InstallDir = "$env:LOCALAPPDATA\marionette"
$Platform   = "windows-x64"

Write-Host "==> Installing Marionette for $Platform"

# ── Verify Node.js version ────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed. Marionette requires Node.js 20." -ForegroundColor Red
    Write-Host "Install it: https://nodejs.org/en/download  or  winget install OpenJS.NodeJS.LTS"
    exit 1
}
$nodeMajor = (node -e "console.log(parseInt(process.versions.node))" 2>$null).Trim()
if ($nodeMajor -ne "20") {
    Write-Host "Error: Marionette requires Node.js 20 (you have Node.js $nodeMajor)." -ForegroundColor Red
    Write-Host "The bundled better-sqlite3 native module is compiled for Node.js 20."
    Write-Host "Fix:  winget install OpenJS.NodeJS.LTS"
    Write-Host "      or download from https://nodejs.org/en/download"
    exit 1
}

# ── Fetch latest release ──────────────────────────────────────────────────────
$release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
$tag     = $release.tag_name
if (-not $tag) {
    Write-Error "Failed to fetch latest release from $Repo"
    exit 1
}

Write-Host "==> Latest release: $tag"

$url = "https://github.com/$Repo/releases/download/$tag/marionette-$Platform.zip"

# ── Download & extract ────────────────────────────────────────────────────────
Write-Host "==> Downloading $url"
$tmpZip = "$env:TEMP\marionette-$tag.zip"
Invoke-WebRequest $url -OutFile $tmpZip

Write-Host "==> Extracting..."
$tmpDir = "$env:TEMP\marionette-extract"
if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
Expand-Archive -Path $tmpZip -DestinationPath $tmpDir
Remove-Item $tmpZip

# ── Install ───────────────────────────────────────────────────────────────────
Write-Host "==> Installing to $InstallDir"
if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
Move-Item "$tmpDir\marionette" $InstallDir
Remove-Item $tmpDir

# Add bin/ to user PATH if not already present
$binDir = "$InstallDir\bin"
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($currentPath -notlike "*$binDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$binDir", "User")
    $env:PATH = "$env:PATH;$binDir"
    Write-Host "==> Added $binDir to user PATH"
}

# ── Setup ─────────────────────────────────────────────────────────────────────
Write-Host "==> Running setup..."
& "$InstallDir\bin\marionette.cmd" setup

# Set ANTHROPIC_BASE_URL so Claude Code routes through the Marionette proxy
[Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "http://localhost:8788", "User")
$env:ANTHROPIC_BASE_URL = "http://localhost:8788"
Write-Host "==> ANTHROPIC_BASE_URL set to http://localhost:8788 (user environment variable)"

# ── Configure Claude Code hooks ───────────────────────────────────────────────
# Hooks are plain Node.js scripts — no bash required, works on Windows natively.
Write-Host "==> Configuring Claude Code hooks..."

$HooksDir    = "$InstallDir\dist\hooks"
$ClaudeDir   = "$env:USERPROFILE\.claude"
$SettingsFile = "$ClaudeDir\settings.json"

if (-not (Test-Path $HooksDir)) {
    Write-Host "Warning: Hooks directory not found at $HooksDir — skipping hook setup." -ForegroundColor Yellow
} else {
    # Ensure .claude config dir exists
    if (-not (Test-Path $ClaudeDir)) { New-Item -ItemType Directory -Force $ClaudeDir | Out-Null }

    # Load or create settings.json
    $settings = @{}
    if (Test-Path $SettingsFile) {
        try {
            $settings = Get-Content $SettingsFile -Raw | ConvertFrom-Json -AsHashtable
            Copy-Item $SettingsFile "$SettingsFile.backup"
            Write-Host "==> Backed up existing settings.json"
        } catch {
            $settings = @{}
        }
    }

    if (-not $settings.ContainsKey("hooks")) { $settings["hooks"] = @{} }

    # Use forward slashes in hook paths — Claude Code handles them cross-platform
    $fwdHooks = $HooksDir.Replace("\", "/")
    $settings["hooks"]["PreToolUse"] = @(
        @{ hooks = @(@{ type = "command"; command = "node $fwdHooks/on-session-start.js"; timeout = 10 }) }
    )
    $settings["hooks"]["Stop"] = @(
        @{ hooks = @(@{ type = "command"; command = "node $fwdHooks/on-stop.js"; timeout = 10 }) }
    )
    $settings["hooks"]["Notification"] = @(
        @{ hooks = @(@{ type = "command"; command = "node $fwdHooks/on-error.js"; timeout = 5 }) }
    )

    $settings | ConvertTo-Json -Depth 10 | Set-Content $SettingsFile -Encoding UTF8
    Write-Host "==> Claude Code hooks configured: $SettingsFile"
}

Write-Host ""
Write-Host "✓ Marionette is ready."
Write-Host "  Dashboard: http://localhost:8787"
Write-Host "  Start manually: marionette start"
Write-Host ""
Write-Host "IMPORTANT: ANTHROPIC_BASE_URL has been set to http://localhost:8788."
Write-Host "  Claude Code will route API requests through the Marionette proxy."
Write-Host "  The proxy starts automatically with 'marionette start'."
Write-Host "  If the proxy is not running, Claude Code API calls will fail."
Write-Host "  To stop using Marionette: marionette stop"
Write-Host ""
Write-Host "Note: Restart your terminal for PATH and environment variable changes to take effect."
