#!/usr/bin/env node
import "dotenv/config";
import { spawn, exec } from "child_process";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { homedir, platform } from "os";
import { promisify } from "util";
import express from "express";
import { createApp, mountErrorHandler } from "./app.js";
import { DatabaseClient } from "./db.js";
import { WebSocketService } from "./services/websocket.service.js";
import { AgentService } from "./services/agent.service.js";
import { EventService } from "./services/event.service.js";
import { CommandService } from "./services/command.service.js";
import { createApiRoutes } from "./routes/index.js";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);
const subcommand = process.argv[2];

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

async function start(): Promise<void> {
  DatabaseClient.initialize();

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(`Server listening on http://localhost:${config.port}`);
    logger.info(`WebSocket: ws://localhost:${config.port}/stream`);
  });

  const agentService = new AgentService();
  const eventService = new EventService();
  const commandService = new CommandService(agentService, eventService);

  const wsService = new WebSocketService(server, eventService);
  wsService.start();

  app.use("/api", createApiRoutes(wsService, commandService, eventService));

  // Serve bundled React app
  const webDist = process.env.WEB_DIST ?? resolve(__dirname, "../web");
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get("*", (_req, res) => res.sendFile(resolve(webDist, "index.html")));
  }

  mountErrorHandler(app);

  // Spawn file-watcher child process
  const watcherPath = resolve(__dirname, "watcher/index.js");
  let watcher: ReturnType<typeof spawn> | null = null;
  if (existsSync(watcherPath)) {
    watcher = spawn(process.execPath, [watcherPath], {
      stdio: "inherit",
      env: { ...process.env, MARIONETTE_API_URL: `http://localhost:${config.port}` },
    });
    watcher.on("exit", (code) => {
      logger.info(`File watcher exited with code ${code}`);
    });
    watcher.on("error", (err) => {
      logger.error("File watcher failed to start:", err);
    });
  } else {
    logger.warn(`File watcher not found at ${watcherPath} — skipping`);
  }

  // Open browser after a short delay
  setTimeout(() => openBrowser(`http://localhost:${config.port}`), 1500);

  const shutdown = () => {
    logger.info("Shutting down...");
    if (watcher) watcher.kill();
    wsService.close();
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function openBrowser(url: string): void {
  const os = platform();
  const cmd =
    os === "darwin" ? `open "${url}"` :
    os === "linux"  ? `xdg-open "${url}"` :
    os === "win32"  ? `start "" "${url}"` : null;
  if (!cmd) return;
  exec(cmd, (err) => {
    if (err) logger.warn("Could not open browser:", err.message);
  });
}

// ---------------------------------------------------------------------------
// setup
// ---------------------------------------------------------------------------

async function setup(): Promise<void> {
  console.log("🎭 Marionette Setup\n");
  await registerMcp();
  await setupHooks();
  await setupAutoStart();
  console.log("\n✓ Setup complete! Open http://localhost:8787");
}

async function registerMcp(): Promise<void> {
  const mcpConfigPath = join(homedir(), ".claude", "mcp_settings.json");
  const isWin = platform() === "win32";
  const binName = isWin ? "marionette.cmd" : "marionette";
  const selfBin = resolve(__dirname, `../bin/${binName}`);

  let mcpConfig: { mcpServers?: Record<string, unknown> } = {};
  try {
    const content = await readFile(mcpConfigPath, "utf-8");
    mcpConfig = JSON.parse(content) as typeof mcpConfig;
  } catch {
    mcpConfig = { mcpServers: {} };
  }

  mcpConfig.mcpServers = mcpConfig.mcpServers ?? {};
  mcpConfig.mcpServers["marionette"] = {
    command: existsSync(selfBin) ? selfBin : process.argv[1],
    args: ["mcp"],
    env: { MARIONETTE_API_URL: "http://localhost:8787" },
  };

  await writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
  console.log("✓ MCP server registered in Claude Code");
  console.log(`  Config: ${mcpConfigPath}`);
}

async function setupHooks(): Promise<void> {
  // Hooks live at dist/hooks/ relative to this file's compiled location (dist/).
  // On all platforms: node_modules is at the archive root, so @marionette/shared
  // resolves correctly from dist/hooks/*.js going up the tree.
  const hooksDir = resolve(__dirname, "hooks");
  const isWin = platform() === "win32";

  if (!existsSync(hooksDir)) {
    console.log("  Hooks directory not found — skipping hook setup");
    return;
  }

  const settingsPath = join(homedir(), ".claude", "settings.json");
  let settings: Record<string, unknown> = {};
  try {
    const raw = await readFile(settingsPath, "utf-8");
    settings = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    settings = {};
  }

  // Use forward slashes in all paths — Claude Code handles them cross-platform,
  // and Windows batch/PowerShell also accept forward slashes in node invocations.
  const fwdHooksDir = hooksDir.replace(/\\/g, "/");

  const hooks = settings.hooks as Record<string, unknown> ?? {};
  hooks["PreToolUse"] = [
    { hooks: [{ type: "command", command: `node "${fwdHooksDir}/on-session-start.js"`, timeout: 10 }] },
  ];
  hooks["Stop"] = [
    { hooks: [{ type: "command", command: `node "${fwdHooksDir}/on-stop.js"`, timeout: 10 }] },
  ];
  hooks["Notification"] = [
    { hooks: [{ type: "command", command: `node "${fwdHooksDir}/on-error.js"`, timeout: 5 }] },
  ];
  settings.hooks = hooks;

  // Ensure .claude dir exists
  const claudeDir = join(homedir(), ".claude");
  if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });

  await writeFile(settingsPath, JSON.stringify(settings, null, 2));
  console.log("✓ Claude Code hooks configured");
  console.log(`  Config: ${settingsPath}`);
  console.log(`  Hooks:  ${hooksDir}`);

  if (isWin) {
    console.log("  Platform: Windows (node hooks — no bash required)");
  }
}

