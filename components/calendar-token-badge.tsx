"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link as LinkIcon, Eye, Edit } from "lucide-react";

interface CalendarTokenBadgeProps {
  /**
   * Token name (optional)
   */
  tokenName?: string | null;

  /**
   * Permission level granted by token
   */
  permission: "read" | "write";

  /**
   * Show full info or compact version
   */
  variant?: "full" | "compact";
}

/**
 * Badge to indicate a calendar is being accessed via share link/token
 * Shown in calendar header when user has token-based access
 */
export function CalendarTokenBadge({
  tokenName,
  permission,
  variant = "full",
}: CalendarTokenBadgeProps) {
  const t = useTranslations();

  if (variant === "compact") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1 cursor-help">
              <LinkIcon className="h-3 w-3" />
              {permission === "read" ? (
                <Eye className="h-3 w-3" />
              ) : (
                <Edit className="h-3 w-3" />
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">{t("token.accessedViaLink")}</p>
              {tokenName && (
                <p className="text-xs text-muted-foreground">
                  {t("token.linkName")}: {tokenName}
                </p>
              )}
              <p className="text-xs">
                {permission === "read"
                  ? t("common.labels.permissions.read")
                  : t("common.labels.permissions.write")}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1.5">
      <LinkIcon className="h-3.5 w-3.5" />
      <span>{t("token.accessedViaLink")}</span>
      {permission === "read" ? (
        <>
          <Eye className="h-3.5 w-3.5" />
          <span>{t("common.labels.permissions.read")}</span>
        </>
      ) : (
        <>
          <Edit className="h-3.5 w-3.5" />
          <span>{t("common.labels.permissions.write")}</span>
        </>
      )}
      {tokenName && (
        <span className="text-muted-foreground">({tokenName})</span>
      )}
    </Badge>
  );
}
