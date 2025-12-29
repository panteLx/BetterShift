"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { PublicConfig } from "@/lib/public-config";

/**
 * React Context for public configuration
 */
const PublicConfigContext = createContext<PublicConfig | null>(null);

/**
 * Props for PublicConfigProvider
 */
interface PublicConfigProviderProps {
  children: React.ReactNode;
  /**
   * Initial config passed from server during SSR.
   * This eliminates the need for a client-side API call on initial load.
   */
  initialConfig: PublicConfig;
}

/**
 * Provider component that makes public configuration available to all client components.
 *
 * This provider uses two sources for configuration:
 * 1. SSR: `initialConfig` prop passed from server (zero latency)
 * 2. CSR: `window.__PUBLIC_CONFIG__` injected via script tag (fallback)
 *
 * If neither is available, it falls back to fetching from /api/public-config
 * (rare edge case for pure CSR scenarios).
 */
export function PublicConfigProvider({
  children,
  initialConfig,
}: PublicConfigProviderProps) {
  // Initialize config with SSR value or hydrate from window
  const [config, setConfig] = useState<PublicConfig>(() => {
    // Try window first (CSR hydration)
    if (typeof window !== "undefined" && window.__PUBLIC_CONFIG__) {
      return window.__PUBLIC_CONFIG__;
    }
    // Fall back to SSR initial config
    return initialConfig;
  });

  useEffect(() => {
    // Only fetch if we have no config at all (rare edge case)
    if (!config && typeof window !== "undefined") {
      fetch("/api/public-config")
        .then((res) => res.json())
        .then((data) => setConfig(data))
        .catch((err) =>
          console.error("[PUBLIC_CONFIG] Failed to fetch config:", err)
        );
    }
  }, [config]);

  return (
    <PublicConfigContext.Provider value={config}>
      {children}
    </PublicConfigContext.Provider>
  );
}

/**
 * Hook to access public configuration in client components.
 *
 * @throws Error if used outside of PublicConfigProvider
 * @returns Public configuration object
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { auth, oauth } = usePublicConfig();
 *
 *   if (!auth.enabled) {
 *     return <div>Auth is disabled</div>;
 *   }
 *
 *   return (
 *     <div>
 *       {oauth.google && <GoogleLoginButton />}
 *       {oauth.github && <GitHubLoginButton />}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePublicConfig(): PublicConfig {
  const context = useContext(PublicConfigContext);

  if (!context) {
    throw new Error(
      "usePublicConfig must be used within PublicConfigProvider. " +
        "Make sure your component is wrapped in the provider (usually in the root layout)."
    );
  }

  return context;
}

/**
 * TypeScript declaration for the global window object
 */
declare global {
  interface Window {
    __PUBLIC_CONFIG__?: PublicConfig;
  }
}
