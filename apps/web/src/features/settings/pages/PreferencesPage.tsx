import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useUserPreferences } from "../../../hooks/use-user-preferences";
import { useMcpPreferences } from "../hooks/use-mcp-preferences";
import { AppearanceSection } from "../components/AppearanceSection";
import { DashboardSection } from "../components/DashboardSection";
import { NotificationsSection } from "../components/NotificationsSection";
import { McpIntegrationSection } from "../components/McpIntegrationSection";

export function PreferencesPage() {
  const navigate = useNavigate();
  const { preferences, updatePreference } = useUserPreferences();
  const { mcpSetTaskEnabled, mcpJiraEnabled, saveError, handleMcpToggle, handleJiraToggle } = useMcpPreferences();

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Preferences</h1>
        <p className="text-muted-foreground mt-2">Customize your Marionette experience</p>
      </div>

      <AppearanceSection preferences={preferences} updatePreference={updatePreference} />
      <DashboardSection preferences={preferences} updatePreference={updatePreference} />
      <NotificationsSection
        notifications={preferences.notifications}
        onUpdate={(updated) => updatePreference("notifications", updated)}
      />
      <McpIntegrationSection
        mcpSetTaskEnabled={mcpSetTaskEnabled}
        mcpJiraEnabled={mcpJiraEnabled}
        onMcpToggle={handleMcpToggle}
        onJiraToggle={handleJiraToggle}
        saveError={saveError}
      />
    </div>
  );
}
