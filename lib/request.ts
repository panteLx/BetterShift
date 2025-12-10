import { getRequestConfig } from "next-intl/server";
import { locales } from "./locales";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Ensure that the incoming locale is valid
  if (!locale || !(locales as readonly string[]).includes(locale)) {
    locale = "en";
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
