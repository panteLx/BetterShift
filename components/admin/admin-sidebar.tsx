"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Building2,
  Crown,
  FolderClosed,
  LayoutDashboard,
  Megaphone,
  Radio,
  ScrollText,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Pill, SectionLabel } from "@/components/form-kit";
import { UserAvatar } from "@/components/admin/admin-kit";
import { useAdminLevel } from "@/hooks/useAdminAccess";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useAuth } from "@/hooks/useAuth";
import {
  sectionsForScope,
  type AdminIconName,
  type AdminSectionGroup,
} from "@/lib/admin-sections";
import { cn } from "@/lib/utils";

export interface AdminSection {
  key: string;
  group: AdminSectionGroup;
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

const ICONS: Record<AdminIconName, LucideIcon> = {
  LayoutDashboard,
  Users,
  Building2,
  UserCog,
  FolderClosed,
  Megaphone,
  ScrollText,
  Settings,
  Radio,
};

const GROUPS: AdminSectionGroup[] = ["management", "system"];

/** The admin areas for the current scope, shared by sidebar, tab bar, breadcrumb and dashboard. */
export function useAdminSections(): AdminSection[] {
  const t = useTranslations();
  const { scope, workspaceRole } = useAdminScope();
  if (!scope) return [];
  return sectionsForScope(scope, workspaceRole).map((s) => ({
    key: s.key,
    group: s.group,
    href: s.href,
    label: t(s.labelKey),
    shortLabel: t(s.shortLabelKey),
    icon: ICONS[s.icon],
  }));
}

export function isActiveSection(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/** Desktop area list (13a–13f): account row, the five areas, back to the app. */
export function AdminSidebar() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const { user } = useAuth();
  const adminLevel = useAdminLevel();
  const sections = useAdminSections();
  const [collapsed, setCollapsed] = useState(false);
  const { scope } = useAdminScope();
  const { stats } = useAdminStats(scope !== null && scope !== "workspace");
  const counts: Record<string, number | undefined> = {
    "/admin/users": stats?.users.total,
    "/admin/calendars": stats ? stats.calendars.total + stats.calendars.orphaned : undefined,
    "/admin/logs": stats?.auditLogs.total,
  };

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-line bg-surface-panel lg:flex",
        collapsed ? "w-16" : "w-[248px]"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 border-b border-line py-[13px]",
          collapsed ? "flex-col px-2" : "px-3.5"
        )}
      >
        <UserAvatar name={user?.name} image={user?.image} size={34} tone="brand" />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold text-fg-strong">{user?.name}</div>
            {adminLevel === "superadmin" ? (
              <Pill tone="warning" className="mt-[3px] px-[7px] text-[10.5px]">
                <Crown className="size-[11px]" />
                {t("admin.superadminBadge")}
              </Pill>
            ) : (
              <Pill tone="violet" className="mt-[3px] px-[7px] text-[10.5px]">
                {t("common.roles.admin")}
              </Pill>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? t("admin.expandSidebar") : t("admin.collapseSidebar")}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-faint transition-colors hover:bg-surface-sunken hover:text-fg-secondary"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto p-3">
        {GROUPS.map((group) => {
          const items = sections.filter((section) => section.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-[3px] [&:not(:first-child)]:mt-3">
              {!collapsed && <SectionLabel className="px-2.5">{t(`admin.groups.${group}`)}</SectionLabel>}
            {items.map((section) => {
              const active = isActiveSection(pathname, section.href);
              const count = counts[section.href];
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? section.label : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors",
                    collapsed && "justify-center",
                    active ? "bg-brand-soft shadow-[inset_2px_0_0_var(--brand)]" : "hover:bg-surface-sunken"
                  )}
                >
                  <section.icon className={cn("size-4 shrink-0", active ? "text-brand-ink" : "text-fg-secondary")} />
                  {!collapsed && (
                    <>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[13.5px]",
                          active ? "font-semibold text-brand-ink" : "font-medium text-fg-body"
                        )}
                      >
                        {section.label}
                      </span>
                      {count !== undefined && (
                        <span className={cn("font-mono text-[11.5px]", active ? "text-brand-ink" : "text-fg-tertiary")}>
                          {count.toLocaleString(locale)}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <Link
          href="/"
          title={collapsed ? t("admin.backToApp") : undefined}
          className={cn(
            "flex items-center gap-[9px] rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-fg-body transition-colors hover:bg-surface-sunken",
            collapsed && "justify-center"
          )}
        >
          <ArrowLeft className="size-4 shrink-0 text-fg-secondary" />
          {!collapsed && t("admin.backToApp")}
        </Link>
      </div>
    </aside>
  );
}

/** Phone tab bar replacing the sidebar (13g–13k). */
export function AdminMobileNav() {
  const pathname = usePathname();
  const sections = useAdminSections();

  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto border-t border-line bg-background px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 lg:hidden">
      {sections.map((section) => {
        const active = isActiveSection(pathname, section.href);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-12 min-w-[64px] flex-1 flex-col items-center justify-center gap-[3px] rounded-[10px]",
              active ? "bg-brand-soft text-brand-ink" : "text-fg-tertiary"
            )}
          >
            <section.icon className="size-[19px]" />
            <span className={cn("text-[10.5px]", active ? "font-semibold" : "font-medium")}>
              {section.shortLabel}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
