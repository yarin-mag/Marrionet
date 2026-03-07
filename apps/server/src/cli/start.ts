import { spawn, exec } from "child_process";
import { resolve } from "path";
import { existsSync } from "fs";
import express from "express";
import { createApp, mountErrorHandler } from "../app.js";
import { DatabaseClient } from "../db.js";
import { WebSocketService } from "../services/websocket.service.js";
import { AgentService } from "../services/agent.service.js";
import { EventService } from "../services/event.service.js";
import { CommandService } from "../services/command.service.js";
import { createApiRoutes } from "../routes/index.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { isPortInUse, distDir } from "./utils.js";

function openBrowser(url: string): void {
  const os = process.platform;
  const cmd =
    os === "darwin" ? `open "${url}"` :
    os === "linux"  ? `xdg-open "${url}"` :
    os === "win32"  ? `start "" "${url}"` : null;
  if (!cmd) return;
  exec(cmd, (err) => {
    if (err) logger.warn("Could not open browser:", err.message);
  });
}

export async function start(): Promise<void> {
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
  const webDist = process.env.WEB_DIST ?? resolve(distDir, "../web");
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get("*", (_req, res) => res.sendFile(resolve(webDist, "index.html")));
  }

  mountErrorHandler(app);

  // Spawn file-watcher child process
  const watcherPath = resolve(distDir, "watcher/index.js");
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

  // Spawn API proxy child process (skip if proxy daemon is already running)
  const proxyPath = resolve(distDir, "proxy/index.js");
  let proxy: ReturnType<typeof spawn> | null = null;
  const proxyAlreadyRunning = await isPortInUse(8788);
  if (proxyAlreadyRunning) {
    logger.info("API proxy already running on :8788 — skipping");
  } else if (existsSync(proxyPath)) {
    proxy = spawn(process.execPath, [proxyPath], {
      stdio: "inherit",
      env: { ...process.env, MARIONETTE_API_URL: `http://localhost:${config.port}` },
    });
    proxy.on("exit", (code) => {
      logger.info(`API proxy exited with code ${code}`);
    });
    proxy.on("error", (err) => {
      logger.error("API proxy failed to start:", err);
    });
  } else {
    logger.warn(`API proxy not found at ${proxyPath} — skipping`);
  }

  // Open browser after a short delay
  setTimeout(() => openBrowser(`http://localhost:${config.port}`), 1500);

  const shutdown = () => {
    logger.info("Shutting down...");
    if (watcher) watcher.kill();
    if (proxy) proxy.kill();
    wsService.close();
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
