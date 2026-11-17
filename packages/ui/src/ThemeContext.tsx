"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";
import { Sun, Moon } from "lucide-react";

export type Theme = "light" | "dark";

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = "light",
  storageKey = "bio_canvas_theme",
}) => {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [, startTransition] = useTransition();

  useEffect(() => {
    // Read stored preference or system preference on initial mount
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    let initial: Theme = defaultTheme;

    if (stored === "light" || stored === "dark") {
      initial = stored;
    } else if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      initial = "dark";
    }

    setThemeState(initial);
    applyThemeToDOM(initial);
  }, [defaultTheme, storageKey]);

  const applyThemeToDOM = (newTheme: Theme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-theme", newTheme);
    if (newTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  };

  const setTheme = (newTheme: Theme) => {
    startTransition(() => {
      setThemeState(newTheme);
      applyThemeToDOM(newTheme);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, newTheme);
        } catch {
          // ignore quota errors
        }
      }
    });
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === "dark",
  };

  // Render children immediately (with server fallback) to avoid hydration mismatch
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if rendered outside ThemeProvider
    return {
      theme: "light",
      setTheme: () => {},
      toggleTheme: () => {},
      isDark: false,
    };
  }
  return context;
}

export interface ThemeToggleProps {
  style?: React.CSSProperties;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  style,
  className,
  showLabel = false,
  size = "sm",
}) => {
  const { toggleTheme, isDark } = useTheme();

  const iconSize = size === "sm" ? 15 : size === "md" ? 18 : 20;
  const padding = size === "sm" ? "6px 10px" : size === "md" ? "8px 14px" : "10px 18px";
  const fontSize = size === "sm" ? "12px" : size === "md" ? "13px" : "14px";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
      aria-label={`Switch to ${isDark ? "Light" : "Dark"} mode`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding,
        fontSize,
        fontWeight: 500,
        borderRadius: "8px",
        border: "1px solid var(--border, #e2e8f0)",
        backgroundColor: "var(--surface, #ffffff)",
        color: "var(--foreground, #0f172a)",
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxShadow: "var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.04))",
        userSelect: "none",
        ...style,
      }}
      className={className}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--surface-hover, #f1f5f9)";
        e.currentTarget.style.borderColor = "var(--border-strong, #cbd5e1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--surface, #ffffff)";
        e.currentTarget.style.borderColor = "var(--border, #e2e8f0)";
      }}
    >
      {isDark ? (
        <Sun size={iconSize} color="#f59e0b" style={{ flexShrink: 0 }} />
      ) : (
        <Moon size={iconSize} color="#6366f1" style={{ flexShrink: 0 }} />
      )}
      {showLabel && <span>{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
};
