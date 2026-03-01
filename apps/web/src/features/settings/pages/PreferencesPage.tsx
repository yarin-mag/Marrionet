import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Palette, Layout, Wrench } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group";
import { Switch } from "../../../components/ui/switch";
import { useUserPreferences } from "../../../hooks/use-user-preferences";
import { useTheme } from "../../theme/contexts/ThemeContext";
import { fetchServerPreference, saveServerPreference } from "../../../lib/user-preferences";

export function PreferencesPage() {
  const navigate = useNavigate();
  const { preferences, updatePreference } = useUserPreferences();
  const { theme, setTheme } = useTheme();
  // Initialize as null so the toggles don't flash from true→false while
  // the server preference is being fetched.
  const [mcpSetTaskEnabled, setMcpSetTaskEnabled] = useState<boolean | null>(null);
  const [mcpJiraEnabled, setMcpJiraEnabled] = useState<boolean | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchServerPreference("mcpSetTaskEnabled", true).then(setMcpSetTaskEnabled);
    fetchServerPreference("mcpJiraEnabled", true).then(setMcpJiraEnabled);
  }, []);

  async function handleMcpToggle(value: boolean) {
    setMcpSetTaskEnabled(value);
    try {
      await saveServerPreference("mcpSetTaskEnabled", value);
      setSaveError(null);
    } catch {
      setSaveError("Failed to save preference. Check your connection.");
    }
  }

  async function handleJiraToggle(value: boolean) {
    setMcpJiraEnabled(value);
    try {
      await saveServerPreference("mcpJiraEnabled", value);
      setSaveError(null);
    } catch {
      setSaveError("Failed to save preference. Check your connection.");
    }
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Preferences</h1>
        <p className="text-muted-foreground mt-2">
          Customize your Marionette experience
        </p>
      </div>

      {/* Appearance Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500">
              <Palette className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look and feel of the dashboard</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Theme</Label>
            <RadioGroup
              value={theme}
              onValueChange={(value: "light" | "dark" | "system") => {
                setTheme(value);
                updatePreference("theme", value);
              }}
            >
              <div className="flex items-center space-x-3 space-y-0">
                <RadioGroupItem value="light" id="light" />
                <Label htmlFor="light" className="font-normal cursor-pointer">
                  Light
                </Label>
              </div>
              <div className="flex items-center space-x-3 space-y-0">
                <RadioGroupItem value="dark" id="dark" />
                <Label htmlFor="dark" className="font-normal cursor-pointer">
                  Dark
                </Label>
              </div>
              <div className="flex items-center space-x-3 space-y-0">
                <RadioGroupItem value="system" id="system" />
                <Label htmlFor="system" className="font-normal cursor-pointer">
                  System
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Choose your preferred color scheme. System will match your OS settings.
            </p>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Agent Detail View */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Agent Detail View</Label>
            <RadioGroup
              value={preferences.agentDetailView}
              onValueChange={(value: "modal" | "sidecard") =>
                updatePreference("agentDetailView", value)
              }
            >
              <div className="flex items-center space-x-3 space-y-0">
                <RadioGroupItem value="modal" id="modal" />
                <Label htmlFor="modal" className="font-normal cursor-pointer">
                  Modal (Center)
                </Label>
              </div>
              <div className="flex items-center space-x-3 space-y-0">
                <RadioGroupItem value="sidecard" id="sidecard" />
                <Label htmlFor="sidecard" className="font-normal cursor-pointer">
                  Sidecard (Right Panel)
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Choose how agent details appear when clicking from grid, table, or kanban views.
              Calendar events always use modal.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500">
              <Layout className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle>Dashboard</CardTitle>
              <CardDescription>Customize dashboard behavior</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Calendar click-to-add toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Allow calendar task creation</Label>
              <p className="text-xs text-muted-foreground">
                Click an empty calendar slot to create a personal task. Disabled by default.
              </p>
            </div>
            <Switch
              id="calendarClickToAdd"
              checked={preferences.calendarClickToAdd}
              onCheckedChange={(value) => updatePreference("calendarClickToAdd", value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* MCP Integration Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-400 to-red-500">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle>MCP Integration</CardTitle>
              <CardDescription>Control Marionette MCP tool availability</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Set curated task name (current_task)</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, Claude calls <code>marionette_set_task</code> to set the active task
                name shown in the dashboard.
              </p>
            </div>
            <Switch
              id="mcpSetTaskEnabled"
              checked={mcpSetTaskEnabled ?? false}
              disabled={mcpSetTaskEnabled === null}
              onCheckedChange={handleMcpToggle}
            />
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Auto-sync Jira ticket IDs</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, ticket IDs (e.g. <code>ABC-123</code>) found in task names are
                extracted and synced to the database.
              </p>
            </div>
            <Switch
              id="mcpJiraEnabled"
              checked={mcpJiraEnabled ?? false}
              disabled={mcpJiraEnabled === null}
              onCheckedChange={handleJiraToggle}
            />
          </div>

          {saveError && (
            <p className="text-sm text-destructive">{saveError}</p>
          )}

          <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 space-y-1">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Caveats (apply to both features above)</p>
            <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
              <li>Requires the Marionette MCP server to be loaded in Claude Code</li>
              <li>Relies on Claude following instructions — not guaranteed every call</li>
              <li>Adds token cost per session start when active</li>
              <li>Changes take effect on the next Claude Code session (not current)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
