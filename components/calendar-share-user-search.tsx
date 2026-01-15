"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Search, UserPlus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useCalendarShares, type SearchUser } from "@/hooks/useCalendarShares";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";

interface CalendarShareUserSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  onSuccess?: () => void;
}

export function CalendarShareUserSearch({
  open,
  onOpenChange,
  calendarId,
  onSuccess,
}: CalendarShareUserSearchProps) {
  const t = useTranslations();
  const { searchUsers, searchResults, searchLoading, addShare } =
    useCalendarShares(calendarId);
  const { isOwner } = useCalendarPermission(calendarId);

  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [permission, setPermission] = useState<"admin" | "write" | "read">(
    "read"
  );
  const [loading, setLoading] = useState(false);

  // Debounced search
  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      setSelectedUser(null);
      const timeoutId = setTimeout(() => {
        searchUsers(value);
      }, 300);
      return () => clearTimeout(timeoutId);
    },
    [searchUsers]
  );

  const handleSelectUser = (user: SearchUser) => {
    setSelectedUser(user);
    setQuery(user.name || user.email);
  };

  const handleAddShare = async () => {
    if (!selectedUser) return;

    setLoading(true);
    const result = await addShare(selectedUser.id, permission);
    setLoading(false);

    if (result.success) {
      setQuery("");
      setSelectedUser(null);
      setPermission("read");
      onSuccess?.();
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setQuery("");
    setSelectedUser(null);
    setPermission("read");
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

  const showResults = useMemo(
    () => query.length >= 2 && !selectedUser && searchResults.length > 0,
    [query, selectedUser, searchResults]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t("share.addUser")}
          </DialogTitle>
          <DialogDescription>{t("share.addUserDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User Search */}
          <div className="space-y-2">
            <Label htmlFor="user-search">{t("share.searchUser")}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="user-search"
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t("share.searchUserPlaceholder")}
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

            {/* Search Results Dropdown */}
            {showResults && (
              <div className="border rounded-lg overflow-hidden bg-background shadow-lg">
                <div className="max-h-[200px] overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
                    >
                      <Avatar className="h-8 w-8">
                        {user.image && <AvatarImage src={user.image} />}
                        <AvatarFallback className="text-xs">
                          {getUserInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {user.name || user.email}
                        </p>
                        {user.name && (
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Loading */}
            {searchLoading && (
              <p className="text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            )}

            {/* No Results */}
            {query.length >= 2 &&
              !selectedUser &&
              searchResults.length === 0 &&
              !searchLoading && (
                <p className="text-sm text-muted-foreground">
                  {t("common.empty.noUsersFound")}
                </p>
              )}
          </div>

          {/* Selected User */}
          {selectedUser && (
            <div className="border rounded-lg p-3 bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {t("share.selectedUser")}
              </p>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {selectedUser.image && (
                    <AvatarImage src={selectedUser.image} />
                  )}
                  <AvatarFallback>
                    {getUserInitials(selectedUser)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {selectedUser.name || selectedUser.email}
                  </p>
                  {selectedUser.name && (
                    <p className="text-xs text-muted-foreground">
                      {selectedUser.email}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Permission Selection */}
          <div className="space-y-2">
            <Label htmlFor="permission">{t("common.labels.permission")}</Label>
            <Select
              value={permission}
              onValueChange={(value) =>
                setPermission(value as "admin" | "write" | "read")
              }
            >
              <SelectTrigger id="permission">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">
                      {t("common.labels.permissions.read")}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="write">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">
                      {t("common.labels.permissions.write")}
                    </span>
                  </div>
                </SelectItem>
                {isOwner && (
                  <SelectItem value="admin">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">
                        {t("common.labels.permissions.admin")}
                      </span>
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleAddShare}
            disabled={!selectedUser || loading}
          >
            {loading ? t("common.adding") : t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
