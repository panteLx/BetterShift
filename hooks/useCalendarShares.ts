import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export interface CalendarShare {
  id: string;
  calendarId: string;
  userId: string;
  permission: "owner" | "admin" | "write" | "read";
  sharedBy: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  sharedByUser: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface SearchUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export function useCalendarShares(calendarId: string) {
  const t = useTranslations();
  const [shares, setShares] = useState<CalendarShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchShares = useCallback(async () => {
    if (!calendarId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/calendars/${calendarId}/shares`);
      if (!response.ok) {
        throw new Error("Failed to fetch shares");
      }
      const data = await response.json();
      setShares(data);
    } catch (error) {
      console.error("Failed to fetch shares:", error);
      toast.error(t("common.fetchError", { item: t("common.labels.shares") }));
    } finally {
      setLoading(false);
    }
  }, [calendarId, t]);

  const addShare = useCallback(
    async (userId: string, permission: "admin" | "write" | "read") => {
      try {
        const response = await fetch(`/api/calendars/${calendarId}/shares`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, permission }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to add share");
        }

        const newShare = await response.json();
        setShares((prev) => [newShare, ...prev]);
        toast.success(t("share.shareAdded"));
        return { success: true };
      } catch (error) {
        console.error("Failed to add share:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : t("common.createError", { item: t("share.share") })
        );
        return { success: false };
      }
    },
    [calendarId, t]
  );

  const updateShare = useCallback(
    async (shareId: string, permission: "admin" | "write" | "read") => {
      try {
        const response = await fetch(
          `/api/calendars/${calendarId}/shares/${shareId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ permission }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update share");
        }

        const updatedShare = await response.json();
        setShares((prev) =>
          prev.map((s) => (s.id === shareId ? updatedShare : s))
        );
        toast.success(t("share.shareUpdated"));
        return { success: true };
      } catch (error) {
        console.error("Failed to update share:", error);
        toast.error(t("common.updateError", { item: t("share.share") }));
        return { success: false };
      }
    },
    [calendarId, t]
  );

  const removeShare = useCallback(
    async (shareId: string) => {
      try {
        const response = await fetch(
          `/api/calendars/${calendarId}/shares/${shareId}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to remove share");
        }

        setShares((prev) => prev.filter((s) => s.id !== shareId));
        toast.success(t("share.shareRemoved"));
        return { success: true };
      } catch (error) {
        console.error("Failed to remove share:", error);
        toast.error(t("common.deleteError", { item: t("share.share") }));
        return { success: false };
      }
    },
    [calendarId, t]
  );

  const searchUsers = useCallback(
    async (query: string) => {
      if (!query || query.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const response = await fetch(
          `/api/users/search?q=${encodeURIComponent(
            query
          )}&calendarId=${calendarId}`
        );

        if (!response.ok) {
          throw new Error("Failed to search users");
        }

        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error("Failed to search users:", error);
        toast.error(t("common.fetchError", { item: t("common.labels.users") }));
      } finally {
        setSearchLoading(false);
      }
    },
    [calendarId, t]
  );

  return {
    shares,
    loading,
    searchResults,
    searchLoading,
    fetchShares,
    addShare,
    updateShare,
    removeShare,
    searchUsers,
  };
}
