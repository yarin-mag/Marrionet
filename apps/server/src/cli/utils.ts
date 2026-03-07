import { exec } from "child_process";
import { resolve, dirname, join } from "path";
import net from "net";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { promisify } from "util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Resolved path to dist/ (one level up from dist/cli/) */
export const distDir = resolve(__dirname, "..");

export const execAsync = promisify(exec);

export function isPortInUse(port: number): Promise<boolean> {
  return new Promise((fulfill) => {
    const tester = net.createConnection({ port, host: "127.0.0.1" });
    tester.once("connect", () => { tester.destroy(); fulfill(true); });
    tester.once("error", () => fulfill(false));
  });
}

export function getVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(distDir, "../package.json"), "utf-8")
    ) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function shellRcPath(): string | null {
  const shell = process.env.SHELL ?? "";
  if (shell.endsWith("zsh")) return join(homedir(), ".zshrc");
  if (shell.endsWith("bash")) {
    const profile = join(homedir(), ".bash_profile");
    const rc = join(homedir(), ".bashrc");
    return existsSync(profile) ? profile : rc;
  }
  return null;
}

export const SHELL_ENV_MARKER = "# Added by Marionette";
export const SHELL_ENV_LINE = `export ANTHROPIC_BASE_URL="http://localhost:8788"`;
