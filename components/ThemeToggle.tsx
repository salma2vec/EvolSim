/**
 * Theme toggle component
 */

"use client";

import { useTheme } from "@/lib/hooks/useTheme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="px-3 py-2 border border-border hover:bg-foreground hover:text-background transition-colors text-xs uppercase font-mono"
      aria-label="Toggle theme"
      title={`Current theme: ${theme}`}
    >
      {theme === "light" ? "☀" : theme === "dark" ? "🌙" : "⚙"}
    </button>
  );
}

