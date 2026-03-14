import { useState } from "react";
import { Check, Bell } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useTokenAlerts } from "../../../hooks/use-token-alerts";
import { formatTokens } from "../../../lib/utils";

interface TokenAlertsSectionProps {
  agentId: string;
}

export function TokenAlertsSection({ agentId }: TokenAlertsSectionProps) {
  const { alerts, addAlert, updateAlert, removeAlert } = useTokenAlerts(agentId);
  const [newThreshold, setNewThreshold] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const sorted = [...alerts].sort((a, b) => a.threshold - b.threshold);

  function handleAdd() {
    const val = Number(newThreshold);
    if (!val || val <= 0) return;
    addAlert(val);
    setNewThreshold("");
  }

  function startEdit(id: string, current: number) {
    setEditingId(id);
    setEditValue(String(current));
  }

  function commitEdit(id: string) {
    const val = Number(editValue);
    if (val > 0) updateAlert(id, val);
    setEditingId(null);
  }

  return (
    <div className="pt-2">
      <p className="text-xs text-muted-foreground mb-2">Token alerts</p>

      {/* Add new alert */}
      <div className="flex gap-2 mb-3">
        <input
          type="number"
          min="1"
          step="1"
          value={newThreshold}
          onChange={(e) => setNewThreshold(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Notify me when tokens exceed…"
          className="flex-1 text-sm bg-muted/30 border border-border/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleAdd}
          disabled={!newThreshold || Number(newThreshold) <= 0}
          className="gap-1 shrink-0"
        >
          <Bell className="h-3 w-3" />
          Add
        </Button>
      </div>

      {/* Active alerts list */}
      {sorted.length > 0 && (
        <div className="space-y-1">
          {sorted.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center gap-2 text-sm rounded px-2 py-1.5 ${
                alert.fired ? "opacity-50" : "bg-muted/20"
              }`}
            >
              {alert.fired ? (
                <Check className="h-3 w-3 text-green-500 shrink-0" />
              ) : (
                <div className="h-3 w-3 rounded-full border border-muted-foreground/40 shrink-0" />
              )}

              {editingId === alert.id ? (
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={editValue}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit(alert.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => commitEdit(alert.id)}
                  className="flex-1 text-sm bg-muted/30 border border-border/50 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              ) : (
                <span className={`flex-1 tabular-nums ${alert.fired ? "line-through text-muted-foreground" : ""}`}>
                  {formatTokens(alert.threshold)} tokens
                </span>
              )}

              {alert.fired && (
                <span className="text-xs text-muted-foreground/60 shrink-0">fired</span>
              )}

              {!alert.fired && editingId !== alert.id && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => startEdit(alert.id, alert.threshold)}
                >
                  Edit
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => removeAlert(alert.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
