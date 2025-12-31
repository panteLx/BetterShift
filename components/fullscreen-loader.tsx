"use client";

import { Loader2 } from "lucide-react";
import { motion } from "motion/react";

interface FullscreenLoaderProps {
  message?: string;
}

/**
 * Fullscreen loading spinner component
 *
 * Shows a centered spinner with optional message during initial page load.
 * Prevents skeleton flicker by providing single consistent loading state.
 *
 * Usage:
 * ```tsx
 * {isLoading ? <FullscreenLoader message="Loading calendars..." /> : <PageContent />}
 * ```
 */
export function FullscreenLoader({ message }: FullscreenLoaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: 0.1 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
    >
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      {message && (
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      )}
    </motion.div>
  );
}
