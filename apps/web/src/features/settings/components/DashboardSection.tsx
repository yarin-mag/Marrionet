import { Layout } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import type { UserPreferences } from "../../../lib/user-preferences";

interface DashboardSectionProps {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
}

export function DashboardSection({ preferences, updatePreference }: DashboardSectionProps) {
  return (
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
  );
}
