// Scheme/port come from the portal URL: behind a TLS-terminating proxy the request itself looks like plain http.
export function workspaceOrigin(slug: string, portalUrl: string, baseDomain: string): string {
  const portal = new URL(portalUrl);
  return `${portal.protocol}//${slug}.${baseDomain}${portal.port ? `:${portal.port}` : ""}`;
}
