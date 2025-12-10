"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

export function ThemedToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      position="bottom-left"
      richColors
      closeButton
      theme={theme as "light" | "dark" | "system"}
      toastOptions={{
        className: "text-sm",
        style: {
          padding: "12px 16px",
        },
      }}
    />
  );
}
