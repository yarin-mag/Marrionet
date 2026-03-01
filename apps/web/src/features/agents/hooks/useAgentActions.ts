import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService } from "../../../services/api.service";
import { QUERY_KEYS } from "../../../lib/constants";

export function useAgentKill(agentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiService.killAgent(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agents });
    },
    onError: (error) => {
      console.error("Failed to kill agent:", error);
    },
  });
}

export function useAgentFocus(agentId: string) {
  return useMutation({
    mutationFn: () => apiService.focusAgent(agentId),
    onError: (error) => {
      console.error("Failed to focus agent:", error);
    },
  });
}
