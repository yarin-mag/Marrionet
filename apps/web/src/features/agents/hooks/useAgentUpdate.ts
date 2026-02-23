import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService } from "../../../services/api.service";
import { QUERY_KEYS } from "../../../lib/constants";

/**
 * useAgentUpdate hook - Manages agent metadata updates
 * Provides mutation for updating agent custom name
 * @param agentId - Agent ID to update
 * @returns Mutation object with mutate function and states
 * @example
 * const { mutate: updateName, isPending } = useAgentUpdate(agent.agent_id);
 * updateName("New Name");
 */
export function useAgentUpdate(agentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (custom_name: string) =>
      apiService.updateAgent(agentId, {
        custom_name: custom_name || null,
      }),
    onSuccess: () => {
      // Invalidate agents query to refresh all agent data
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agents });
    },
    onError: (error) => {
      console.error("Failed to update agent:", error);
    },
  });
}
