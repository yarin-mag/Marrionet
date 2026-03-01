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
  viewMode: "grid" | "calendar" | "table" | "kanban" | "analytics" | "compare";
  setViewMode: (mode: "grid" | "calendar" | "table" | "kanban" | "analytics" | "compare") => void;

  // Compare
  compareSet: string[];
  toggleCompare: (agentId: string) => void;
  clearCompare: () => void;

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
      compareSet: [],

      // Actions
      setAgents: (agents) =>
        set((state) => {
          const agentIds = new Set(agents.map((a) => a.agent_id));
          return {
            agents,
            // Keep selectedAgent in sync with the latest snapshot
            selectedAgent: state.selectedAgent
              ? (agents.find((a) => a.agent_id === state.selectedAgent!.agent_id) ?? state.selectedAgent)
              : null,
            // Remove any compare entries that no longer exist
            compareSet: state.compareSet.filter((id) => agentIds.has(id)),
          };
        }),

      updateAgent: (agentId, updates) =>
        set((state) => ({
          agents: state.agents.map((agent) =>
            agent.agent_id === agentId ? { ...agent, ...updates } : agent
          ),
          // Keep selectedAgent in sync for individual updates too
          selectedAgent:
            state.selectedAgent?.agent_id === agentId
              ? { ...state.selectedAgent, ...updates }
              : state.selectedAgent,
        })),

      removeAgent: (agentId) =>
        set((state) => ({
          agents: state.agents.filter((agent) => agent.agent_id !== agentId),
          compareSet: state.compareSet.filter((id) => id !== agentId),
        })),

      toggleHideDisconnected: () =>
        set((state) => ({ hideDisconnected: !state.hideDisconnected })),

      openPanel: (agent) => set({ selectedAgent: agent }),

      closePanel: () => set({ selectedAgent: null }),

      setViewMode: (mode) => set({ viewMode: mode }),

      toggleCompare: (agentId) =>
        set((state) => {
          const next = state.compareSet.includes(agentId)
            ? state.compareSet.filter((id) => id !== agentId)
            : state.compareSet.length < 4
            ? [...state.compareSet, agentId]
            : state.compareSet;
          return { compareSet: next };
        }),

      clearCompare: () => set({ compareSet: [] }),

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
        compareSet: state.compareSet,
      }),
    }
  )
);
