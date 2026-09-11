"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { isActiveSection, useAdminSections } from "@/components/admin/admin-sidebar";

/** Desktop top bar: breadcrumb and account menu (which also holds appearance and language). */
export function AdminHeader() {
  const t = useTranslations();
  const pathname = usePathname();
  const sections = useAdminSections();
  const current = sections.find((section) => isActiveSection(pathname, section.href));

  return (
    <header className="hidden h-14 shrink-0 items-center gap-2.5 border-b border-line bg-background px-[18px] lg:flex">
      <nav aria-label={t("adminShell.breadcrumb")} className="flex min-w-0 flex-1 items-center gap-2.5">
        <Link href="/admin" className="text-[13.5px] text-fg-tertiary transition-colors hover:text-fg-body">
          {t("admin.title")}
        </Link>
        {current && (
          <>
            <ChevronRight className="size-[15px] shrink-0 text-fg-faint" />
            <span aria-current="page" className="truncate text-[13.5px] font-semibold text-fg-strong">
              {current.label}
            </span>
          </>
        )}
      </nav>
      <UserMenu />
    </header>
  );
}
