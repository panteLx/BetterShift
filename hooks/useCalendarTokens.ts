import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export interface CalendarAccessToken {
  id: string;
  tokenPreview: string; // First 6 chars (e.g., "abcxyz")
  token?: string; // Full token only provided on creation
  name: string | null;
  permission: "read" | "write";
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  usageCount: number;
  isActive: boolean;
}

export interface CreateTokenParams {
  name?: string;
  permission: "read" | "write";
  expiresAt?: string | null;
}

export interface UpdateTokenParams {
  name?: string;
  permission?: "read" | "write";
  expiresAt?: string | null;
  isActive?: boolean;
}

export function useCalendarTokens(calendarId: string | null) {
  const [tokens, setTokens] = useState<CalendarAccessToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations();

  /**
   * Fetch all tokens for calendar
   */
  const fetchTokens = useCallback(async () => {
    if (!calendarId) {
      setTokens([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/calendars/${calendarId}/tokens`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setTokens(data);
    } catch {
      const message = t("common.fetchError", { item: t("token.accessLinks") });
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [calendarId, t]);

  /**
   * Create a new access token
   * Returns full token (only time it's visible!)
   */
  const createToken = useCallback(
    async (params: CreateTokenParams): Promise<CalendarAccessToken | null> => {
      if (!calendarId) return null;

      try {
        const response = await fetch(`/api/calendars/${calendarId}/tokens`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `HTTP ${response.status}`);
        }

        const newToken = await response.json();

        // Add to local state
        setTokens((prev) => [newToken, ...prev]);

        toast.success(t("common.created", { item: t("token.accessLinks") }));

        return newToken; // Includes full token!
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : t("common.createError", { item: t("token.accessLinks") })
        );
        return null;
      }
    },
    [calendarId, t]
  );

  /**
   * Update an existing token
   */
  const updateToken = useCallback(
    async (tokenId: string, updates: UpdateTokenParams): Promise<boolean> => {
      if (!calendarId) return false;

      try {
        const response = await fetch(
          `/api/calendars/${calendarId}/tokens/${tokenId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `HTTP ${response.status}`);
        }

        const updatedToken = await response.json();

        // Update local state
        setTokens((prev) =>
          prev.map((token) => (token.id === tokenId ? updatedToken : token))
        );

        toast.success(t("common.updated", { item: t("token.accessLinks") }));

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : t("common.updateError", { item: t("token.accessLinks") })
        );
        return false;
      }
    },
    [calendarId, t]
  );

  /**
   * Delete (revoke) a token
   */
  const deleteToken = useCallback(
    async (tokenId: string): Promise<boolean> => {
      if (!calendarId) return false;

      try {
        const response = await fetch(
          `/api/calendars/${calendarId}/tokens/${tokenId}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `HTTP ${response.status}`);
        }

        // Remove from local state
        setTokens((prev) => prev.filter((token) => token.id !== tokenId));

        toast.success(t("common.revoked", { item: t("token.accessLinks") }));

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : t("common.revokeError", { item: t("token.accessLinks") })
        );
        return false;
      }
    },
    [calendarId, t]
  );

  /**
   * Generate a shareable link from token
   */
  const getShareLink = useCallback((token: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/share/token/${token}`;
  }, []);

  /**
   * Copy share link to clipboard
   */
  const copyShareLink = useCallback(
    async (token: string): Promise<boolean> => {
      try {
        const link = getShareLink(token);
        await navigator.clipboard.writeText(link);

        toast.success(t("common.copied", { item: t("share.share") }));

        return true;
      } catch {
        toast.error(t("common.copyError", { item: t("share.share") }));
        return false;
      }
    },
    [getShareLink, t]
  );

  return {
    tokens,
    isLoading,
    error,
    fetchTokens,
    createToken,
    updateToken,
    deleteToken,
    getShareLink,
    copyShareLink,
  };
}
