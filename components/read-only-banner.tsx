"use client";

import { Eye, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReadOnlyBannerProps {
  message?: string;
  variant?: "default" | "compact";
}

export function ReadOnlyBanner({
  message,
  variant = "default",
}: ReadOnlyBannerProps) {
  if (variant === "compact") {
    return (
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-md p-2 flex items-center gap-2">
        <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <p className="text-xs text-blue-900 dark:text-blue-100">{message}</p>
      </div>
    );
  }

  return (
    <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50">
      <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
        {message}
      </AlertDescription>
    </Alert>
  );
}
