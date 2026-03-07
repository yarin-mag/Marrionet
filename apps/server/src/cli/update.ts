import { platform } from "os";
import { getVersion } from "./utils.js";

export async function update(): Promise<void> {
  const current = getVersion();
  console.log(`Current version: ${current}`);
  console.log("Checking for updates...");

  try {
    const res = await fetch("https://api.github.com/repos/yarin-mag/Marionette/releases/latest", {
      headers: { "User-Agent": "marionette-cli" },
    });
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
    const data = await res.json() as { tag_name: string; html_url: string };
    const latest = data.tag_name.replace(/^v/, "");

    if (latest === current) {
      console.log(`✓ Already on the latest version (${current})`);
    } else {
      console.log(`\n  New version available: ${latest}`);
      console.log(`  Release notes: ${data.html_url}`);
      console.log("\n  To upgrade, re-run the installer:");
      if (platform() === "win32") {
        console.log(`    irm https://raw.githubusercontent.com/yarin-mag/Marionette/master/scripts/install.ps1 | iex`);
      } else {
        console.log(`    curl -fsSL https://raw.githubusercontent.com/yarin-mag/Marionette/master/scripts/install.sh | bash`);
      }
    }
  } catch (err) {
    console.error("Could not check for updates:", (err as Error).message);
    process.exit(1);
  }
}
