import { Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";

interface McpIntegrationSectionProps {
  mcpSetTaskEnabled: boolean | null;
  mcpJiraEnabled: boolean | null;
  onMcpToggle: (value: boolean) => Promise<void>;
  onJiraToggle: (value: boolean) => Promise<void>;
  saveError: string | null;
}

export function McpIntegrationSection({
  mcpSetTaskEnabled,
  mcpJiraEnabled,
  onMcpToggle,
  onJiraToggle,
  saveError,
}: McpIntegrationSectionProps) {
  return (
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
            onCheckedChange={onMcpToggle}
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
            onCheckedChange={onJiraToggle}
          />
        </div>

        {saveError && (
          <p className="text-sm text-destructive">{saveError}</p>
        )}

        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 space-y-1">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            Caveats (apply to both features above)
          </p>
          <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
            <li>Requires the Marionette MCP server to be loaded in Claude Code</li>
            <li>Relies on Claude following instructions — not guaranteed every call</li>
            <li>Adds token cost per session start when active</li>
            <li>Changes take effect on the next Claude Code session (not current)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
