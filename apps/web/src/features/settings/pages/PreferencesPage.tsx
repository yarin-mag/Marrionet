import { useNavigate } from "react-router-dom";
import { ArrowLeft, Palette, Layout } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group";
import { useUserPreferences } from "../../../hooks/use-user-preferences";
import { useTheme } from "../../theme/contexts/ThemeContext";

export function PreferencesPage() {
  const navigate = useNavigate();
  const { preferences, updatePreference } = useUserPreferences();
  const { theme, setTheme } = useTheme();

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

      {/* Dashboard Section (Placeholder) */}
      <Card className="opacity-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500">
              <Layout className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle>Dashboard</CardTitle>
              <CardDescription>Coming soon</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Additional dashboard customization options will be available here in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
