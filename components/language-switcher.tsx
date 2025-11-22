"use client";

import { useLocale } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Languages } from "lucide-react";

type Locale = "de" | "en";

const languageNames: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
};

const locales: Locale[] = ["de", "en"];

export function LanguageSwitcher() {
  const currentLocale = useLocale() as Locale;

  const handleLocaleChange = (newLocale: string) => {
    // Set cookie to persist user's choice
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    // Reload to apply new locale
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-2">
      <Languages className="h-4 w-4 text-muted-foreground" />
      <Select value={currentLocale} onValueChange={handleLocaleChange}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {locales.map((locale) => (
            <SelectItem key={locale} value={locale}>
              {languageNames[locale]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
