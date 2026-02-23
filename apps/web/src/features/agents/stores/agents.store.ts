import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgentSnapshot } from "@marionette/shared";

interface AgentsStore {
  // Agent data
  agents: AgentSnapshot[];
  setAgents: (agents: AgentSnapshot[]) => void;
  updateAgent: (agentId: string, updates: Partial<AgentSnapshot>) => void;
  removeAgent: (agentId: string) => void;

  // UI State
  hideDisconnected: boolean;
  toggleHideDisconnected: () => void;

  // Side Panel
  selectedAgent: AgentSnapshot | null;
  openPanel: (agent: AgentSnapshot) => void;
  closePanel: () => void;

  // View Preference
  viewMode: "grid" | "calendar" | "table" | "kanban" | "analytics";
  setViewMode: (mode: "grid" | "calendar" | "table" | "kanban" | "analytics") => void;

  // Computed
  getFilteredAgents: () => AgentSnapshot[];
  getDisconnectedCount: () => number;
}

export const useAgentsStore = create<AgentsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      agents: [],
      hideDisconnected: false,
      selectedAgent: null,
      viewMode: "grid",

      // Actions
      setAgents: (agents) => set({ agents }),

      updateAgent: (agentId, updates) =>
        set((state) => ({
          agents: state.agents.map((agent) =>
            agent.agent_id === agentId ? { ...agent, ...updates } : agent
          ),
        })),

      removeAgent: (agentId) =>
        set((state) => ({
          agents: state.agents.filter((agent) => agent.agent_id !== agentId),
        })),

      toggleHideDisconnected: () =>
        set((state) => ({ hideDisconnected: !state.hideDisconnected })),

      openPanel: (agent) => set({ selectedAgent: agent }),

      closePanel: () => set({ selectedAgent: null }),

      setViewMode: (mode) => set({ viewMode: mode }),

      // Computed
      getFilteredAgents: () => {
        const { agents, hideDisconnected } = get();
        return hideDisconnected
          ? agents.filter((a) => a.status !== "disconnected")
          : agents;
      },

      getDisconnectedCount: () => {
        const { agents } = get();
        return agents.filter((a) => a.status === "disconnected").length;
      },
    }),
    {
      name: "marionette-storage",
      // Only persist UI preferences, not data
      partialize: (state) => ({
        hideDisconnected: state.hideDisconnected,
        viewMode: state.viewMode,
      }),
    }
  )
);
