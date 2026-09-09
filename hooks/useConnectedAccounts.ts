"use client";

import { useState, useEffect, useCallback } from "react";
import { authClient } from "@/lib/auth/client";

type ConnectedAccount = {
  id: string;
  provider: string;
  accountId: string;
  createdAt: Date | null;
};

/**
 * Fetches and formats the connected accounts, without touching any
 * component state. Shared by the initial mount fetch and the manual
 * refetch path below.
 */
async function getConnectedAccounts(): Promise<ConnectedAccount[]> {
  const { data, error: fetchError } = await authClient.listAccounts();

  if (fetchError) {
    throw new Error(fetchError.message || "Failed to fetch accounts");
  }

  return (data || []).map(
    (account: {
      id: string;
      providerId: string;
      accountId: string;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
      scopes: string[];
    }) => ({
      id: account.id,
      provider: account.providerId,
      accountId: account.accountId,
      createdAt: account.createdAt ? new Date(account.createdAt) : null,
    })
  );
}

/**
 * Hook to manage user's connected OAuth/OIDC accounts
 *
 * Uses Better Auth's built-in listAccounts method
 *
 * Features:
 * - Fetch connected accounts
 * - Disconnect account
 * - Auto-refresh on mount
 */
export function useConnectedAccounts() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      setAccounts(await getConnectedAccounts());
    } catch (err) {
      console.error("Error fetching connected accounts:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Inlined (rather than calling `fetchAccounts`) so the initial fetch
    // owns its own guard against a stale response resolving after this
    // effect has already been cleaned up.
    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const formattedAccounts = await getConnectedAccounts();
        if (cancelled) return;
        setAccounts(formattedAccounts);
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching connected accounts:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    accounts,
    isLoading,
    error,
    refetch: fetchAccounts,
  };
}
