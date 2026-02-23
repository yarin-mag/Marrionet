import type { AgentSnapshot, AgentStatus } from "@marionette/shared";
import { API_URL } from "../lib/constants";

class ApiService {
  private baseUrl = API_URL;

  /**
   * Fetch all agents with optional status filter
   */
  async getAgents(statusFilter?: AgentStatus): Promise<AgentSnapshot[]> {
    const url = new URL(`${this.baseUrl}/api/agents`);
    if (statusFilter) {
      url.searchParams.set("status", statusFilter);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to fetch agents: ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Fetch single agent by ID
   */
  async getAgent(agentId: string): Promise<AgentSnapshot> {
    const res = await fetch(`${this.baseUrl}/api/agents/${agentId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch agent: ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Update agent metadata
   */
  async updateAgent(
    agentId: string,
    updates: {
      custom_name?: string | null;
      labels?: string[];
      jira_tickets?: string[];
    }
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      throw new Error(`Failed to update agent: ${res.statusText}`);
    }
  }

  /**
   * Delete all agents
   */
  async deleteAllAgents(): Promise<{ deleted: number }> {
    const res = await fetch(`${this.baseUrl}/api/agents/all`, {
      method: "DELETE",
    });

    if (!res.ok) {
      throw new Error(`Failed to delete agents: ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Fetch system status
   */
  async getStatus(): Promise<{
    total_agents: number;
    working: number;
    idle: number;
    needs_attention: number;
  }> {
    const res = await fetch(`${this.baseUrl}/api/status`);
    if (!res.ok) {
      throw new Error(`Failed to fetch status: ${res.statusText}`);
    }

    return res.json();
  }
}

export const apiService = new ApiService();
