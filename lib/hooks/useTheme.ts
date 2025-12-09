/**
 * Theme management hook
 */

import { useState, useEffect } from "react";

export type Theme = "light" | "dark" | "auto";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "auto";
    const stored = localStorage.getItem("theme") as Theme | null;
    return stored || "auto";
  });

  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === "auto") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    } else {
      root.classList.toggle("dark", theme === "dark");
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => {
      if (current === "light") return "dark";
      if (current === "dark") return "auto";
      return "light";
    });
  };

  return { theme, setTheme, toggleTheme };
}

