"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/status-banner";

export function LoadErrorBanner({ item, onRetry }: { item: string; onRetry: () => void }) {
  const t = useTranslations();
  return (
    <StatusBanner
      tone="danger"
      icon={TriangleAlert}
      title={t("common.error")}
      action={
        <Button variant="outline" size="sm" className="h-9 font-semibold" onClick={onRetry}>
          {t("calendarView.retry")}
        </Button>
      }
    >
      {t("common.fetchError", { item })}
    </StatusBanner>
  );
}
