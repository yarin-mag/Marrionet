import { Palette } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group";
import { useTheme } from "../../theme/contexts/ThemeContext";
import { AgentDetailViewSection } from "./AgentDetailViewSection";
import type { UserPreferences } from "../../../lib/user-preferences";

interface AppearanceSectionProps {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
}

export function AppearanceSection({ preferences, updatePreference }: AppearanceSectionProps) {
  const { theme, setTheme } = useTheme();

  return (
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
              <Label htmlFor="light" className="font-normal cursor-pointer">Light</Label>
            </div>
            <div className="flex items-center space-x-3 space-y-0">
              <RadioGroupItem value="dark" id="dark" />
              <Label htmlFor="dark" className="font-normal cursor-pointer">Dark</Label>
            </div>
            <div className="flex items-center space-x-3 space-y-0">
              <RadioGroupItem value="system" id="system" />
              <Label htmlFor="system" className="font-normal cursor-pointer">System</Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            Choose your preferred color scheme. System will match your OS settings.
          </p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <AgentDetailViewSection
          value={preferences.agentDetailView}
          onChange={(value) => updatePreference("agentDetailView", value)}
        />
      </CardContent>
    </Card>
  );
}
