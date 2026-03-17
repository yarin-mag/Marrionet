import { useState } from "react";
import { Bell, MessageSquare, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Button } from "../../../components/ui/button";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group";
import type { NotificationPreferences } from "../../../lib/user-preferences";

interface NotificationsSectionProps {
  notifications: NotificationPreferences;
  onUpdate: (updated: NotificationPreferences) => void;
  notificationChannel: "browser" | "discord";
  onChannelChange: (channel: "browser" | "discord") => Promise<void>;
  webhookUrl: string | null;
  webhookSaveError: string | null;
  webhookTestStatus: "idle" | "success" | "error";
  onWebhookChange: (value: string) => Promise<void>;
  onWebhookTest: () => Promise<void>;
}

export function NotificationsSection({
  notifications,
  onUpdate,
  notificationChannel,
  onChannelChange,
  webhookUrl,
  webhookSaveError,
  webhookTestStatus,
  onWebhookChange,
  onWebhookTest,
}: NotificationsSectionProps) {
  const [showUrl, setShowUrl] = useState(false);

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
            <CardDescription>Choose how you want to be notified about agent events</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Notification channel</Label>
          <RadioGroup
            value={notificationChannel}
            onValueChange={(v) => void onChannelChange(v as "browser" | "discord")}
            className="grid grid-cols-2 gap-3"
          >
            <label
              htmlFor="channel-browser"
              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                notificationChannel === "browser"
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/40"
              }`}
            >
              <RadioGroupItem value="browser" id="channel-browser" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium leading-none">Browser</p>
                <p className="text-xs text-muted-foreground">Desktop pop-ups</p>
              </div>
            </label>
            <label
              htmlFor="channel-discord"
              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                notificationChannel === "discord"
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/40"
              }`}
            >
              <RadioGroupItem value="discord" id="channel-discord" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium leading-none">Discord</p>
                <p className="text-xs text-muted-foreground">Webhook messages</p>
              </div>
            </label>
          </RadioGroup>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {notificationChannel === "browser" && (
          <div className="space-y-6">
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
          </div>
        )}

        {notificationChannel === "discord" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              Discord webhook
            </div>
            <div className="space-y-2">
              <Label htmlFor="discord-webhook">Webhook URL</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="discord-webhook"
                    type={showUrl ? "text" : "password"}
                    placeholder="https://discord.com/api/webhooks/..."
                    value={webhookUrl ?? ""}
                    onChange={(e) => void onWebhookChange(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-9 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUrl((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!webhookUrl}
                  onClick={onWebhookTest}
                >
                  Test
                </Button>
              </div>
              {webhookTestStatus === "success" && (
                <p className="text-xs text-green-600 dark:text-green-400">Test message sent! Check your Discord channel.</p>
              )}
              {webhookTestStatus === "error" && (
                <p className="text-xs text-destructive">Test failed. Double-check the webhook URL.</p>
              )}
              {webhookSaveError && (
                <p className="text-xs text-destructive">{webhookSaveError}</p>
              )}
            </div>

            <div className="rounded-md border border-muted bg-muted/30 p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">How to get a webhook URL</p>
              <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
                <li>Open your Discord server → go to the channel you want</li>
                <li>Channel Settings → Integrations → Webhooks → New Webhook</li>
                <li>Copy the webhook URL and paste it above</li>
              </ol>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold">You'll be notified when:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>A session finishes — with task name, duration, and token count</li>
                <li>An agent crashes or hits an error</li>
                <li>An agent is waiting for your input</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
