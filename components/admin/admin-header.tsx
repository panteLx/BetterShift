"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { ChevronRight, Languages, SunMoon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserMenu } from "@/components/user-menu";
import { useThemeOptions } from "@/components/appearance-picker";
import { setLocaleCookie } from "@/components/app-preferences-menu-items";
import { isActiveSection, useAdminSections } from "@/components/admin/admin-sidebar";
import { locales } from "@/lib/locales";

function LanguageSelect() {
  const t = useTranslations();
  const locale = useLocale();
  const names: Record<string, string> = {
    de: t("language.de"),
    en: t("language.en"),
    es: t("language.es"),
    fr: t("language.fr"),
    it: t("language.it"),
    cs: t("language.cs"),
  };

  return (
    <Select value={locale} onValueChange={setLocaleCookie}>
      <SelectTrigger
        size="sm"
        aria-label={t("appMenu.language")}
        className="h-8 gap-[7px] rounded-lg border-line px-[11px] text-[13px] text-fg-body shadow-none"
      >
        <Languages className="size-[15px] text-fg-secondary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {locales.map((value) => (
          <SelectItem key={value} value={value}>
            {names[value] ?? value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AppearanceMenu() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const options = useThemeOptions();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("appearance.title")}
          className="flex size-8 items-center justify-center rounded-lg border border-line text-fg-secondary transition-colors hover:bg-surface-panel"
        >
          <SunMoon className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-[12px] font-semibold text-fg-tertiary">
          {t("appearance.title")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          {options.map(({ value, title }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {title}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Desktop top bar: breadcrumb, language, appearance and account menu. */
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
      <LanguageSelect />
      <AppearanceMenu />
      <UserMenu />
    </header>
  );
}
