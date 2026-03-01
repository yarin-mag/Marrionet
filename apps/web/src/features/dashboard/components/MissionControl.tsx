import { LayoutGrid, Table, Columns, BarChart3, Calendar as CalendarIcon, GitCompare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { Card, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { GridView } from "../views/GridView";
import { CalendarView } from "../views/CalendarView";
import { TableView } from "../views/TableView";
import { KanbanView } from "../views/KanbanView";
import { AnalyticsView } from "../views/AnalyticsView";
import { CompareView } from "../views/CompareView";
import { DashboardStats } from "./DashboardStats";
import { MissionControlHeader } from "./MissionControlHeader";
import { AgentDetailPanel } from "../../agents/components/AgentDetailPanel";
import { AgentDetailModal } from "../../agents/components/AgentDetailModal";
import { SessionDetailModal } from "./SessionDetailModal";
import { SessionDetail } from "./SessionDetail";
import { Sheet, SheetContent } from "../../../components/ui/sheet";
import { useUserPreferences } from "../../../hooks/use-user-preferences";
import { useAgentNotifications } from "../../../hooks/use-agent-notifications";
import { useMissionControlState } from "../hooks/useMissionControlState";
import { useAgentsStore } from "../../agents/stores/agents.store";

type ViewMode = "grid" | "calendar" | "table" | "kanban" | "analytics" | "compare";

export function MissionControl() {
  const {
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
    viewMode,
    setViewMode,
    filteredAgents,
    disconnectedCount,
    handleClearAll,
  } = useMissionControlState();

  const { preferences } = useUserPreferences();
  const { compareSet } = useAgentsStore();
  useAgentNotifications(agents);

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
      <MissionControlHeader
        wsConnected={wsConnected}
        agentCount={agents.length}
        disconnectedCount={disconnectedCount}
        hideDisconnected={hideDisconnected}
        toggleHideDisconnected={toggleHideDisconnected}
        clearing={clearing}
        onClearAll={handleClearAll}
      />

      <DashboardStats agents={agents} />

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
        <TabsList>
          <TabsTrigger value="grid" activeClassName="bg-gradient-to-r from-blue-500 to-indigo-600 shadow-blue-500/30">
            <LayoutGrid className="h-4 w-4" />
            Grid
          </TabsTrigger>
          <TabsTrigger value="calendar" activeClassName="bg-gradient-to-r from-violet-500 to-purple-600 shadow-violet-500/30">
            <CalendarIcon className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="table" activeClassName="bg-gradient-to-r from-teal-500 to-cyan-600 shadow-teal-500/30">
            <Table className="h-4 w-4" />
            Table
          </TabsTrigger>
          <TabsTrigger value="kanban" activeClassName="bg-gradient-to-r from-orange-500 to-amber-500 shadow-orange-500/30">
            <Columns className="h-4 w-4" />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="analytics" activeClassName="bg-gradient-to-r from-rose-500 to-pink-600 shadow-rose-500/30">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="compare" activeClassName="bg-gradient-to-r from-cyan-500 to-sky-600 shadow-cyan-500/30">
            <GitCompare className="h-4 w-4" />
            Compare
            {compareSet.length > 0 && (
              <Badge variant="primary" size="sm" className="ml-1">
                {compareSet.length}
              </Badge>
            )}
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
        <TabsContent value="compare">
          <CompareView agents={agents} onAgentClick={openPanel} />
        </TabsContent>
      </Tabs>

      {preferences.agentDetailView === "sidecard" ? (
        selectedAgent && (
          <Sheet open={!!selectedAgent} onOpenChange={(open) => !open && closePanel()}>
            <SheetContent onClick={closePanel} onClose={closePanel}>
              <AgentDetailPanel agent={selectedAgent} onClose={closePanel} hideCloseButton={true} />
            </SheetContent>
          </Sheet>
        )
      ) : (
        <AgentDetailModal agent={selectedAgent} open={!!selectedAgent} onClose={closePanel} />
      )}

      {preferences.agentDetailView === "sidecard" ? (
        selectedSession && (
          <Sheet open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
            <SheetContent onClick={() => setSelectedSession(null)} onClose={() => setSelectedSession(null)}>
              <SessionDetail session={selectedSession} />
            </SheetContent>
          </Sheet>
        )
      ) : (
        <SessionDetailModal
          session={selectedSession}
          open={!!selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}
