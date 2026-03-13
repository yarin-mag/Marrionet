import { Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import type { NotificationPreferences } from "../../../lib/user-preferences";

interface NotificationsSectionProps {
  notifications: NotificationPreferences;
  onUpdate: (updated: NotificationPreferences) => void;
}

export function NotificationsSection({ notifications, onUpdate }: NotificationsSectionProps) {
  function toggle<K extends keyof NotificationPreferences>(key: K, value: boolean) {
    onUpdate({ ...notifications, [key]: value });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-400 to-teal-500">
            <Bell className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Choose which agent events trigger browser notifications</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label className="text-base font-semibold">Agent awaits your response</Label>
            <p className="text-xs text-muted-foreground">
              Fires when an agent is waiting for your input. Debounced by 2s to avoid noise from
              brief status flickers.
            </p>
          </div>
          <Switch
            checked={notifications.awaitingInput}
            onCheckedChange={(value) => toggle("awaitingInput", value)}
          />
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label className="text-base font-semibold">Agent session finished</Label>
            <p className="text-xs text-muted-foreground">
              Fires when an agent finishes or disconnects.
            </p>
          </div>
          <Switch
            checked={notifications.agentFinished}
            onCheckedChange={(value) => toggle("agentFinished", value)}
          />
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label className="text-base font-semibold">Agent error or crash</Label>
            <p className="text-xs text-muted-foreground">
              Fires when an agent encounters an error or crashes unexpectedly.
            </p>
          </div>
          <Switch
            checked={notifications.agentError}
            onCheckedChange={(value) => toggle("agentError", value)}
          />
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label className="text-base font-semibold">New agent started</Label>
            <p className="text-xs text-muted-foreground">
              Fires when a new Claude Code session is detected for the first time.
            </p>
          </div>
          <Switch
            checked={notifications.agentStarted}
            onCheckedChange={(value) => toggle("agentStarted", value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
