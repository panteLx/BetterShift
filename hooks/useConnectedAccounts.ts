"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth/client";

type ConnectedAccount = {
  id: string;
  provider: string;
  accountId: string;
  createdAt: Date | null;
};

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

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await authClient.listAccounts();

      if (fetchError) {
        throw new Error(fetchError.message || "Failed to fetch accounts");
      }

      // Format accounts for component
      const formattedAccounts = (data || []).map(
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

      setAccounts(formattedAccounts);
    } catch (err) {
      console.error("Error fetching connected accounts:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return {
    accounts,
    isLoading,
    error,
    refetch: fetchAccounts,
  };
}
