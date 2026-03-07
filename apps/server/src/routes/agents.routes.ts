import { Router } from "express";
import { spawn } from "node:child_process";
import { basename } from "node:path";
import type { WebSocketService } from "../services/websocket.service.js";
import { AgentsController } from "../controllers/agents.controller.js";
import { AgentService } from "../services/agent.service.js";
import { CommandService } from "../services/command.service.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { EventRepository } from "../repositories/event.repository.js";

export function createAgentsRoutes(wsService?: WebSocketService, commandService?: CommandService) {
  const router = Router();
  const controller = new AgentsController();

  if (wsService) controller.setWebSocketService(wsService);

  router.get("/", asyncHandler(controller.getAgents.bind(controller)));
  router.get("/:agentId/conversation", asyncHandler(controller.getConversation.bind(controller)));
  router.get("/:agentId/runs", asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const eventRepo = new EventRepository();
    const runs = await eventRepo.getRuns(agentId, limit);
    res.json({ runs });
  }));
  router.get("/:agentId/llm-calls", asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const eventRepo = new EventRepository();
    const events = await eventRepo.findWithFilters({ agentId, type: "llm.call", limit });
    res.json({ calls: events.map((e) => ({
      ts: e.ts,
      summary: e.summary,
      duration_ms: e.duration_ms,
      tokens: e.tokens,
      payload: e.payload,
    })) });
  }));
  router.post("/:agentId/commands", asyncHandler(async (req, res) => {
    if (!commandService) {
      return res.status(503).json({ error: "Command service not available" });
    }
    const { agentId } = req.params;
    const { command, args } = req.body;
    if (!command || typeof command !== "string") {
      return res.status(400).json({ error: "Command is required and must be a string" });
    }
    const result = await commandService.execute(agentId, command, args);
    res.json(result);
  }));
  router.post("/:agentId/focus", asyncHandler(async (req, res) => {
    const agent = await new AgentService().getAgent(req.params.agentId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const cwd = agent.cwd ?? "";
    const terminal = agent.terminal ?? "";
    const isVSCode = terminal.toLowerCase().includes("vs code") || terminal.toLowerCase().includes("vscode");

    // Spawn a fire-and-forget process; suppress errors so the server never crashes
    // if the target executable is missing. shell:true lets Windows find .cmd wrappers.
    const fire = (cmd: string, args: string[], shell = false) =>
      spawn(cmd, args, { detached: true, stdio: "ignore", shell }).on("error", () => {}).unref();

    if (isVSCode && process.platform === "darwin") {
      fire("osascript", ["-e", 'tell application "Code" to activate']);
      return res.json({ ok: true, method: "applescript", app: "Code" });
    }
    if (isVSCode && process.platform === "linux" && cwd) {
      fire("code", [cwd]);
      return res.json({ ok: true, method: "vscode" });
    }

    if (process.platform === "win32") {
      const winProcessMap: Record<string, string> = {
        "vs code":          "Code",
        "windows terminal": "WindowsTerminal",
        "conemu":           "ConEmu64",
        "cmder":            "Cmder",
        "hyper":            "Hyper",
        "warp":             "Warp",
      };
      const mappedProcess = winProcessMap[terminal.toLowerCase()];
      // If terminal is known, target it directly; otherwise probe all known terminals in
      // priority order and focus whichever has a visible window — handles the common case
      // where terminal detection failed at session start (e.g. Warp + PowerShell on Windows).
      const candidates = mappedProcess
        ? [mappedProcess]
        : ["Warp", "Code", "WindowsTerminal", "ConEmu64", "Cmder", "Hyper"];
      const candidatesPs = candidates.map((n) => `"${n}"`).join(", ");

      // When terminal is unknown we use cwd's basename to title-match VSCode windows
      // (e.g. "Marionette - Visual Studio Code"). This avoids focusing Warp when the
      // user actually wants a VSCode window for the same project. Escape PS single-quotes.
      const projectName = cwd ? basename(cwd).replace(/'/g, "''") : "";

      // Use PowerShell + Win32 P/Invoke to bring the window to front.
      // Strategy: SetWindowPos(TOPMOST) + SetWindowPos(NOTOPMOST) visually raises the
      // window in the Z-order without requiring foreground rights (which background
      // processes don't have). SwitchToThisWindow then steals input focus.
      // Spawned with windowsHide:true so no console flashes and briefly steals focus.
      const psLines = [
        'Add-Type -TypeDefinition @"',
        'using System;',
        'using System.Runtime.InteropServices;',
        'public class Win32Helper {',
        '    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);',
        '    [DllImport("user32.dll")] public static extern int ShowWindow(IntPtr hWnd, int nCmdShow);',
        '    [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);',
        '    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);',
        '}',
        '"@',
        `$candidates = @(${candidatesPs})`,
        '$proc = $null',
      ];

      // When terminal is unknown: try Code title-match first so a VSCode session is
      // preferred over Warp even though both have visible windows.
      if (!mappedProcess && projectName) {
        psLines.push(
          `$pn = '${projectName}'`,
          '$proc = Get-Process -Name "Code" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "*$pn*" } | Select-Object -First 1',
        );
      }

      psLines.push(
        'if (-not $proc) {',
        '    foreach ($name in $candidates) {',
        '        $proc = Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1',
        '        if ($proc) { break }',
        '    }',
        '}',
        'if ($proc) {',
        '    $hwnd = $proc.MainWindowHandle',
        '    $SWP_NOMOVE = 0x0002; $SWP_NOSIZE = 0x0001; $SWP_SHOW = 0x0040',
        '    $TOPMOST = [IntPtr](-1); $NOTOPMOST = [IntPtr](-2)',
        '    [Win32Helper]::ShowWindow($hwnd, 9) | Out-Null',
        '    [Win32Helper]::SetWindowPos($hwnd, $TOPMOST,    0, 0, 0, 0, $SWP_NOMOVE -bor $SWP_NOSIZE -bor $SWP_SHOW) | Out-Null',
        '    [Win32Helper]::SetWindowPos($hwnd, $NOTOPMOST,  0, 0, 0, 0, $SWP_NOMOVE -bor $SWP_NOSIZE -bor $SWP_SHOW) | Out-Null',
        '    [Win32Helper]::SetForegroundWindow($hwnd) | Out-Null',
        '    [Win32Helper]::SwitchToThisWindow($hwnd, $true)',
        '}',
      );
      const psScript = psLines.join('\r\n');
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      // windowsHide prevents the console from flashing + grabbing focus before the script runs
      spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
        { stdio: "ignore", windowsHide: true }).on("error", () => {}).unref();
      return res.json({ ok: true, method: mappedProcess ? "powershell" : "powershell-fallback", candidates });
    }

    if (process.platform === "darwin") {
      const appMap: Record<string, string> = {
        "iterm2": "iTerm2",
        "terminal.app": "Terminal",
        "warp": "Warp",
        "ghostty": "Ghostty",
        "hyper": "Hyper",
      };
      const appName = appMap[terminal.toLowerCase()];
      if (appName) {
        fire("osascript", ["-e", `tell application "${appName}" to activate`]);
        return res.json({ ok: true, method: "applescript", app: appName });
      }
    }

    const reason = terminal ? `unsupported terminal "${terminal}"` : "terminal not detected (restart Claude Code to enable focus)";
    res.status(501).json({ error: `Focus not supported: ${reason}` });
  }));

  router.get("/:agentId", asyncHandler(controller.getAgent.bind(controller)));
  router.patch("/:agentId", asyncHandler(controller.updateMetadata.bind(controller)));
  router.delete("/crashed", asyncHandler(controller.deleteCrashed.bind(controller)));
  router.delete("/all", asyncHandler(controller.deleteAll.bind(controller)));
  router.delete("/:agentId", asyncHandler(controller.deleteAgent.bind(controller)));

  return router;
}
