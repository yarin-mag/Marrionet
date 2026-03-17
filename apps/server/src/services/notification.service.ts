import type { AgentSnapshot, MarionetteEvent } from "@marionette/shared";
import { PreferencesRepository } from "../repositories/preferences.repository.js";
import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

const DISCORD_COLOR_GREEN = 0x57f287;
const DISCORD_COLOR_RED = 0xed4245;
const DISCORD_COLOR_AMBER = 0xfee75c;

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// How long to suppress repeat notifications for the same agent+status (ms).
const DEBOUNCE_MS = 60_000;

export class NotificationService {
  private prefsRepo = new PreferencesRepository();
  // key: `${agentId}:${status}` → timestamp of last successful send
  private readonly sentAt = new Map<string, number>();

  async notifyAgentStatus(agent: AgentSnapshot, event: MarionetteEvent): Promise<void> {
    const status = event.status;

    const isDone = status === "idle" || status === "finished";
    const isError = status === "crashed" || status === "error";
    const isAwaitingInput = status === "awaiting_input";
    if (!isDone && !isError && !isAwaitingInput) return;

    // Debounce: skip if the same agent+status was sent recently.
    const debounceKey = `${agent.agent_id}:${status}`;
    const lastSent = this.sentAt.get(debounceKey) ?? 0;
    if (Date.now() - lastSent < DEBOUNCE_MS) {
      logger.debug(`[discord] debounced — status=${status} agent=${agent.agent_id.slice(0, 12)}`);
      return;
    }

    const [webhookUrl, channel] = await Promise.all([
      this.getWebhookUrl(),
      this.getNotificationChannel(),
    ]);
    if (!webhookUrl || channel !== "discord") return;

    const embed = isDone
      ? this.buildFinishedEmbed(agent)
      : isAwaitingInput
        ? this.buildAwaitingInputEmbed(agent)
        : this.buildErrorEmbed(agent, event);

    this.sentAt.set(debounceKey, Date.now());
    logger.info(`[discord] firing POST — status=${status} agent=${agent.agent_id.slice(0, 12)}`);
    withRetry(() => this.post(webhookUrl, embed), `discord-webhook agent=${agent.agent_id.slice(0, 12)}`);
  }

  private buildFinishedEmbed(agent: AgentSnapshot) {
    const name = agent.metadata?.custom_name as string | undefined ?? agent.agent_name ?? agent.agent_id.slice(0, 8);
    const task = agent.current_task ?? "—";

    const durationMs = agent.session_start
      ? Date.now() - new Date(agent.session_start).getTime()
      : agent.total_duration_ms;

    const fields = [
      { name: "Task", value: task, inline: false },
      { name: "Duration", value: formatDuration(durationMs), inline: true },
      { name: "Session tokens", value: agent.session_tokens.toLocaleString(), inline: true },
    ];

    return {
      title: `✅ Session finished — ${name}`,
      color: DISCORD_COLOR_GREEN,
      fields,
      timestamp: new Date().toISOString(),
    };
  }

  private buildAwaitingInputEmbed(agent: AgentSnapshot) {
    const name = agent.metadata?.custom_name as string | undefined ?? agent.agent_name ?? agent.agent_id.slice(0, 8);
    const task = agent.current_task ?? "—";

    return {
      title: `⏳ Waiting for input — ${name}`,
      color: DISCORD_COLOR_AMBER,
      fields: [
        { name: "Task", value: task, inline: false },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  private buildErrorEmbed(agent: AgentSnapshot, event: MarionetteEvent) {
    const name = agent.metadata?.custom_name as string | undefined ?? agent.agent_name ?? agent.agent_id.slice(0, 8);
    const task = agent.current_task ?? "—";
    const errorMsg = event.summary ?? "Unknown error";

    return {
      title: `❌ Agent ${agent.status} — ${name}`,
      color: DISCORD_COLOR_RED,
      fields: [
        { name: "Task", value: task, inline: false },
        { name: "Error", value: errorMsg.slice(0, 1024), inline: false },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  private async getWebhookUrl(): Promise<string | null> {
    try {
      const all = await this.prefsRepo.getAll();
      const url = all["discordWebhookUrl"];
      return typeof url === "string" && url.length > 0 ? url : null;
    } catch {
      return null;
    }
  }

  private async getNotificationChannel(): Promise<string> {
    try {
      const all = await this.prefsRepo.getAll();
      const channel = all["notificationChannel"];
      return typeof channel === "string" ? channel : "browser";
    } catch {
      return "browser";
    }
  }

  private async post(webhookUrl: string, embed: object): Promise<void> {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : 5_000;
        logger.warn(`[discord] rate limited, waiting ${waitMs}ms before retry`);
        await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      }
      throw new Error(`Discord webhook responded with ${res.status}`);
    }
  }
}
