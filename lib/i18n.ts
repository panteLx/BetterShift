import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { locales, defaultLocale, type Locale } from "@/lib/locales";

function getLocaleFromNavigator(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  // Check if German is preferred
  const languages = acceptLanguage.split(",").map((lang) => {
    const [locale] = lang.trim().split(";");
    return locale.toLowerCase();
  });

  // Check for preferred language
  for (const lang of languages) {
    const langCode = lang.split("-")[0];
    const matchedLocale = locales.find((locale) => locale === langCode);
    if (matchedLocale) {
      return matchedLocale;
    }
  }

  return defaultLocale;
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
