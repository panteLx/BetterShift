"use client";

import { useState, useLayoutEffect } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations();
  const [mounted, setMounted] = useState(false);

  // Set mounted after initial render to avoid hydration mismatch
  // This is a legitimate pattern for SSR hydration - calling setState in useLayoutEffect
  // is the recommended approach to avoid hydration mismatches in client components.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Render placeholder with same dimensions during SSR
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
        <div className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9"
      title={
        theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")
      }
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      <span className="sr-only">
        {theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")}
      </span>
    </Button>
  );
}
