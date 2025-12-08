"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemedToaster() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

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
