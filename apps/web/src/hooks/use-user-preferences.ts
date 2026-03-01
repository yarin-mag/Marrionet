import { useState, useCallback } from "react";
import type { UserPreferences } from "../lib/user-preferences";
import { loadPreferences, savePreferences, DEFAULT_PREFERENCES } from "../lib/user-preferences";

/**
 * Hook for managing user preferences with persistence
 */
export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(() => loadPreferences());

  // Update a specific preference
  const updatePreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences((current) => {
      const updated = { ...current, [key]: value };
      savePreferences(updated);
      return updated;
    });
  }, []);

  // Update multiple preferences at once
  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    setPreferences((current) => {
      const updated = { ...current, ...updates };
      savePreferences(updated);
      return updated;
    });
  }, []);

  // Reset to defaults
  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    savePreferences(DEFAULT_PREFERENCES);
  }, []);

  return {
    preferences,
    updatePreference,
    updatePreferences,
    resetPreferences,
  };
}
