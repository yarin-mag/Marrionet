import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { wsService } from "../../../services/ws.service";
import { useAgents } from "../../agents/hooks/useAgents";
import { useAgentsStore } from "../../agents/stores/agents.store";
import { apiService } from "../../../services/api.service";
import { QUERY_KEYS } from "../../../lib/constants";
import type { AgentSession } from "../../../services/calendar.service";
import { useDemoMode } from "../../../hooks/useDemoMode";

type ViewMode = "grid" | "calendar" | "table" | "kanban" | "analytics" | "compare";

const WS_POLL_INTERVAL_MS = 2_000;

export function useMissionControlState() {
  const isDemoMode = useDemoMode();
  const { agents, loading, error } = useAgents();
  const [clearing, setClearing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AgentSession | null>(null);
  const [wsConnected, setWsConnected] = useState(isDemoMode || wsService.isConnected);

  useEffect(() => {
    if (isDemoMode) return;
    const interval = setInterval(() => {
      setWsConnected(wsService.isConnected);
    }, WS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isDemoMode]);

  const hideDisconnected = useAgentsStore((state) => state.hideDisconnected);
  const toggleHideDisconnected = useAgentsStore((state) => state.toggleHideDisconnected);
  const selectedAgent = useAgentsStore((state) => state.selectedAgent);
  const openPanel = useAgentsStore((state) => state.openPanel);
  const closePanel = useAgentsStore((state) => state.closePanel);
  const viewMode = useAgentsStore((state) => state.viewMode);
  const setViewMode = useAgentsStore((state) => state.setViewMode);
  const getFilteredAgents = useAgentsStore((state) => state.getFilteredAgents);
  const getDisconnectedCount = useAgentsStore((state) => state.getDisconnectedCount);

  const { data: status } = useQuery({
    queryKey: QUERY_KEYS.status,
    queryFn: () => apiService.getStatus(),
  });

  const filteredAgents = getFilteredAgents();
  const disconnectedCount = getDisconnectedCount();

  const handleClearAll = async () => {
    if (!confirm("Delete ALL agents? This will clear the entire dashboard.")) return;
    setClearing(true);
    try {
      await apiService.deleteAllAgents();
    } catch {
      console.error("Failed to clear agents");
    } finally {
      setClearing(false);
    }
  };

  return {
    agents,
    loading,
    error,
    clearing,
    selectedSession,
    setSelectedSession,
    wsConnected,
    hideDisconnected,
    toggleHideDisconnected,
    selectedAgent,
    openPanel,
    closePanel,
    viewMode: viewMode as ViewMode,
    setViewMode,
    filteredAgents,
    disconnectedCount,
    status,
    handleClearAll,
  };
}
