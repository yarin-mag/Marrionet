import { useEffect, useState } from "react";
import { fetchServerPreference, saveServerPreference } from "../../../lib/user-preferences";

interface McpPreferences {
  mcpSetTaskEnabled: boolean | null;
  mcpJiraEnabled: boolean | null;
  saveError: string | null;
  handleMcpToggle: (value: boolean) => Promise<void>;
  handleJiraToggle: (value: boolean) => Promise<void>;
}

export function useMcpPreferences(): McpPreferences {
  // Initialize as null so the toggles don't flash from true→false while
  // the server preference is being fetched.
  const [mcpSetTaskEnabled, setMcpSetTaskEnabled] = useState<boolean | null>(null);
  const [mcpJiraEnabled, setMcpJiraEnabled] = useState<boolean | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchServerPreference("mcpSetTaskEnabled", true).then(setMcpSetTaskEnabled);
    fetchServerPreference("mcpJiraEnabled", true).then(setMcpJiraEnabled);
  }, []);

  async function handleMcpToggle(value: boolean) {
    setMcpSetTaskEnabled(value);
    try {
      await saveServerPreference("mcpSetTaskEnabled", value);
      setSaveError(null);
    } catch {
      setSaveError("Failed to save preference. Check your connection.");
    }
  }

  async function handleJiraToggle(value: boolean) {
    setMcpJiraEnabled(value);
    try {
      await saveServerPreference("mcpJiraEnabled", value);
      setSaveError(null);
    } catch {
      setSaveError("Failed to save preference. Check your connection.");
    }
  }

  return { mcpSetTaskEnabled, mcpJiraEnabled, saveError, handleMcpToggle, handleJiraToggle };
}
