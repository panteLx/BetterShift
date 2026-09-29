/**
 * Reserved workspace slugs. `default` is reserved because the single-tenant
 * workspace uses it; the rest guard the portal subdomain (see getPortalHostError),
 * common infra subdomains and the
 * `bs-pr-*` PR-preview prefix (docs/PR_PREVIEWS.md) from ever colliding with
 * a real workspace if an operator points TENANT_BASE_DOMAIN and
 * PREVIEW_DOMAIN at the same zone.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "www",
  "app",
  "api",
  "admin",
  "auth",
  "mail",
  "smtp",
  "status",
  "static",
  "assets",
  "cdn",
  "docs",
  "help",
  "support",
  "blog",
  "default",
  "demo",
  "preview",
  "portal",
]);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function isValidSlugFormat(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug) || slug.startsWith("bs-pr-");
}
