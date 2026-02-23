#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const command = process.argv[2];

async function configure() {
  console.log("📊 Marionette MCP Server Setup\n");

  const mcpConfigPath = join(homedir(), ".claude", "mcp_settings.json");

  try {
    // Read existing config
    let config: any = {};
    try {
      const content = await readFile(mcpConfigPath, "utf-8");
      config = JSON.parse(content);
    } catch {
      // File doesn't exist, create new config
      config = { mcpServers: {} };
    }

    // Add marionette server
    config.mcpServers = config.mcpServers || {};
    config.mcpServers.marionette = {
      command: "node",
      args: [join(process.cwd(), "packages/mcp-server/dist/index.js")],
      env: {
        MARIONETTE_API_URL: process.env.MARIONETTE_API_URL ?? "http://localhost:8787",
      },
    };

    // Write back
    await writeFile(mcpConfigPath, JSON.stringify(config, null, 2));

    console.log("✅ Configuration updated!");
    console.log(`📝 Config file: ${mcpConfigPath}\n`);
    console.log("Add this to your ~/.claude/mcp_settings.json:");
    console.log(JSON.stringify(config.mcpServers.marionette, null, 2));
  } catch (err) {
    console.error("❌ Failed to configure:", err);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
📊 Marionette MCP Server

Usage:
  marionette-mcp serve       Start the MCP server
  marionette-mcp configure   Configure Claude Code to use Marionette
  marionette-mcp help        Show this help

Environment Variables:
  MARIONETTE_API_URL         Backend API URL (default: http://localhost:8787)
  MARIONETTE_AGENT_NAME      Agent name (default: agent-<hostname>)
`);
}

switch (command) {
  case "serve":
    // Import and run the server
    import("./index.js");
    break;

  case "configure":
    configure();
    break;

  case "help":
  default:
    printHelp();
    break;
}
