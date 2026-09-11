"use client";

import { ReactNode } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Pill, SectionLabel } from "@/components/form-kit";
import { UserMenu } from "@/components/user-menu";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn, getUserInitials } from "@/lib/utils";

/*
 * Shared admin building blocks (screens 13a–13k). Pages compose these; data
 * fetching and permission checks stay in the pages and hooks.
 */

/**
 * Page title row. On phones it doubles as the sticky top bar (back to the app,
 * title, subtitle, `mobileActions`, avatar), so it must be the first child of the page.
 */
export function AdminPageHeader({
  title,
  subtitle,
  actions,
  mobileActions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Desktop only */
  actions?: ReactNode;
  /** Phones, shown before the avatar; typically 34px icon buttons */
  mobileActions?: ReactNode;
}) {
  const t = useTranslations();
  const desktop = useMediaQuery(DESKTOP_QUERY, true);
  return (
    <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2.5 border-b border-line bg-background px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] lg:static lg:mx-0 lg:flex-wrap lg:items-end lg:justify-between lg:gap-4 lg:border-0 lg:bg-transparent lg:p-0">
      <Link
        href="/"
        aria-label={t("admin.backToApp")}
        className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] border border-line text-fg-secondary lg:hidden"
      >
        <ArrowLeft className="size-[17px]" />
      </Link>
      <div className="min-w-0 flex-1 lg:flex-none">
        <h1 className="truncate text-[16px] font-semibold tracking-[-0.01em] text-fg-strong lg:text-[21px]">{title}</h1>
        {subtitle && (
          <p className="truncate text-[11.5px] text-fg-tertiary lg:mt-1 lg:text-[13.5px] lg:text-fg-secondary">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="hidden flex-wrap items-center gap-2 lg:flex">{actions}</div>}
      {!desktop && (
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          {mobileActions}
          <UserMenu />
        </div>
      )}
    </div>
  );
}

export function AdminSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-[366px]", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[38px] rounded-[9px] pl-9 text-[13.5px]"
      />
    </div>
  );
}

/** Bordered card that holds a table (desktop) or card list (phones) plus an optional footer. */
export function AdminTableCard({
  children,
  footer,
  className,
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[12px] border border-line bg-surface-card", className)}>
      {children}
      {footer && (
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-panel px-4 py-3 text-[12.5px] text-fg-secondary">
          {footer}
        </div>
      )}
    </div>
  );
}

/** Uppercase column header row; pass a grid template shared with the rows. */
export function AdminTableHead({ columns, template }: { columns: ReactNode[]; template: string }) {
  return (
    <div
      className="hidden items-center gap-3.5 border-b border-line bg-surface-panel px-4 py-2.5 lg:grid"
      style={{ gridTemplateColumns: template }}
    >
      {columns.map((column, i) => (
        <div key={i} className="eyebrow truncate text-[11px]">
          {column}
        </div>
      ))}
    </div>
  );
}

export function AdminTableRow({
  template,
  children,
  muted,
  onClick,
}: {
  template: string;
  children: ReactNode;
  muted?: "danger" | "panel";
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => onClick && (e.key === "Enter" || e.key === " ") && onClick()}
      className={cn(
        "hidden items-center gap-3.5 border-b border-line-subtle px-4 py-3 last:border-b-0 lg:grid",
        onClick && "cursor-pointer hover:bg-surface-panel",
        muted === "danger" && "bg-danger-surface",
        muted === "panel" && "bg-surface-panel"
      )}
      style={{ gridTemplateColumns: template }}
    >
      {children}
    </div>
  );
}

/** Phone replacement for a table row (13h–13k). */
export function AdminMobileCard({
  children,
  onClick,
  muted,
}: {
  children: ReactNode;
  onClick?: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-2 rounded-[11px] border border-line px-3.5 py-3 text-left lg:hidden",
        muted ? "bg-surface-panel" : "bg-surface-card"
      )}
    >
      {children}
    </button>
  );
}

export function UserAvatar({
  name,
  image,
  size = 32,
  tone = "neutral",
  color,
}: {
  name?: string | null;
  image?: string | null;
  size?: number;
  tone?: "neutral" | "brand";
  /** Solid background, e.g. a calendar owner's avatar */
  color?: string;
}) {
  const style = { width: size, height: size, fontSize: size * 0.36 };
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className="shrink-0 rounded-full object-cover" style={style} />;
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        color ? "text-white" : tone === "brand" ? "bg-brand-soft text-brand-ink" : "bg-surface-sunken text-fg-secondary"
      )}
      style={{ ...style, backgroundColor: color }}
    >
      {name ? getUserInitials({ name }) : "?"}
    </span>
  );
}

export function RolePill({ role }: { role: string | null | undefined }) {
  const t = useTranslations();
  if (role === "superadmin") return <Pill tone="brand">{t("common.roles.superadmin")}</Pill>;
  if (role === "admin") return <Pill tone="violet">{t("common.roles.admin")}</Pill>;
  return <Pill>{t("common.roles.user")}</Pill>;
}

export function StatusPill({ banned }: { banned: boolean | null | undefined }) {
  const t = useTranslations();
  return banned ? (
    <Pill tone="danger">{t("adminKit.banned")}</Pill>
  ) : (
    <Pill tone="success">{t("adminKit.active")}</Pill>
  );
}

export function SeverityPill({ severity }: { severity: string | null | undefined }) {
  const t = useTranslations();
  if (severity === "critical") return <Pill tone="danger">{t("adminKit.severityCritical")}</Pill>;
  if (severity === "error") return <Pill tone="danger">{t("adminKit.severityError")}</Pill>;
  if (severity === "warning") return <Pill tone="warning">{t("adminKit.severityWarning")}</Pill>;
  return <Pill>{t("adminKit.severityInfo")}</Pill>;
}

/** Monospace count; zero renders faint as in the handoff. */
export function Count({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("font-mono text-[13px]", value === 0 ? "text-fg-faint" : "text-fg-strong", className)}>
      {value}
    </span>
  );
}

/** Labelled numbers used in mobile cards and detail panels. */
/** Labelled block inside a detail side panel. */
export function DetailSection({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function StatTile({ label, value }: { label: ReactNode; value: number }) {
  return (
    <div className="rounded-[10px] border border-line bg-surface-card px-3 py-2.5">
      <div className={cn("font-mono text-[19px] font-medium", value === 0 ? "text-fg-faint" : "text-fg-strong")}>
        {value}
      </div>
      <div className="text-[11.5px] text-fg-tertiary">{label}</div>
    </div>
  );
}
