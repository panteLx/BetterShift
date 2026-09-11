"use client";

import { Eye } from "lucide-react";
import { StatusBanner } from "@/components/status-banner";

interface ReadOnlyBannerProps {
  title?: string;
  message?: string;
  variant?: "default" | "compact";
}

export function ReadOnlyBanner({ title, message }: ReadOnlyBannerProps) {
  return (
    <StatusBanner tone="warning" icon={Eye} title={title}>
      {message}
    </StatusBanner>
  );
}
