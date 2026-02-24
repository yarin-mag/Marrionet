import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { personalTasksService } from "../../../services/personal-tasks.service";

const QUERY_KEY = "personal-tasks";

export function usePersonalTasks(start?: Date, end?: Date) {
  return useQuery({
    queryKey: [QUERY_KEY, start?.toISOString(), end?.toISOString()],
    queryFn: () => personalTasksService.list(start, end),
    staleTime: 30000,
  });
}

export function useCreatePersonalTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description?: string; start_time: string; end_time: string }) =>
      personalTasksService.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useUpdatePersonalTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; title?: string; description?: string | null; start_time?: string; end_time?: string }) =>
      personalTasksService.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useDeletePersonalTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => personalTasksService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
