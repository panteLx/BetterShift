import { NextRequest } from "next/server";

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6 = /^[0-9a-f:]+$/i;
// IPv4-mapped IPv6, e.g. ::ffff:203.0.113.5. A dual-stack listener (nginx
// `listen [::]:443` with ipv6only=off, Caddy, Traefik) reports IPv4 clients
// in this form, so it must not be rejected as malformed.
const IPV4_MAPPED = /^::(?:ffff:)?(?=\d{1,3}\.)/i;

/**
 * Normalise a single address into a canonical, validated form.
 *
 * Handles the shapes proxies actually emit: a bracketed IPv6 literal, an
 * appended port, and an IPv6 zone index. Anything that does not parse as an IP
 * is rejected rather than passed on — the result becomes a rate-limit bucket
 * key and an audit-log field, so a caller-controlled arbitrary string must
 * never reach either.
 */
function normalizeIp(value: string): string | null {
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

  // Unwrap an IPv4-mapped IPv6 address to its dotted-quad form, so the same
  // client is one identity whether the proxy reports it as 203.0.113.5 or
  // ::ffff:203.0.113.5.
  value = value.replace(IPV4_MAPPED, "");

  if (!value) return null;

  const v4 = IPV4.exec(value);
  if (v4) {
    return v4.slice(1).every((octet) => Number(octet) <= 255) ? value : null;
  }

  return value.includes(":") && IPV6.test(value) ? value.toLowerCase() : null;
}

/**
 * Pick one address out of a raw header value.
 *
 * `from` selects which end of a comma-separated forwarding chain to read.
 * "start" is the client as the first proxy saw it — correct for a header a
 * trusted proxy sets itself. "end" is the address the *nearest* proxy
 * observed, which is the only entry a client cannot influence.
 */
function parseIp(
  raw: string | null | undefined,
  from: "start" | "end" = "start"
): string | null {
  if (!raw) return null;

  const parts = raw.split(",");
  const value = (from === "start" ? parts[0] : parts[parts.length - 1]).trim();
  if (!value) return null;

  return normalizeIp(value);
}

/**
 * Extract the real client IP address from a request.
 *
 * Resolution depends on `TRUSTED_PROXY_HEADER`:
 *
 * - Set to a header name: that header is the *only* source and its value is
 *   taken verbatim. Use this whenever a proxy in front sets a header the
 *   client cannot forge — `CF-Connecting-IP` behind Cloudflare, for example.
 *   If the header is absent, this returns null rather than falling back to
 *   anything else: a request that bypassed the proxy is an unidentified
 *   client, not a fresh identity.
 * - Set to `none`: nothing is trusted and this always returns null. For a
 *   deployment with no proxy at all, where every forwarding header is
 *   client-supplied and therefore worthless.
 * - Unset: the last entry of `X-Forwarded-For` is used. Proxies append the
 *   address they saw, so with a single reverse proxy in front that entry is
 *   the real peer and a client cannot prepend its way past it. With a longer
 *   chain (Cloudflare in front of Caddy) it resolves to the nearest hop rather
 *   than the client, which costs precision but is still unforgeable — that
 *   deployment should name its trusted header instead.
 *
 * Reading the *first* entry, which is what most helper libraries do, is what
 * makes rate limits evadable: the client simply prepends a value of its own.
 *
 * @param request - Request object (NextRequest or standard Request)
 * @returns Client IP address or null if none could be established
 */
export function getClientIp(request: NextRequest | Request): string | null {
  const trustedHeader = process.env.TRUSTED_PROXY_HEADER?.trim();

  if (trustedHeader) {
    if (trustedHeader.toLowerCase() === "none") return null;
    return parseIp(request.headers.get(trustedHeader));
  }

  return parseIp(request.headers.get("x-forwarded-for"), "end");
}
