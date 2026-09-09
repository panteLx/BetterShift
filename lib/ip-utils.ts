import { NextRequest } from "next/server";
// Named import: the package is CommonJS and exports only `getClientIp`
// (no `default`). A default import (`import RequestIp from "..."`) resolves
// to `undefined` under both CJS-interop (webpack/SWC) and native ESM
// resolution because the module sets `__esModule: true` without a `.default`
// property, so the interop helper never synthesizes one.
import { getClientIp as resolveClientIp } from "@supercharge/request-ip";

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6 = /^[0-9a-f:]+$/i;

/**
 * Parse a single client IP out of a raw header value.
 *
 * Handles the shapes proxies actually emit: a comma-separated forwarding
 * chain, a bracketed IPv6 literal, an appended port, and an IPv6 zone index.
 * Anything that does not parse as an IP is rejected rather than passed on —
 * the result becomes a rate-limit bucket key and an audit-log field, so a
 * caller-controlled arbitrary string must never reach either.
 */
function parseIp(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // A forwarding chain lists the client first, then each proxy it passed.
  let value = raw.split(",")[0].trim();
  if (!value) return null;

  if (value.startsWith("[")) {
    // Bracketed IPv6, optionally with a port: [::1]:443
    const end = value.indexOf("]");
    if (end === -1) return null;
    value = value.slice(1, end);
  } else if (value.split(":").length === 2) {
    // IPv4 with a port (a bare IPv6 address always has more than one colon).
    value = value.split(":")[0];
  }

  // Drop an IPv6 zone index, e.g. fe80::1%eth0
  const zone = value.indexOf("%");
  if (zone !== -1) value = value.slice(0, zone);

  if (!value) return null;

  const v4 = IPV4.exec(value);
  if (v4) {
    return v4.slice(1).every((octet) => Number(octet) <= 255) ? value : null;
  }

  return value.includes(":") && IPV6.test(value) ? value.toLowerCase() : null;
}

/**
 * Extract the real client IP address from a request.
 *
 * When `TRUSTED_PROXY_HEADER` is set, that header is the *only* source: its
 * value is taken verbatim and no other header is consulted. Use this whenever
 * the app sits behind a proxy that sets a header the client cannot forge —
 * `CF-Connecting-IP` behind Cloudflare, for example. Without it the resolution
 * order is the library's, which prefers `X-Forwarded-For`; since most proxies
 * append to that header rather than replace it, a client-supplied value ends up
 * first in the chain and wins. That is spoofable, and it is why the rate limiter
 * can be evaded by rotating the header on a deployment that leaves this unset.
 *
 * If the configured header is absent, this returns null rather than falling
 * back to a spoofable header. Callers treat that as an unidentified client,
 * which is the conservative outcome: requests that bypass the proxy share one
 * rate-limit bucket instead of getting a fresh one each time.
 *
 * @param request - Request object (NextRequest or standard Request)
 * @returns Client IP address or null if not found
 */
export function getClientIp(request: NextRequest | Request): string | null {
  const trustedHeader = process.env.TRUSTED_PROXY_HEADER?.trim();
  if (trustedHeader) {
    return parseIp(request.headers.get(trustedHeader));
  }

  // Create a minimal Express-like request object for the library
  const expressLikeRequest = {
    headers: Object.fromEntries(request.headers.entries()),
    connection: {},
    socket: {},
  };

  const ip = resolveClientIp(
    expressLikeRequest as {
      headers: Record<string, string>;
      connection: Record<string, unknown>;
      socket: Record<string, unknown>;
    }
  );
  return ip || null;
}
