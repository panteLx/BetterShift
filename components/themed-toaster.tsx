"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";

export function ThemedToaster() {
  const { theme } = useTheme();
  const desktop = useMediaQuery(DESKTOP_QUERY, true);

  return (
    <Toaster
      // On mobile the view-mode switcher and month/week arrows sit in the top row too
      position={desktop ? "top-center" : "bottom-center"}
      closeButton
      theme={theme as "light" | "dark" | "system"}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-[11px] !border !border-line !bg-popover !text-fg-strong !shadow-window !text-[13px] !font-sans",
          description: "!text-fg-secondary",
          success: "[&_[data-icon]]:!text-success-dot",
          error: "!border-danger-line !bg-danger-surface [&_[data-icon]]:!text-danger",
          warning: "!border-warning-line !bg-warning-surface [&_[data-icon]]:!text-warning",
          closeButton: "!border-line !bg-popover !text-fg-tertiary",
        },
        style: { padding: "12px 14px" },
      }}
    />
  );
}
