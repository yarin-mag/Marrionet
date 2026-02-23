import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { loadPreferences, updatePreference } from "../../../lib/user-preferences";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): "light" | "dark" {
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function getEffectiveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Load from user preferences
    const preferences = loadPreferences();
    return preferences.theme || "system";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const effectiveTheme = getEffectiveTheme(theme);

    root.classList.remove("light", "dark");
    root.classList.add(effectiveTheme);

    // Listen for system theme changes when in system mode
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        const newEffectiveTheme = getEffectiveTheme("system");
        root.classList.remove("light", "dark");
        root.classList.add(newEffectiveTheme);
      };

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    updatePreference("theme", newTheme);
  };

  const toggleTheme = () => {
    const effectiveTheme = getEffectiveTheme(theme);
    const newTheme = effectiveTheme === "light" ? "dark" : "light";
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
