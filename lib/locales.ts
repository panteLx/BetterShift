import { de, enUS, it } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";

export const locales = ["de", "en", "it"] as const;
export type Locale = (typeof locales)[number];

const dateFnsLocales: Record<Locale, DateFnsLocale> = {
  de: de,
  en: enUS,
  it: it,
};

export function getDateLocale(locale: string): DateFnsLocale {
  return dateFnsLocales[locale as Locale] || enUS;
}

export const defaultLocale: Locale =
  (process.env.DEFAULT_LOCALE as Locale) || "en";

// Validate default locale
if (!locales.includes(defaultLocale)) {
  throw new Error(
    `Invalid DEFAULT_LOCALE: ${defaultLocale}. Must be one of: ${locales.join(
      ", "
    )}`
  );
}
