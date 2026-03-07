import { resolve } from "path";
import { existsSync } from "fs";
import { distDir } from "./utils.js";

export async function startMcp(): Promise<void> {
  const mcpPath = resolve(distDir, "mcp/index.js");
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