async function setupAutoStart(): Promise<void> {
  const os = platform();
  const isWin = os === "win32";
  const binName = isWin ? "marionette.cmd" : "marionette";
  const selfBin = resolve(__dirname, `../bin/${binName}`);
  const binaryPath = existsSync(selfBin) ? selfBin : process.argv[1];

  if (os === "darwin") {
    await setupLaunchAgent(binaryPath);
  } else if (os === "linux") {
    await setupSystemd(binaryPath);
  } else if (os === "win32") {
    await setupWindowsTask(binaryPath);
  } else {
    console.log("  Auto-start not supported on this platform — start manually with: marionette start");
  }
}

async function setupLaunchAgent(binaryPath: string): Promise<void> {
  const logsDir = join(homedir(), ".marionette", "logs");
  mkdirSync(logsDir, { recursive: true });

  const plistPath = join(
    homedir(),
    "Library",
    "LaunchAgents",
    "com.marionette.app.plist"
  );

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.marionette.app</string>
  <key>ProgramArguments</key>
  <array><string>${binaryPath}</string><string>start</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${join(logsDir, "marionette.log")}</string>
  <key>StandardErrorPath</key><string>${join(logsDir, "marionette.error.log")}</string>
</dict></plist>`;

  writeFileSync(plistPath, plist);
  await execAsync(`launchctl load "${plistPath}"`).catch(() => {});
  console.log("✓ Auto-start configured (macOS LaunchAgent)");
}

async function setupSystemd(binaryPath: string): Promise<void> {
  const systemdDir = join(homedir(), ".config", "systemd", "user");
  mkdirSync(systemdDir, { recursive: true });

  const servicePath = join(systemdDir, "marionette.service");
  const unit = `[Unit]
Description=Marionette - Claude Agent Monitor

[Service]
ExecStart=${binaryPath} start
Restart=always

[Install]
WantedBy=default.target`;

  writeFileSync(servicePath, unit);
  await execAsync("systemctl --user enable --now marionette").catch(() => {});
  console.log("✓ Auto-start configured (systemd user service)");
}

async function setupWindowsTask(binaryPath: string): Promise<void> {
  const ps = [
    `$action = New-ScheduledTaskAction -Execute "${binaryPath}" -Argument "start"`,
    `$trigger = New-ScheduledTaskTrigger -AtLogOn`,
    `Register-ScheduledTask -TaskName "Marionette" -Action $action -Trigger $trigger -RunLevel Highest -Force`,
  ].join("; ");

  await execAsync(`powershell -Command "${ps.replace(/"/g, '\\"')}"`).catch(() => {});
  console.log("✓ Auto-start configured (Windows Scheduled Task)");
}

// ---------------------------------------------------------------------------
// mcp
// ---------------------------------------------------------------------------

async function startMcp(): Promise<void> {
  const mcpPath = resolve(__dirname, "mcp/index.js");
  if (existsSync(mcpPath)) {
    await import(mcpPath);
  } else {
    console.error(
      "MCP server not found. Run 'marionette mcp' from a release installation,\n" +
        "or use the MCP server directly: pnpm --filter @marionette/mcp-server run dev"
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// stop
// ---------------------------------------------------------------------------

async function stop(): Promise<void> {
  const os = platform();
  if (os === "darwin") {
    const plistPath = join(homedir(), "Library", "LaunchAgents", "com.marionette.app.plist");
    await execAsync(`launchctl unload "${plistPath}"`).catch(() => {});
    console.log("✓ Auto-start removed (macOS)");
  } else if (os === "linux") {
    await execAsync("systemctl --user disable --now marionette").catch(() => {});
    console.log("✓ Auto-start removed (Linux)");
  } else if (os === "win32") {
    await execAsync(
      'powershell -Command "Unregister-ScheduledTask -TaskName Marionette -Confirm:$false"'
    ).catch(() => {});
    console.log("✓ Auto-start removed (Windows)");
  } else {
    console.log("Auto-start not configured on this platform.");
  }
}

// ---------------------------------------------------------------------------
// help / dispatch
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`Marionette - Claude Agent Monitor

Usage:
  marionette start     Start the dashboard server (+ file watcher)
  marionette setup     Register MCP server in Claude Code + configure auto-start
  marionette mcp       Run the MCP server (invoked by Claude Code)
  marionette stop      Remove auto-start configuration

Dashboard: http://localhost:8787`);
}

switch (subcommand) {
  case "start":
    start().catch((err) => {
      console.error(err);
      process.exit(1);
    });
    break;
  case "setup":
    setup().catch((err) => {
      console.error(err);
      process.exit(1);
    });
    break;
  case "mcp":
    startMcp().catch((err) => {
      console.error(err);
      process.exit(1);
    });
    break;
  case "stop":
    stop().catch((err) => {
      console.error(err);
      process.exit(1);
    });
    break;
  default:
    printHelp();
    break;
}
