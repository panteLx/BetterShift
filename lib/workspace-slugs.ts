/**
 * Reserved workspace slugs. `default` is reserved because the single-tenant
 * workspace uses it; the rest guard the portal subdomain (see getPortalHostError),
 * common infra subdomains and the
 * `bs-pr-*` PR-preview prefix (docs/PR_PREVIEWS.md) from ever colliding with
 * a real workspace if an operator points TENANT_BASE_DOMAIN and
 * PREVIEW_DOMAIN at the same zone, plus `TENANT_RESERVED_SLUGS` for hosts
 * the operator already uses on a shared zone.
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

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 32;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

export function parseReservedSlugs(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

// Read directly (not via lib/auth/env) so this module stays importable from client components.
const EXTRA_RESERVED_SLUGS = parseReservedSlugs(process.env.TENANT_RESERVED_SLUGS);

export function isValidSlugFormat(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug) || EXTRA_RESERVED_SLUGS.has(slug) || slug.startsWith("bs-pr-");
}

/** Best-effort slug from a display name; the result may still be invalid (e.g. too short). */
export function suggestSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}
