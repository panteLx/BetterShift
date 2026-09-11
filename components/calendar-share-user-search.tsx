"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useCalendarShares, type SearchUser } from "@/hooks/useCalendarShares";

export function getUserInitials(user: { name: string | null; email: string }) {
  const source = user.name?.trim();
  if (source) {
    return source
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return user.email.slice(0, 2).toUpperCase() || "?";
}

interface CalendarShareUserSearchProps {
  calendarId: string;
  onSuccess?: () => void;
}

/** Invite row of the sharing panel: search a user and share with read access. */
export function CalendarShareUserSearch({ calendarId, onSuccess }: CalendarShareUserSearchProps) {
  const t = useTranslations();
  const { searchUsers, searchResults, searchLoading, addShare } = useCalendarShares(calendarId);

  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [inviting, setInviting] = useState(false);

  // Debounce timer in a ref so each keystroke cancels the previous request.
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      setSelectedUser(null);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        searchUsers(value);
      }, 300);
    },
    [searchUsers]
  );

  const handleSelectUser = (user: SearchUser) => {
    setSelectedUser(user);
    setQuery(user.name || user.email);
  };

  const clear = () => {
    setQuery("");
    setSelectedUser(null);
  };

  const handleInvite = async () => {
    if (!selectedUser) return;
    setInviting(true);
    const result = await addShare(selectedUser.id, "read");
    setInviting(false);
    if (result.success) {
      clear();
      onSuccess?.();
    }
  };

  const searching = query.length >= 2 && !selectedUser;
  const showResults = searching && searchResults.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-10 items-center gap-2 rounded-[9px] border border-control bg-surface-card pl-3 pr-1.5 transition-[box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <UserPlus className="size-4 shrink-0 text-fg-tertiary" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (selectedUser) handleInvite();
            else if (showResults) handleSelectUser(searchResults[0]);
          }}
          placeholder={t("share.searchUserPlaceholder")}
          aria-label={t("share.searchUser")}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-fg-strong outline-none placeholder:text-fg-tertiary"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label={t("common.cancel")}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-tertiary hover:bg-surface-sunken"
          >
            <X className="size-3.5" />
          </button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={handleInvite}
          disabled={!selectedUser || inviting}
          className="h-7 shrink-0 rounded-[7px] px-3 text-[12.5px] font-semibold"
        >
          {t("sharingSheet.invite")}
        </Button>
      </div>

      {showResults && (
        <div className="max-h-[220px] overflow-y-auto rounded-[10px] border border-line bg-surface-card p-1">
          {searchResults.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => handleSelectUser(user)}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-panel"
            >
              <Avatar className="size-7">
                {user.image && <AvatarImage src={user.image} alt="" />}
                <AvatarFallback className="bg-surface-sunken text-[11px] font-semibold text-fg-secondary">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-fg-strong">
                  {user.name || user.email}
                </div>
                {user.name && (
                  <div className="truncate text-[12px] text-fg-tertiary">{user.email}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {searching && searchLoading && (
        <p className="px-1 text-[12px] text-fg-tertiary">{t("common.loading")}</p>
      )}
      {searching && !searchLoading && searchResults.length === 0 && (
        <p className="px-1 text-[12px] text-fg-tertiary">{t("common.empty.noUsersFound")}</p>
      )}
    </div>
  );
}
