import { NextRequest } from "next/server";
// Named import: the package is CommonJS and exports only `getClientIp`
// (no `default`). A default import (`import RequestIp from "..."`) resolves
// to `undefined` under both CJS-interop (webpack/SWC) and native ESM
// resolution because the module sets `__esModule: true` without a `.default`
// property, so the interop helper never synthesizes one.
import { getClientIp as resolveClientIp } from "@supercharge/request-ip";

/**
 * Extract the real client IP address from a request.
 * Uses @supercharge/request-ip which automatically handles:
 * - Cloudflare (CF-Connecting-IP)
 * - Standard proxies (X-Forwarded-For, X-Real-IP)
 * - AWS/Azure/GCP load balancers
 * - Direct connections
 *
 * @param request - Request object (NextRequest or standard Request)
 * @returns Client IP address or null if not found
 */
export function getClientIp(request: NextRequest | Request): string | null {
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
