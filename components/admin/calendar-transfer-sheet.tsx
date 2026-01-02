"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { BaseSheet } from "@/components/ui/base-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  useAdminCalendars,
  type AdminCalendar,
} from "@/hooks/useAdminCalendars";
import { useAdminUsers, type AdminUser } from "@/hooks/useAdminUsers";
import { useCanTransferCalendar } from "@/hooks/useAdminAccess";

interface CalendarTransferSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendars: AdminCalendar[]; // Single calendar or multiple for bulk
  onSuccess: () => void;
}

interface SearchUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
}

export function CalendarTransferSheet({
  open,
  onOpenChange,
  calendars,
  onSuccess,
}: CalendarTransferSheetProps) {
  const t = useTranslations();
  const { transferCalendar, bulkTransferCalendars, isLoading } =
    useAdminCalendars();
  const { fetchUsers } = useAdminUsers();
  const canTransfer = useCanTransferCalendar();

  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const isBulk = calendars.length > 1;

  // Debounced search
  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      setSelectedUser(null);

      if (value.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);

      // Debounce search
      const timeoutId = setTimeout(async () => {
        const result = await fetchUsers(
          { search: value, status: "active" },
          { field: "name", direction: "asc" },
          { page: 1, limit: 50 }
        );

        if (result) {
          setSearchResults(
            result.users.map((user: AdminUser) => ({
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image || null,
              role: user.role || "user",
            }))
          );
        }
        setSearchLoading(false);
      }, 300);

      return () => clearTimeout(timeoutId);
    },
    [fetchUsers]
  );

  const handleSelectUser = (user: SearchUser) => {
    setSelectedUser(user);
    setQuery(user.name || user.email);
  };

  const handleTransfer = async () => {
    if (!selectedUser) return;

    let success = false;

    if (isBulk) {
      // Bulk transfer
      const calendarIds = calendars.map((cal) => cal.id);
      success = await bulkTransferCalendars(calendarIds, selectedUser.id);
    } else {
      // Single transfer
      success = await transferCalendar(calendars[0].id, selectedUser.id);
    }

    if (success) {
      handleClose();
      onSuccess();
    }
  };

  const handleClose = () => {
    setQuery("");
    setSelectedUser(null);
    setSearchResults([]);
    onOpenChange(false);
  };

  const getUserInitials = (user: SearchUser) => {
    if (user.name) {
      return user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "superadmin":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "admin":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  const showResults = useMemo(
    () => query.length >= 2 && !selectedUser && searchResults.length > 0,
    [query, selectedUser, searchResults]
  );

  if (!canTransfer) {
    return null;
  }

  return (
    <BaseSheet
      open={open}
      onOpenChange={handleClose}
      title={t("admin.calendars.transferOwnership")}
      description={
        isBulk
          ? t("admin.calendars.transferMultipleDescription", {
              count: calendars.length,
            })
          : t("admin.calendars.transferSingleDescription", {
              name: calendars[0]?.name,
            })
      }
      showSaveButton
      onSave={handleTransfer}
      isSaving={isLoading}
      saveDisabled={!selectedUser}
      saveLabel={t("admin.calendars.transferButton")}
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Calendar(s) Preview */}
        <div className="space-y-2">
          <Label>
            {isBulk
              ? t("admin.calendars.calendarsToTransfer")
              : t("admin.calendars.calendarToTransfer")}
          </Label>
          <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3 bg-muted/20">
            {calendars.map((calendar) => (
              <div
                key={calendar.id}
                className="flex items-center gap-3 p-2 rounded-md bg-background"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: calendar.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {calendar.name}
                  </p>
                  {calendar.ownerId ? (
                    <p className="text-xs text-muted-foreground truncate">
                      {t("admin.calendars.currentOwner")}:{" "}
                      {calendar.owner!.name}
                    </p>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-red-500/10 text-red-500 border-red-500/20 text-xs"
                    >
                      {t("admin.calendars.orphaned")}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Search */}
        <div className="space-y-2">
          <Label htmlFor="user-search">
            {t("admin.calendars.selectNewOwner")}{" "}
            <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="user-search"
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={t("admin.calendars.searchUserPlaceholder")}
              className="pl-10 pr-10"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelectedUser(null);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search Results */}
          {showResults && (
            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto bg-card">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelectUser(user)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <Avatar className="h-8 w-8">
                    {user.image && <AvatarImage src={user.image} />}
                    <AvatarFallback className="text-xs">
                      {getUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={getRoleBadgeClass(user.role)}
                  >
                    {t(`common.roles.${user.role}`)}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {query.length >= 2 &&
            !selectedUser &&
            searchResults.length === 0 &&
            !searchLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("common.empty.noUsersFound")}
              </p>
            )}

          {/* Loading */}
          {searchLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("common.loading")}
            </p>
          )}

          {/* Hint */}
          {query.length < 2 && (
            <p className="text-xs text-muted-foreground">
              {t("admin.calendars.searchUserHint")}
            </p>
          )}
        </div>

        {/* Selected User Preview */}
        {selectedUser && (
          <div className="space-y-2">
            <Label>{t("admin.calendars.newOwner")}</Label>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
              <Avatar className="h-10 w-10">
                {selectedUser.image && <AvatarImage src={selectedUser.image} />}
                <AvatarFallback>{getUserInitials(selectedUser)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {selectedUser.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedUser.email}
                </p>
              </div>
              <Badge
                variant="outline"
                className={getRoleBadgeClass(selectedUser.role)}
              >
                {t(`common.roles.${selectedUser.role}`)}
              </Badge>
            </div>
          </div>
        )}
      </div>
    </BaseSheet>
  );
}
