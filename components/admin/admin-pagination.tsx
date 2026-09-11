"use client";

import { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "26–50 of 120" plus previous/next for a server-paginated admin list. Fills its
 * row, so it works as a table footer and below the phone cards alike.
 */
export function AdminPagination({
  page,
  pageSize,
  shown,
  total,
  onPageChange,
  extra,
  className,
}: {
  /** 1-based page the rows belong to */
  page: number;
  pageSize: number;
  /** Rows on this page */
  shown: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Shown before the buttons, e.g. bulk actions */
  extra?: ReactNode;
  className?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min((page - 1) * pageSize + shown, total);
  const hasPrevious = page > 1;
  const hasNext = page * pageSize < total;
  const number = (value: number) => value.toLocaleString(locale);
  const buttonClass = "h-11 rounded-lg px-4 text-[13px] lg:h-[30px] lg:px-[11px] lg:text-[12.5px]";

  return (
    <div className={cn("flex w-full min-w-0 items-center justify-between gap-3", className)}>
      <span className="min-w-0 truncate">
        {t("adminPagination.range", { from: number(from), to: number(to), total: number(total) })}
      </span>
      <div className="flex shrink-0 items-center gap-[7px]">
        {extra}
        {(hasPrevious || hasNext) && (
          <nav aria-label={t("adminPagination.label")} className="flex gap-[7px]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={!hasPrevious}
              className={buttonClass}
            >
              {t("common.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={!hasNext}
              className={cn(buttonClass, "font-semibold")}
            >
              {t("common.next")}
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}
