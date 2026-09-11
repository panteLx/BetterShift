/**
 * Only same-origin paths may be used as post-login targets; anything else
 * (absolute URLs, protocol-relative "//host", javascript:) falls back to "/".
 */
export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
}
