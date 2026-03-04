# Marionette uninstaller for Windows (PowerShell)
# Usage: .\scripts\uninstall.ps1
#   or one-liner: irm https://raw.githubusercontent.com/yarin-mag/Marionette/master/scripts/uninstall.ps1 | iex

$ErrorActionPreference = "Stop"

$InstallDir  = "$env:LOCALAPPDATA\marionette"
$ClaudeDir   = "$env:USERPROFILE\.claude"
$McpSettings = "$ClaudeDir\mcp_settings.json"
$Settings    = "$ClaudeDir\settings.json"

Write-Host "==> Uninstalling Marionette..."

# ── 1. Stop and remove scheduled tasks ───────────────────────────────────────
foreach ($task in @("Marionette", "MarionetteProxy")) {
    try {
        Unregister-ScheduledTask -TaskName $task -Confirm:$false -ErrorAction Stop
        Write-Host "==> Removed scheduled task: $task"
    } catch {
        # task doesn't exist — skip
    }
}

# ── 2. Kill any running processes on ports 8787 and 8788 ─────────────────────
foreach ($port in @(8787, 8788)) {
    $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conns) {
        $conns.OwningProcess | Sort-Object -Unique | ForEach-Object {
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
        Write-Host "==> Killed process(es) on port $port"
    }
}

# ── 3. Remove ANTHROPIC_BASE_URL user environment variable ────────────────────
$existing = [Environment]::GetEnvironmentVariable("ANTHROPIC_BASE_URL", "User")
if ($null -ne $existing) {
    [Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", $null, "User")
    Remove-Item Env:ANTHROPIC_BASE_URL -ErrorAction SilentlyContinue
    Write-Host "==> Removed ANTHROPIC_BASE_URL user environment variable"
}

# ── 4. Remove bin dir from user PATH ─────────────────────────────────────────
$binDir = "$InstallDir\bin"
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($currentPath -like "*$binDir*") {
    $newPath = ($currentPath -split ";") | Where-Object { $_ -ne $binDir } | Where-Object { $_ -ne "" }
    $newPath = $newPath -join ";"
    [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
    $env:PATH = ($env:PATH -split ";") | Where-Object { $_ -ne $binDir } | Where-Object { $_ -ne "" }
    $env:PATH = $env:PATH -join ";"
    Write-Host "==> Removed $binDir from user PATH"
}

# ── 5. Remove MCP server registration ────────────────────────────────────────
if (Test-Path $McpSettings) {
    try {
        $mcp = Get-Content $McpSettings -Raw | ConvertFrom-Json -AsHashtable
        if ($mcp.ContainsKey("mcpServers") -and $mcp["mcpServers"].ContainsKey("marionette")) {
            $mcp["mcpServers"].Remove("marionette")
            $mcp | ConvertTo-Json -Depth 10 | Set-Content $McpSettings -Encoding UTF8
            Write-Host "==> Removed marionette MCP server from $McpSettings"
        }
    } catch {
        Write-Host "Warning: Could not update $McpSettings — $_" -ForegroundColor Yellow
    }
}

# ── 6. Remove hooks from Claude Code settings ─────────────────────────────────
if (Test-Path $Settings) {
    try {
        $cfg = Get-Content $Settings -Raw | ConvertFrom-Json -AsHashtable
        if ($cfg.ContainsKey("hooks")) {
            foreach ($key in @("PreToolUse", "Stop", "Notification")) {
                $cfg["hooks"].Remove($key)
            }
            if ($cfg["hooks"].Count -eq 0) { $cfg.Remove("hooks") }
            $cfg | ConvertTo-Json -Depth 10 | Set-Content $Settings -Encoding UTF8
            Write-Host "==> Removed Marionette hooks from $Settings"
        }
    } catch {
        Write-Host "Warning: Could not update $Settings — $_" -ForegroundColor Yellow
    }
}

# ── 7. Remove install directory ───────────────────────────────────────────────
if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir
    Write-Host "==> Removed $InstallDir"
}

Write-Host ""
Write-Host "✓ Marionette has been uninstalled."
Write-Host "  Restart your terminal for PATH changes to take effect."