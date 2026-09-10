import { cs, de, enUS, es, fr, it } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";

export const locales = ["cs", "de", "en", "es", "fr", "it"] as const;
export type Locale = (typeof locales)[number];

const dateFnsLocales: Record<Locale, DateFnsLocale> = {
  cs: cs,
  de: de,
  en: enUS,
  es: es,
  fr: fr,
  it: it,
};

export function getDateLocale(locale: string): DateFnsLocale {
  return dateFnsLocales[locale as Locale] || enUS;
}

// Validate the raw env value before it is trusted as a `Locale`, so an
// invalid entry falls back instead of slipping through an unchecked cast.
const rawDefaultLocale = process.env.DEFAULT_LOCALE;

function isValidLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

if (rawDefaultLocale && !isValidLocale(rawDefaultLocale)) {
  // A typo'd DEFAULT_LOCALE must not be fatal for a self-hosted app — warn
  // loudly and fall back to "en" instead of crashing the whole server.
  console.warn(
    `Invalid DEFAULT_LOCALE: "${rawDefaultLocale}". Must be one of: ${locales.join(
      ", "
    )}. Falling back to "en".`
  );
}

export const defaultLocale: Locale = isValidLocale(rawDefaultLocale)
  ? rawDefaultLocale
  : "en";
