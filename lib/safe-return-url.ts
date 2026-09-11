const DUMMY_ORIGIN = "https://safe-return-url.invalid";

// C0/C1 controls (tab, LF, CR included) and backslashes: the URL parser strips
// the first from anywhere in the input and treats the second as a slash.
const UNSAFE_CHARACTERS = /[\p{Cc}\\]/u;

/**
 * Only same-origin relative paths may be used as post-login targets; anything
 * else (absolute URLs, protocol-relative "//host", javascript:) falls back to "/".
 */
export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || value.length > 2048) {
    return "/";
  }
  if (value[0] !== "/" || value[1] === "/") {
    return "/";
  }
  if (UNSAFE_CHARACTERS.test(value)) {
    return "/";
  }

  try {
    const resolved = new URL(value, DUMMY_ORIGIN);
    if (resolved.origin !== DUMMY_ORIGIN || !resolved.pathname.startsWith("/") || resolved.pathname.startsWith("//")) {
      return "/";
    }
  } catch {
    return "/";
  }

  return value;
}
