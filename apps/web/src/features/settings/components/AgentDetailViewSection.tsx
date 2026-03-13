import { Label } from "../../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group";
import type { UserPreferences } from "../../../lib/user-preferences";

interface AgentDetailViewSectionProps {
  value: UserPreferences["agentDetailView"];
  onChange: (value: "modal" | "sidecard") => void;
}

export function AgentDetailViewSection({ value, onChange }: AgentDetailViewSectionProps) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">Agent Detail View</Label>
      <RadioGroup value={value} onValueChange={onChange}>
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
  );
}
