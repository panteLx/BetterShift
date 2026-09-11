"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Languages, ScrollText, SlidersHorizontal, SunMoon } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { locales } from "@/lib/locales";
import { useThemeOptions } from "@/components/appearance-picker";

export function setLocaleCookie(locale: string) {
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  window.location.reload();
}

interface AppPreferencesMenuItemsProps {
  onOpenChangelog: () => void;
  onOpenViewSettings?: () => void;
}

/** Appearance, language and changelog entries shared by the user and guest menus. */
export function AppPreferencesMenuItems({
  onOpenChangelog,
  onOpenViewSettings,
}: AppPreferencesMenuItemsProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const themeOptions = useThemeOptions();

  return (
    <>
      {onOpenViewSettings && (
        <DropdownMenuItem onClick={onOpenViewSettings}>
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          {t("appMenu.viewSettings")}
        </DropdownMenuItem>
      )}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <SunMoon className="mr-2 h-4 w-4" />
          {t("appearance.title")}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
            {themeOptions.map(({ value, title }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {title}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Languages className="mr-2 h-4 w-4" />
          {t("appMenu.language")}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={locale} onValueChange={setLocaleCookie}>
            {locales.map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {t(`language.${value}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem onClick={onOpenChangelog}>
        <ScrollText className="mr-2 h-4 w-4" />
        {t("changelog.title")}
      </DropdownMenuItem>
    </>
  );
}
