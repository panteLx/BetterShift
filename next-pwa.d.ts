declare module "next-pwa" {
  import { NextConfig } from "next";

  interface PWAConfig {
    dest?: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    sw?: string;
    runtimeCaching?: Array<{
      urlPattern: RegExp;
      handler:
        | "CacheFirst"
        | "NetworkFirst"
        | "StaleWhileRevalidate"
        | "NetworkOnly"
        | "CacheOnly";
      options?: {
        cacheName?: string;
        expiration?: {
          maxEntries?: number;
          maxAgeSeconds?: number;
        };
        networkTimeoutSeconds?: number;
      };
    }>;
  }

  export default function withPWA(
    config: PWAConfig
  ): (nextConfig: NextConfig) => NextConfig;
}
