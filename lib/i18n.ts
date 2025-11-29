import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

export const locales = ["de", "en"] as const;
export type Locale = (typeof locales)[number];

const configuredDefaultLocale = process.env.DEFAULT_LOCALE as
  | Locale
  | undefined;
export const defaultLocale: Locale =
  configuredDefaultLocale && locales.includes(configuredDefaultLocale)
    ? configuredDefaultLocale
    : "en";

function getLocaleFromNavigator(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  // Check if German is preferred
  const languages = acceptLanguage.split(",").map((lang) => {
    const [locale] = lang.trim().split(";");
    return locale.toLowerCase();
  });

  // If German is in the list, use German, otherwise use English
  for (const lang of languages) {
    if (lang.startsWith("de")) {
      return "de";
    }
  }

  return "en";
}

export default getRequestConfig(async () => {
  // Try to get locale from cookie first (user preference)
  const cookieStore = await cookies();
  let locale = cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined;

  // If no cookie, detect from browser language
  if (!locale || !locales.includes(locale)) {
    const headersList = await headers();
    const acceptLanguage = headersList.get("accept-language");
    locale = getLocaleFromNavigator(acceptLanguage);
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
