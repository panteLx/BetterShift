"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { WorkspaceApiError } from "@/hooks/useWorkspaces";
import { handleRateLimitError } from "@/lib/rate-limit-client";

const KNOWN_CODES = ["forbidden", "owner", "not_member", "limit", "confirmation_mismatch"] as const;
type KnownCode = (typeof KNOWN_CODES)[number];

export function useActionErrorHandler() {
  const t = useTranslations();
  return async (error: unknown) => {
    if (error instanceof WorkspaceApiError) {
      if (error.rateLimitResponse) {
        await handleRateLimitError(error.rateLimitResponse, t);
        return;
      }
      if (error.code && (KNOWN_CODES as readonly string[]).includes(error.code)) {
        toast.error(t(`workspaces.errors.${error.code as KnownCode}`));
        return;
      }
    }
    toast.error(t("workspaces.actionError"));
  };
}
