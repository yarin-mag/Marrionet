#!/usr/bin/env node
import "dotenv/config";
import { start } from "./start.js";
import { setup } from "./setup.js";
import { stop } from "./stop.js";
import { status } from "./status.js";
import { showLogs } from "./logs.js";
import { update } from "./update.js";
import { uninstall } from "./uninstall.js";
import { startMcp } from "./mcp.js";
import { startProxy } from "./proxy.js";
import { getVersion } from "./utils.js";

const subcommand = process.argv[2];

function printHelp(): void {
  const version = getVersion();
  console.log(`Marionette v${version} — Claude Agent Monitor

Usage:
  marionette <command> [options]

Commands:
  start          Start the dashboard server (+ file watcher & API proxy)
  setup          Register MCP server in Claude Code & configure auto-start
  stop           Remove auto-start configuration & stop running processes
  status         Check if the server is running
  logs           Tail the server log file
  update         Check for a newer release
  uninstall      Fully remove Marionette from this machine
  mcp            Run the MCP server (called by Claude Code)
  proxy          Run the API proxy daemon (called by auto-start)

Options:
  --version, -v  Print version
  --help, -h     Show this help

Dashboard: http://localhost:8787`);
}

if (subcommand === "--version" || subcommand === "-v" || subcommand === "version") {
  console.log(`marionette ${getVersion()}`);
  process.exit(0);
}

if (subcommand === "--help" || subcommand === "-h") {
  printHelp();
  process.exit(0);
}

switch (subcommand) {
  case "start":
    start().catch((err) => { console.error(err); process.exit(1); });
    break;
  case "setup":
    setup().catch((err) => { console.error(err); process.exit(1); });
    break;
  case "mcp":
    startMcp().catch((err) => { console.error(err); process.exit(1); });
    break;
  case "proxy":
    startProxy().catch((err) => { console.error(err); process.exit(1); });
    break;
  case "stop":
    stop().catch((err) => { console.error(err); process.exit(1); });
    break;
  case "status":
    status().catch((err) => { console.error(err); process.exit(1); });
    break;
  case "logs":
    showLogs().catch((err) => { console.error(err); process.exit(1); });
    break;
  case "update":
    update().catch((err) => { console.error(err); process.exit(1); });
    break;
  case "uninstall":
    uninstall().catch((err) => { console.error(err); process.exit(1); });
    break;
  default:
    printHelp();
    break;
}
