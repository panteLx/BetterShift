"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Crown,
  FolderClosed,
  LayoutDashboard,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Pill } from "@/components/form-kit";
import { UserAvatar } from "@/components/admin/admin-kit";
import { useAdminLevel } from "@/hooks/useAdminAccess";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export interface AdminSection {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

/** The four admin areas, shared by sidebar, tab bar, breadcrumb and dashboard. */
export function useAdminSections(): AdminSection[] {
  const t = useTranslations();
  return [
    { href: "/admin", label: t("admin.dashboard"), shortLabel: t("admin.dashboard"), icon: LayoutDashboard },
    { href: "/admin/users", label: t("admin.usersMenu"), shortLabel: t("admin.usersMenu"), icon: Users },
    {
      href: "/admin/calendars",
      label: t("admin.calendarsMenu"),
      shortLabel: t("admin.calendarsMenu"),
      icon: FolderClosed,
    },
    { href: "/admin/logs", label: t("admin.auditLogs"), shortLabel: t("adminShell.logsShort"), icon: ScrollText },
  ];
}

export function isActiveSection(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/** Desktop area list (13a–13f): account row, the four areas, back to the app. */
export function AdminSidebar() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const { user } = useAuth();
  const adminLevel = useAdminLevel();
  const sections = useAdminSections();
  const [collapsed, setCollapsed] = useState(false);
  const { stats } = useAdminStats();
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
        {sections.map((section) => {
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
    <nav className="grid shrink-0 grid-cols-4 gap-1 border-t border-line bg-background px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 lg:hidden">
      {sections.map((section) => {
        const active = isActiveSection(pathname, section.href);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-12 flex-col items-center justify-center gap-[3px] rounded-[10px]",
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
