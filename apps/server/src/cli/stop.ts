import { join } from "path";
import { readFile, writeFile } from "fs/promises";
import { homedir, platform } from "os";
import { config } from "../config/index.js";
import { execAsync, shellRcPath, SHELL_ENV_MARKER, SHELL_ENV_LINE } from "./utils.js";

async function killPortProcesses(): Promise<void> {
  const os = platform();
  const ports = [config.port, 8788];
  if (os === "darwin" || os === "linux") {
    await Promise.all(ports.map(port =>
      execAsync(`lsof -ti tcp:${port} | xargs kill -9`).catch(() => {})
    ));
    console.log("✓ Killed any running processes on ports 8787/8788");
  } else if (os === "win32") {
    await Promise.all(ports.map(port => {
      const ps = `$ids = (Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess; if ($ids) { $ids | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }`;
      return execAsync(`powershell -Command "${ps}"`).catch(() => {});
    }));
    console.log("✓ Killed any running processes on ports 8787/8788");
  }
}

async function removeShellEnv(): Promise<void> {
  const rcPath = shellRcPath();
  if (!rcPath) return;

  let content = "";
  try {
    content = await readFile(rcPath, "utf-8");
  } catch {
    return;
  }

  const cleaned = content.replace(
    new RegExp(`\\n?${SHELL_ENV_MARKER}\\n${SHELL_ENV_LINE}\\n?`, "g"),
    ""
  );

  if (cleaned === content) return;

  await writeFile(rcPath, cleaned);
  console.log(`✓ ANTHROPIC_BASE_URL removed from ${rcPath}`);
}

export async function stop(): Promise<void> {
  const os = platform();
  if (os === "darwin") {
    const appPlist = join(homedir(), "Library", "LaunchAgents", "com.marionette.app.plist");
    const proxyPlist = join(homedir(), "Library", "LaunchAgents", "com.marionette.proxy.plist");
    await Promise.all([
      execAsync(`launchctl unload "${appPlist}"`).catch(() => {}),
      execAsync(`launchctl unload "${proxyPlist}"`).catch(() => {}),
    ]);
    console.log("✓ Auto-start removed (macOS)");
  } else if (os === "linux") {
    await execAsync("systemctl --user disable --now marionette marionette-proxy").catch(() => {});
    console.log("✓ Auto-start removed (Linux)");
  } else if (os === "win32") {
    await Promise.all([
      execAsync('powershell -Command "Unregister-ScheduledTask -TaskName Marionette -Confirm:$false"').catch(() => {}),
      execAsync('powershell -Command "Unregister-ScheduledTask -TaskName MarionetteProxy -Confirm:$false"').catch(() => {}),
    ]);
    console.log("✓ Auto-start removed (Windows)");
  } else {
    console.log("Auto-start not configured on this platform.");
  }
  await killPortProcesses();
  await removeShellEnv();
}
