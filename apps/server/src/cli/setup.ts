import { resolve, join } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { homedir, platform } from "os";
import { execAsync, distDir, shellRcPath, SHELL_ENV_MARKER, SHELL_ENV_LINE } from "./utils.js";

export async function setup(): Promise<void> {
  console.log("🎭 Marionette Setup\n");
  await registerMcp();
  await setupHooks();
  await setupAutoStart();
  await setupShellEnv();
  console.log("\n✓ Setup complete! Open http://localhost:8787");
}

async function registerMcp(): Promise<void> {
  const mcpConfigPath = join(homedir(), ".claude", "mcp_settings.json");
  const isWin = platform() === "win32";
  const binName = isWin ? "marionette.cmd" : "marionette";
  const selfBin = resolve(distDir, `../bin/${binName}`);

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
  const hooksDir = resolve(distDir, "hooks");
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
  const selfBin = resolve(distDir, `../bin/${binName}`);
  const binaryPath = existsSync(selfBin) ? selfBin : process.argv[1];

  if (os === "darwin") {
    const logsDir = join(homedir(), ".marionette", "logs");
    mkdirSync(logsDir, { recursive: true });
    await Promise.all([setupLaunchAgent(binaryPath, false), setupLaunchAgent(binaryPath, true)]);
  } else if (os === "linux") {
    const systemdDir = join(homedir(), ".config", "systemd", "user");
    mkdirSync(systemdDir, { recursive: true });
    await Promise.all([setupSystemd(binaryPath, false), setupSystemd(binaryPath, true)]);
  } else if (os === "win32") {
    await Promise.all([setupWindowsTask(binaryPath, false), setupWindowsTask(binaryPath, true)]);
  } else {
    console.log("  Auto-start not supported on this platform — start manually with: marionette start");
  }
}

async function setupLaunchAgent(binaryPath: string, isProxy: boolean): Promise<void> {
  const logsDir = join(homedir(), ".marionette", "logs");
  const label = isProxy ? "com.marionette.proxy" : "com.marionette.app";
  const cmd = isProxy ? "proxy" : "start";
  const logFile = isProxy ? "proxy" : "marionette";
  const plistPath = join(homedir(), "Library", "LaunchAgents", `${label}.plist`);

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array><string>${binaryPath}</string><string>${cmd}</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${join(logsDir, `${logFile}.log`)}</string>
  <key>StandardErrorPath</key><string>${join(logsDir, `${logFile}.error.log`)}</string>
</dict></plist>`;

  writeFileSync(plistPath, plist);
  await execAsync(`launchctl load "${plistPath}"`).catch(() => {});
  console.log(`✓ ${isProxy ? "Proxy a" : "A"}uto-start configured (macOS LaunchAgent)`);
}

async function setupSystemd(binaryPath: string, isProxy: boolean): Promise<void> {
  const serviceName = isProxy ? "marionette-proxy" : "marionette";
  const description = isProxy ? "Marionette - API Proxy" : "Marionette - Claude Agent Monitor";
  const cmd = isProxy ? "proxy" : "start";
  const systemdDir = join(homedir(), ".config", "systemd", "user");
  const servicePath = join(systemdDir, `${serviceName}.service`);

  const unit = `[Unit]
Description=${description}

[Service]
ExecStart=${binaryPath} ${cmd}
Restart=always

[Install]
WantedBy=default.target`;

  writeFileSync(servicePath, unit);
  await execAsync(`systemctl --user enable --now ${serviceName}`).catch(() => {});
  console.log(`✓ ${isProxy ? "Proxy a" : "A"}uto-start configured (systemd user service)`);
}

async function setupWindowsTask(binaryPath: string, isProxy: boolean): Promise<void> {
  const taskName = isProxy ? "MarionetteProxy" : "Marionette";
  const cmd = isProxy ? "proxy" : "start";
  const ps = [
    `$action = New-ScheduledTaskAction -Execute "${binaryPath}" -Argument "${cmd}"`,
    `$trigger = New-ScheduledTaskTrigger -AtLogOn`,
    `Register-ScheduledTask -TaskName "${taskName}" -Action $action -Trigger $trigger -RunLevel Highest -Force`,
  ].join("; ");

  await execAsync(`powershell -Command "${ps.replace(/"/g, '\\"')}"`).catch(() => {});
  console.log(`✓ ${isProxy ? "Proxy a" : "A"}uto-start configured (Windows Scheduled Task)`);
}

async function setupShellEnv(): Promise<void> {
  const rcPath = shellRcPath();
  if (!rcPath) {
    console.log("  Shell not detected — skipping ANTHROPIC_BASE_URL setup");
    console.log(`  Add manually: export ANTHROPIC_BASE_URL="http://localhost:8788"`);
    return;
  }

  let content = "";
  try {
    content = await readFile(rcPath, "utf-8");
  } catch {
    // file may not exist yet
  }

  if (content.includes(SHELL_ENV_LINE)) {
    console.log(`✓ ANTHROPIC_BASE_URL already set in ${rcPath}`);
    return;
  }

  const block = `\n${SHELL_ENV_MARKER}\n${SHELL_ENV_LINE}\n`;
  await writeFile(rcPath, content + block);
  console.log(`✓ ANTHROPIC_BASE_URL added to ${rcPath}`);
  console.log(`  Reload with: source ${rcPath}`);
}
