import type { AgentSnapshot } from "@marionette/shared";
import { API_URL } from "../lib/constants";

export interface AgentSession {
  id: string;
  agentId: string;
  agentName: string;
  task: string;
  startTime: Date;
  endTime: Date;
  status: string;
  tokens: number;
  runs: number;
  terminal: string;
  cwd: string;
}

class CalendarService {
  private baseUrl = API_URL;

  /**
   * Convert agent snapshots to calendar sessions
   * Uses session_start and last_activity to create time ranges
   */
  async getAgentSessions(
    startDate: Date,
    endDate: Date
  ): Promise<AgentSession[]> {
    try {
      // Fetch all agents (in production, add date range filtering on backend)
      const res = await fetch(`${this.baseUrl}/api/agents`);
      if (!res.ok) throw new Error("Failed to fetch agents");

      const agents: AgentSnapshot[] = await res.json();

      // Transform to calendar sessions
      const sessions: AgentSession[] = agents
        .filter((agent) => {
          // Only include agents with session data
          if (!agent.session_start || !agent.last_activity) return false;

          const sessionStart = new Date(agent.session_start);
          const sessionEnd = new Date(agent.last_activity);

          // Filter by date range
          return sessionEnd >= startDate && sessionStart <= endDate;
        })
        .map((agent) => {
          const sessionStart = new Date(agent.session_start!);
          const sessionEnd = new Date(agent.last_activity!);

          // If session is still active (working), use current time as end
          const endTime =
            agent.status === "working" ? new Date() : sessionEnd;

          return {
            id: agent.agent_id,
            agentId: agent.agent_id,
            agentName: agent.agent_name || agent.terminal || "Unknown Agent",
            task: agent.current_task || "No specific task",
            startTime: sessionStart,
            endTime: endTime,
            status: agent.status,
            tokens: agent.session_tokens,
            runs: agent.session_runs,
            terminal: agent.terminal || "Unknown",
            cwd: agent.cwd || "Unknown",
          };
        });

      return sessions;
    } catch (error) {
      console.error("[CalendarService] Failed to fetch sessions:", error);
      throw error;
    }
  }

  /**
   * Get sessions grouped by day
   */
  async getSessionsByDay(date: Date): Promise<AgentSession[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.getAgentSessions(startOfDay, endOfDay);
  }

  /**
   * Get sessions for a specific agent
   */
  async getAgentSessionsById(
    agentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AgentSession[]> {
    const allSessions = await this.getAgentSessions(startDate, endDate);
    return allSessions.filter((session) => session.agentId === agentId);
  }
}

export const calendarService = new CalendarService();
