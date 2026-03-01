import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { AgentSnapshot, AgentStatus } from "@marionette/shared";
import { apiService } from "../../../services/api.service";
import { wsService } from "../../../services/ws.service";
import { dbService } from "../../../services/db.service";
import { QUERY_KEYS, STALE_TIME } from "../../../lib/constants";
import { useAgentsStore } from "../stores/agents.store";

export function useAgents(statusFilter?: AgentStatus) {
  const queryClient = useQueryClient();
  const setAgents = useAgentsStore((state) => state.setAgents);
  const updateAgent = useAgentsStore((state) => state.updateAgent);

  // Query with automatic caching and offline support
  const {
    data: agents = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [...QUERY_KEYS.agents, statusFilter],
    queryFn: async (): Promise<AgentSnapshot[]> => {
      try {
        // Try network first
        const data = await apiService.getAgents(statusFilter);

        // Cache in IndexedDB for offline support
        await dbService.saveAgents(data);

        // Update Zustand store
        setAgents(data);

        return data;
      } catch (error) {
        console.error("[useAgents] Network error, falling back to cache:", error);

        // Fallback to IndexedDB cache
        const cachedData = statusFilter
          ? await dbService.getAgentsByStatus(statusFilter)
          : await dbService.getAgents();

        if (cachedData.length > 0) {
          console.log(`[useAgents] Loaded ${cachedData.length} agents from cache`);
          setAgents(cachedData);
          return cachedData;
        }

        // Re-throw if no cache available
        throw error;
      }
    },
    staleTime: STALE_TIME.agents,
  });

  // WebSocket for real-time updates
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = wsService.subscribe((message) => {
      if (message.type === "agents_updated") {
        // Debounce rapid-fire broadcasts (e.g. multiple agents starting at once)
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          console.log("[useAgents] Agents updated, refetching...");
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agents });
        }, 250);
      } else if (message.type === "agent_update" && message.agent_id) {
        // Optimistic update for single agent
        queryClient.setQueryData<AgentSnapshot[]>(QUERY_KEYS.agents, (old = []) => {
          const updated = old.map((agent) =>
            agent.agent_id === message.agent_id
              ? { ...agent, ...message.updates }
              : agent
          );

          // Also update Zustand
          updateAgent(message.agent_id, message.updates);

          return updated;
        });
      }
    });

    // Connect WebSocket if not connected
    if (!wsService.isConnected) {
      wsService.connect();
    }

    return () => {
      clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [queryClient, updateAgent]);

  return {
    agents,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
