import { join } from "path";
import { readFile, writeFile, rm } from "fs/promises";
import { homedir, platform } from "os";
import { execAsync } from "./utils.js";
import { stop } from "./stop.js";

async function removeMcpRegistration(): Promise<void> {
  const mcpConfigPath = join(homedir(), ".claude", "mcp_settings.json");
  try {
    const content = await readFile(mcpConfigPath, "utf-8");
    const cfg = JSON.parse(content) as { mcpServers?: Record<string, unknown> };
    if (cfg.mcpServers?.["marionette"]) {
      delete cfg.mcpServers["marionette"];
      await writeFile(mcpConfigPath, JSON.stringify(cfg, null, 2));
      console.log("✓ Removed marionette MCP server registration");
    }
  } catch {
    // file doesn't exist or parse failed — skip
  }
}

async function removeHooks(): Promise<void> {
  const settingsPath = join(homedir(), ".claude", "settings.json");
  try {
    const content = await readFile(settingsPath, "utf-8");
    const cfg = JSON.parse(content) as { hooks?: Record<string, unknown> };
    if (cfg.hooks) {
      delete cfg.hooks["PreToolUse"];
      delete cfg.hooks["Stop"];
      delete cfg.hooks["Notification"];
      if (Object.keys(cfg.hooks).length === 0) delete cfg.hooks;
      await writeFile(settingsPath, JSON.stringify(cfg, null, 2));
      console.log("✓ Removed Marionette hooks from Claude Code settings");
    }
  } catch {
    // file doesn't exist or parse failed — skip
  }
}

async function removeLogsDir(): Promise<void> {
  const logsDir = join(homedir(), ".marionette");
  try {
    await rm(logsDir, { recursive: true, force: true });
    console.log(`✓ Removed logs directory (${logsDir})`);
  } catch {
    // ignore
  }
}

async function removeInstallFiles(): Promise<void> {
  const os = platform();
  if (os === "darwin" || os === "linux") {
    const installDir = "/usr/local/lib/marionette";
    const binLink = "/usr/local/bin/marionette";
    try {
      await execAsync(`sudo rm -rf "${installDir}" && sudo rm -f "${binLink}"`);
      console.log(`✓ Removed installation files`);
    } catch {
      console.log(`  Could not remove install files automatically.`);
      console.log(`  Run manually: sudo rm -rf ${installDir} && sudo rm -f ${binLink}`);
    }
  } else if (os === "win32") {
    const installDir = join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "marionette");
    const binDir = join(installDir, "bin");
    try {
      const stripPath = `$p=[Environment]::GetEnvironmentVariable('PATH','User'); $p=($p -split ';') | Where-Object {$_ -ne '${binDir}'} | Where-Object {$_ -ne ''}; [Environment]::SetEnvironmentVariable('PATH',$p -join ';','User')`;
      await execAsync(`powershell -Command "${stripPath.replace(/"/g, '\\"')}"`);
    } catch { /* ignore */ }
    try {
      await execAsync(`powershell -Command "Remove-Item -Recurse -Force '${installDir}'"`);
      console.log(`✓ Removed installation files`);
    } catch {
      console.log(`  Could not remove install directory: ${installDir}`);
      console.log(`  Remove it manually if it exists.`);
    }
  }
}

export async function uninstall(): Promise<void> {
  const skipConfirm = process.argv.slice(3).some(a => a === "--yes" || a === "-y");

  if (!skipConfirm) {
    process.stdout.write("This will fully remove Marionette from your machine. Continue? [y/N] ");
    const answer = await new Promise<string>((resolve) => {
      process.stdin.setEncoding("utf-8");
      process.stdin.once("data", (chunk) => resolve(String(chunk).trim()));
    });
    if (!/^y$/i.test(answer)) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  console.log("\n🗑  Uninstalling Marionette...\n");
  await stop();
  await Promise.all([removeMcpRegistration(), removeHooks()]);
  await removeLogsDir();
  await removeInstallFiles();
  console.log("\n✓ Marionette has been uninstalled.");
  console.log("  Restart your terminal for PATH/shell changes to take effect.");
}
