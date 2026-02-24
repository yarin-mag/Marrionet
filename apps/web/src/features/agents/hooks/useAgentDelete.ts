import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService } from "../../../services/api.service";
import { QUERY_KEYS } from "../../../lib/constants";
import { useAgentsStore } from "../stores/agents.store";

export function useAgentDelete(agentId: string) {
  const queryClient = useQueryClient();
  const { closePanel, removeAgent } = useAgentsStore();

  return useMutation({
    mutationFn: () => apiService.deleteAgent(agentId),
    onSuccess: () => {
      removeAgent(agentId);
      closePanel();
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agents });
    },
    onError: (error) => {
      console.error("Failed to delete agent:", error);
    },
  });
}
