# Usage: .\scripts\build-release.ps1 [Platform]
# Platform defaults to "windows-x64"
param(
    [string]$Platform = "windows-x64"
)

$ErrorActionPreference = "Stop"
$ReleaseDir = "release\marionette"
$Archive    = "marionette-$Platform.zip"

Write-Host "==> Building Marionette release for platform: $Platform"

# ── 1. Build TypeScript packages ──────────────────────────────────────────────
Write-Host "==> Building TypeScript packages..."
pnpm --filter "@marionette/shared" run build
pnpm --filter "@marionette/file-watcher" run build
pnpm --filter "@marionette/mcp-server" run build
pnpm --filter "@marionette/hooks" run build
pnpm --filter "marionette-server" run build

# ── 2. Build React web app ────────────────────────────────────────────────────
Write-Host "==> Building web app..."
pnpm --filter "marionette-web" run build

# ── 3. Assemble release directory ─────────────────────────────────────────────
Write-Host "==> Assembling release directory..."
if (Test-Path "release") { Remove-Item -Recurse -Force "release" }
@(
    "$ReleaseDir\bin",
    "$ReleaseDir\db",
    "$ReleaseDir\dist\watcher",
    "$ReleaseDir\dist\mcp",
    "$ReleaseDir\dist\shared",
    "$ReleaseDir\dist\hooks",
    "$ReleaseDir\web"
) | ForEach-Object { New-Item -ItemType Directory -Force $_ | Out-Null }

Copy-Item -Recurse -Force "apps\server\dist\*"             "$ReleaseDir\dist\"
Copy-Item -Recurse -Force "packages\file-watcher\dist\*"   "$ReleaseDir\dist\watcher\"
Copy-Item -Recurse -Force "packages\mcp-server\dist\*"     "$ReleaseDir\dist\mcp\"
Copy-Item -Recurse -Force "packages\shared\dist\*"         "$ReleaseDir\dist\shared\"
Copy-Item -Recurse -Force "packages\hooks\dist\*"          "$ReleaseDir\dist\hooks\"
Copy-Item -Recurse -Force "apps\web\dist\*"                "$ReleaseDir\web\"
Copy-Item -Force          "db\schema.sql"                  "$ReleaseDir\db\schema.sql"

# ── 4. Install production node_modules ────────────────────────────────────────
Write-Host "==> Installing production dependencies..."
@"
{
  "name": "marionette",
  "version": "0.1.0",
  "type": "module",
  "private": true
}
"@ | Set-Content "$ReleaseDir\package.json"

npm install --prefix $ReleaseDir --production --legacy-peer-deps `
    "better-sqlite3@^11" "ws@^8" "cors@^2" "express@^4" "dotenv@^16" "chokidar@^4" "@modelcontextprotocol/sdk@^1"

# Inject @marionette/shared
$sharedTarget = "$ReleaseDir\node_modules\@marionette\shared"
New-Item -ItemType Directory -Force $sharedTarget | Out-Null
Copy-Item -Recurse -Force "packages\shared\dist\*" "$sharedTarget\"
@"
{ "name": "@marionette/shared", "version": "0.1.0", "type": "module", "main": "index.js", "exports": { ".": "./index.js" } }
"@ | Set-Content "$sharedTarget\package.json"

# ── 5. Windows batch wrapper ──────────────────────────────────────────────────
Write-Host "==> Writing wrappers..."
# Single-quoted here-string: $, %, %% are all literal — no PowerShell expansion
@'
@echo off
for /f "delims=" %%v in ('node -e "console.log(parseInt(process.versions.node))" 2^>nul') do set NODE_MAJOR=%%v
if not "%NODE_MAJOR%"=="20" (
  echo Error: Marionette requires Node.js 20. You have Node.js %NODE_MAJOR%. 1>&2
  echo The bundled better-sqlite3 is compiled for Node.js 20. 1>&2
  echo Fix: https://nodejs.org/en/download 1>&2
  exit /b 1
)
node "%~dp0..\dist\cli.js" %*
'@ | Set-Content "$ReleaseDir\bin\marionette.cmd" -Encoding ascii

# sh wrapper for Git Bash / WSL users on Windows
@'
#!/bin/sh
NODE_MAJOR=$(node -e "console.log(parseInt(process.versions.node))" 2>/dev/null)
if [ "$NODE_MAJOR" != "20" ]; then
  echo "Error: Marionette requires Node.js 20 (you have Node.js ${NODE_MAJOR:-not found})." >&2
  echo "The bundled better-sqlite3 is compiled for Node.js 20." >&2
  echo "Fix:  nvm install 20 && nvm use 20   or   https://nodejs.org/en/download" >&2
  exit 1
fi
exec node "$(dirname "$0")/../dist/cli.js" "$@"
'@ | Set-Content "$ReleaseDir\bin\marionette" -Encoding ascii

# ── 6. Version file ───────────────────────────────────────────────────────────
try {
    git describe --tags --always 2>$null | Set-Content "$ReleaseDir\VERSION"
} catch {
    "dev" | Set-Content "$ReleaseDir\VERSION"
}

# ── 7. Archive ────────────────────────────────────────────────────────────────
Write-Host "==> Creating archive: $Archive"
Compress-Archive -Path "$ReleaseDir" -DestinationPath $Archive -Force

Write-Host "==> Done! Archive: $Archive"
