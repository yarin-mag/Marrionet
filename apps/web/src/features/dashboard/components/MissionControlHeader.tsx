import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { ThemeToggle } from "../../theme/components/ThemeToggle";
import { PreferencesDialog } from "../../settings/components/PreferencesDialog";

interface MissionControlHeaderProps {
  wsConnected: boolean;
  agentCount: number;
  disconnectedCount: number;
  hideDisconnected: boolean;
  toggleHideDisconnected: () => void;
  clearing: boolean;
  onClearAll: () => void;
}

export function MissionControlHeader({
  wsConnected,
  agentCount,
  disconnectedCount,
  hideDisconnected,
  toggleHideDisconnected,
  clearing,
  onClearAll,
}: MissionControlHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-indigo-500/5 dark:from-primary/15 dark:to-indigo-600/8" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl dark:bg-primary/20" />
      <div className="pointer-events-none absolute -bottom-6 left-1/3 h-20 w-20 rounded-full bg-violet-400/10 blur-2xl" />

      <div className="relative flex items-center justify-between px-6 py-5">
        {/* Logo + Branding */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 shadow-lg shadow-primary/40">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
            >
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="3" y1="5" x2="21" y2="5" />
              <line x1="6" y1="5" x2="6" y2="12" />
              <line x1="18" y1="5" x2="18" y2="12" />
              <line x1="12" y1="5" x2="12" y2="9" />
              <line x1="12" y1="9" x2="12" y2="17" />
              <circle cx="6" cy="14" r="2" />
              <circle cx="18" cy="14" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">Marionette</h1>
              <Badge variant={wsConnected ? "success" : "warning"} size="sm" showDot>
                {wsConnected ? "Live" : "Reconnecting..."}
              </Badge>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              Multi-agent monitoring dashboard
              {agentCount > 0 && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="font-medium text-foreground/70">
                    {agentCount} agent{agentCount !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
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
                <><Eye className="mr-1.5 h-4 w-4" />Show {disconnectedCount}</>
              ) : (
                <><EyeOff className="mr-1.5 h-4 w-4" />Hide {disconnectedCount}</>
              )}
            </Button>
          )}
          {agentCount > 0 && (
            <Button variant="outline" size="sm" onClick={onClearAll} disabled={clearing}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              {clearing ? "Clearing..." : "Clean Up"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
