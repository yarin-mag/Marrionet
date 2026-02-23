/**
 * User Preferences System
 * Manages user settings with localStorage persistence
 */

export interface UserPreferences {
  agentDetailView: "modal" | "sidecard";
  theme?: "light" | "dark" | "system";
}

const STORAGE_KEY = "marionette_user_preferences";

const DEFAULT_PREFERENCES: UserPreferences = {
  agentDetailView: "modal", // Default to modal
  theme: "system",
};

/**
 * Load preferences from localStorage
 */
export function loadPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch (error) {
    console.error("Failed to load user preferences:", error);
  }
  return DEFAULT_PREFERENCES;
}

/**
 * Save preferences to localStorage
 */
export function savePreferences(preferences: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error("Failed to save user preferences:", error);
  }
}

/**
 * Update a specific preference
 */
export function updatePreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K]
): void {
  const current = loadPreferences();
  const updated = { ...current, [key]: value };
  savePreferences(updated);
}

/**
 * Get a specific preference value
 */
export function getPreference<K extends keyof UserPreferences>(
  key: K
): UserPreferences[K] {
  const preferences = loadPreferences();
  return preferences[key];
}
