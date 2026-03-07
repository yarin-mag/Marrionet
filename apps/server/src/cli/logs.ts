import { spawn } from "child_process";
import { join } from "path";
import { existsSync } from "fs";
import { homedir, platform } from "os";

export async function showLogs(): Promise<void> {
  const logFile = join(homedir(), ".marionette", "logs", "marionette.log");
  if (!existsSync(logFile)) {
    console.error(`No log file found at ${logFile}`);
    console.error("Logs are only available after running: marionette start");
    process.exit(1);
  }

  const os = platform();
  let tail: ReturnType<typeof spawn>;
  if (os === "win32") {
    tail = spawn("powershell", ["-Command", `Get-Content -Wait "${logFile}"`], { stdio: "inherit" });
  } else {
    tail = spawn("tail", ["-f", logFile], { stdio: "inherit" });
  }

  process.on("SIGINT", () => { tail.kill(); process.exit(0); });
  process.on("SIGTERM", () => { tail.kill(); process.exit(0); });
}
