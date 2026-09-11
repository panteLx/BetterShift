"use client";

import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link as LinkIcon } from "lucide-react";
import { Pill } from "@/components/form-kit";

interface CalendarTokenBadgeProps {
  tokenName?: string | null;
  permission: "read" | "write";
  variant?: "full" | "compact";
}

/** Marks a calendar opened through an access link. */
export function CalendarTokenBadge({
  tokenName,
  permission,
  variant = "full",
}: CalendarTokenBadgeProps) {
  const t = useTranslations();
  const tone = permission === "write" ? "warning" : "neutral";
  const permissionLabel =
    permission === "write" ? t("sharingSheet.permWrite") : t("sharingSheet.permRead");

  if (variant === "compact") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} aria-label={t("token.accessedViaLink")} className="inline-flex">
              <Pill tone={tone} className="cursor-help">
                <LinkIcon className="size-3" />
              </Pill>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-semibold">{t("token.accessedViaLink")}</p>
            {tokenName && (
              <p className="text-xs opacity-80">
                {t("token.linkName")}: {tokenName}
              </p>
            )}
            <p className="text-xs">{permissionLabel}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Pill tone={tone}>
      <LinkIcon className="size-3" />
      {t("token.accessedViaLink")} · {permissionLabel}
      {tokenName && <span className="font-normal opacity-80">({tokenName})</span>}
    </Pill>
  );
}
