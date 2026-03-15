import { useState } from "react";
import { MessageSquare, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";

interface DiscordSectionProps {
  webhookUrl: string | null;
  saveError: string | null;
  testStatus: "idle" | "success" | "error";
  onUpdate: (value: string) => Promise<void>;
  onTest: () => Promise<void>;
}

export function DiscordSection({ webhookUrl, saveError, testStatus, onUpdate, onTest }: DiscordSectionProps) {
  const [showUrl, setShowUrl] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle>Discord Notifications</CardTitle>
            <CardDescription>Get notified in Discord when sessions finish or agents crash</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="discord-webhook">Webhook URL</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="discord-webhook"
                type={showUrl ? "text" : "password"}
                placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl ?? ""}
                onChange={(e) => onUpdate(e.target.value)}
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
              onClick={onTest}
            >
              Test
            </Button>
          </div>
          {testStatus === "success" && (
            <p className="text-xs text-green-600 dark:text-green-400">Test message sent! Check your Discord channel.</p>
          )}
          {testStatus === "error" && (
            <p className="text-xs text-destructive">Test failed. Double-check the webhook URL.</p>
          )}
          {saveError && (
            <p className="text-xs text-destructive">{saveError}</p>
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
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
