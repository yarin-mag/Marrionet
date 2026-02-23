import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Trash2, LayoutGrid, Table, Columns, BarChart3, Calendar as CalendarIcon } from "lucide-react";
import { useAgents } from "../../agents/hooks/useAgents";
import { useAgentsStore } from "../../agents/stores/agents.store";
import { useUserPreferences } from "../../../hooks/use-user-preferences";
import { apiService } from "../../../services/api.service";
import { QUERY_KEYS } from "../../../lib/constants";
import { Card, CardContent, CardDescription, CardHeader } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { GridView } from "../views/GridView";
import { CalendarView } from "../views/CalendarView";
import { TableView } from "../views/TableView";
import { KanbanView } from "../views/KanbanView";
import { AnalyticsView } from "../views/AnalyticsView";
import { DashboardStats } from "./DashboardStats";
import { AgentDetailPanel } from "../../agents/components/AgentDetailPanel";
import { AgentDetailModal } from "../../agents/components/AgentDetailModal";
import { SessionDetailModal } from "./SessionDetailModal";
import { Sheet, SheetContent } from "../../../components/ui/sheet";
import { ThemeToggle } from "../../theme/components/ThemeToggle";
import { PreferencesDialog } from "../../settings/components/PreferencesDialog";
import type { AgentSession } from "../../../services/calendar.service";

export function MissionControl() {
  const { agents, loading, error } = useAgents();
  const [clearing, setClearing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AgentSession | null>(null);

  // User preferences
  const { preferences } = useUserPreferences();

  // Zustand store
  const hideDisconnected = useAgentsStore((state) => state.hideDisconnected);
  const toggleHideDisconnected = useAgentsStore((state) => state.toggleHideDisconnected);
  const selectedAgent = useAgentsStore((state) => state.selectedAgent);
  const openPanel = useAgentsStore((state) => state.openPanel);
  const closePanel = useAgentsStore((state) => state.closePanel);
  const viewMode = useAgentsStore((state) => state.viewMode);
  const setViewMode = useAgentsStore((state) => state.setViewMode);
  const getFilteredAgents = useAgentsStore((state) => state.getFilteredAgents);
  const getDisconnectedCount = useAgentsStore((state) => state.getDisconnectedCount);

  // Get status stats
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
      // Query will auto-refetch via invalidation
    } catch (err) {
      console.error("Failed to clear agents:", err);
      alert("Failed to clear agents");
    } finally {
      setClearing(false);
    }
  };

  if (loading && agents.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">Loading agents...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="py-12">
            <div className="text-center text-destructive">Error: {error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <h1 className="text-2xl font-bold">Marionette</h1>
            <CardDescription>Multi-agent monitoring dashboard</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <PreferencesDialog />
            <ThemeToggle />
            {disconnectedCount > 0 && (
              <Button
                variant={hideDisconnected ? "secondary" : "outline"}
                size="sm"
                onClick={toggleHideDisconnected}
              >
                {hideDisconnected ? (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Show {disconnectedCount} Dead
                  </>
                ) : (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Hide {disconnectedCount} Dead
                  </>
                )}
              </Button>
            )}
            {agents.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                disabled={clearing}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {clearing ? "Clearing..." : "Clean Up All"}
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Stats */}
      <DashboardStats agents={agents} />

      {/* Views */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsList>
          <TabsTrigger value="grid">
            <LayoutGrid className="mr-2 h-4 w-4" />
            Grid
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarIcon className="mr-2 h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="table">
            <Table className="mr-2 h-4 w-4" />
            Table
          </TabsTrigger>
          <TabsTrigger value="kanban">
            <Columns className="mr-2 h-4 w-4" />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid">
          <GridView agents={filteredAgents} onAgentClick={openPanel} />
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarView onSessionClick={setSelectedSession} />
        </TabsContent>

        <TabsContent value="table">
          <TableView agents={filteredAgents} onAgentClick={openPanel} />
        </TabsContent>

        <TabsContent value="kanban">
          <KanbanView agents={filteredAgents} onAgentClick={openPanel} />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsView agents={filteredAgents} />
        </TabsContent>
      </Tabs>

      {/* Agent Detail - Sidecard or Modal based on user preference */}
      {preferences.agentDetailView === "sidecard" ? (
        selectedAgent && (
          <Sheet open={!!selectedAgent} onOpenChange={(open) => !open && closePanel()}>
            <SheetContent onClick={closePanel}>
              <div onClick={(e) => e.stopPropagation()}>
                <AgentDetailPanel agent={selectedAgent} onClose={closePanel} hideCloseButton={true} />
              </div>
            </SheetContent>
          </Sheet>
        )
      ) : (
        <AgentDetailModal
          agent={selectedAgent}
          open={!!selectedAgent}
          onClose={closePanel}
        />
      )}

      {/* Session Detail Modal */}
      <SessionDetailModal
        session={selectedSession}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </div>
  );
}
