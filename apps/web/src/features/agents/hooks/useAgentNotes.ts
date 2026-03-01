import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService } from "../../../services/api.service";
import { QUERY_KEYS } from "../../../lib/constants";

export function useAgentNotes(agentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notes: string) =>
      apiService.updateAgent(agentId, { notes: notes || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agents });
    },
    onError: (error) => {
      console.error("Failed to save notes:", error);
    },
  });
}
