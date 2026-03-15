/**
 * User Preferences System
 * Manages user settings with localStorage persistence
 */
import { API_URL } from "./constants";

export interface NotificationPreferences {
  awaitingInput: boolean;
  agentFinished: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  awaitingInput: true,
  agentFinished: true,
};

export interface UserPreferences {
  agentDetailView: "modal" | "sidecard";
  theme?: "light" | "dark" | "system";
  calendarClickToAdd: boolean;
  mcpSetTaskEnabled?: boolean;
  notifications: NotificationPreferences;
}

const STORAGE_KEY = "marionette_user_preferences";

export const DEFAULT_PREFERENCES: UserPreferences = {
  agentDetailView: "modal",
  theme: "system",
  calendarClickToAdd: false,
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
};

/**
 * Load preferences from localStorage
 */
export function loadPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
        notifications: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...(parsed.notifications ?? {}),
        },
      };
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

/**
 * Fetch a single preference value from the server
 */
export async function fetchServerPreference<T>(key: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}/api/preferences`);
    if (!res.ok) return fallback;
    const prefs = await res.json() as Record<string, unknown>;
    return key in prefs ? (prefs[key] as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Save a single preference value to the server.
 * Throws if the server responds with a non-2xx status so callers can surface the error.
 */
export async function saveServerPreference(key: string, value: unknown): Promise<void> {
  const res = await fetch(`${API_URL}/api/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [key]: value }),
  });
  if (!res.ok) throw new Error(`Failed to save preference "${key}": ${res.status}`);
}
