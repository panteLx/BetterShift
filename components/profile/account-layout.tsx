"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Width cap for account section content, so fields don't stretch across wide screens. */
export const accountContentClass = "w-full max-w-[680px]";

const backClass =
  "-ml-1.5 flex size-[34px] shrink-0 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-surface-panel";

/** Top bar of the account pages: back arrow, title with subtitle, trailing actions. */
export function AccountPageHeader({
  title,
  subtitle,
  backHref,
  onBack,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  backHref?: string;
  onBack?: () => void;
  actions?: ReactNode;
  className?: string;
}) {
  const t = useTranslations();
  const icon = <ChevronLeft className="size-[19px]" />;

  return (
    <header
      className={cn(
        "flex shrink-0 items-center gap-3 border-b border-line bg-background px-4 py-3.5 lg:px-[22px] lg:py-4",
        className
      )}
    >
      {onBack ? (
        <button type="button" onClick={onBack} aria-label={t("common.previous")} className={backClass}>
          {icon}
        </button>
      ) : (
        <Link href={backHref ?? "/"} aria-label={t("common.previous")} className={backClass}>
          {icon}
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[19px] font-semibold leading-tight tracking-[-0.01em] text-fg-strong">
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 truncate text-[13.5px] text-fg-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Title row inside a section, with an optional action on the right. */
export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold text-fg-strong">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-fg-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}
