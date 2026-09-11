"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, ListRow, Pill, SectionLabel, inputClass } from "@/components/form-kit";
import { AdminFormPanel } from "@/components/admin/admin-form-panel";
import { RolePill, UserAvatar } from "@/components/admin/admin-kit";
import { isOrphaned } from "@/components/admin/calendar-table";
import { useAdminCalendarActions, type AdminCalendar } from "@/hooks/useAdminCalendars";
import { fetchAdminUsers } from "@/hooks/useAdminUsers";
import { useCanTransferCalendar } from "@/hooks/useAdminAccess";
import { cn } from "@/lib/utils";
import { shiftVars } from "@/lib/shift-display";

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

function UserRow({ user, selected }: { user: SearchUser; selected?: boolean }) {
  return (
    <>
      <UserAvatar name={user.name || user.email} image={user.image} size={32} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-fg-strong">{user.name}</div>
        <div className="truncate text-[12px] text-fg-tertiary">{user.email}</div>
      </div>
      <RolePill role={user.role} />
      {selected && <Check className="size-4 shrink-0 text-brand-ink" />}
    </>
  );
}

export function CalendarTransferSheet({
  open,
  onOpenChange,
  calendars,
  onSuccess,
}: CalendarTransferSheetProps) {
  const t = useTranslations();
  const { transferCalendar, bulkTransferCalendars, isTransferring } = useAdminCalendarActions();
  const canTransfer = useCanTransferCalendar();

  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isBulk = calendars.length > 1;

  useEffect(() => () => clearTimeout(searchTimeout.current ?? undefined), []);

  const handleSearch = (value: string) => {
    setQuery(value);
    setSelectedUser(null);
    clearTimeout(searchTimeout.current ?? undefined);

    if (value.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const result = await fetchAdminUsers({
          search: value,
          status: "active",
          sort: "name",
          order: "asc",
          limit: 50,
        });
        setSearchResults(
          result.items.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image || null,
            role: user.role || "user",
          }))
        );
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 300);
  };

  const handleSelectUser = (user: SearchUser) => {
    setSelectedUser(user);
    setQuery(user.name || user.email);
  };

  const handleClose = () => {
    clearTimeout(searchTimeout.current ?? undefined);
    setQuery("");
    setSelectedUser(null);
    setSearchResults([]);
    setSearchLoading(false);
    onOpenChange(false);
  };

  const handleTransfer = async () => {
    if (!selectedUser) return;

    const success = isBulk
      ? await bulkTransferCalendars(
          calendars.map((cal) => cal.id),
          selectedUser.id
        )
      : await transferCalendar(calendars[0].id, selectedUser.id);

    if (success) {
      handleClose();
      onSuccess();
    }
  };

  if (!canTransfer) {
    return null;
  }

  const showResults = query.length >= 2 && !selectedUser && searchResults.length > 0;

  return (
    <AdminFormPanel
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
      title={t("admin.calendars.transferOwnership")}
      subtitle={
        isBulk
          ? t("admin.calendars.transferMultipleDescription", { count: calendars.length })
          : calendars[0]?.name
      }
      onSave={handleTransfer}
      isSaving={isTransferring}
      saveDisabled={!selectedUser}
      saveLabel={t("admin.calendars.transferButton")}
    >
      <section>
        <SectionLabel>
          {isBulk
            ? t("admin.calendars.calendarsToTransfer")
            : t("admin.calendars.calendarToTransfer")}
        </SectionLabel>
        <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
          {calendars.map((calendar) => (
            <ListRow key={calendar.id} className="py-2.5">
              <span
                className="shift-rail size-2.5 shrink-0 rounded-full"
                style={shiftVars(calendar.color)}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-fg-strong">{calendar.name}</div>
                {!isOrphaned(calendar) && (
                  <div className="truncate text-[12px] text-fg-tertiary">
                    {t("admin.calendars.currentOwner")}: {calendar.owner!.name}
                  </div>
                )}
              </div>
              {isOrphaned(calendar) && <Pill tone="warning">{t("admin.calendars.orphaned")}</Pill>}
            </ListRow>
          ))}
        </div>
      </section>

      <Field
        label={t("admin.calendars.selectNewOwner")}
        htmlFor="transfer-user-search"
        hint={query.length < 2 ? t("admin.calendars.searchUserHint") : undefined}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
          <Input
            id="transfer-user-search"
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("admin.calendars.searchUserPlaceholder")}
            className={cn(inputClass, "pl-9 pr-10")}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => handleSearch("")}
              aria-label={t("admin.calendars.clearSelection")}
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-tertiary hover:text-fg-strong"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {showResults && (
          <div className="flex max-h-64 flex-col overflow-y-auto rounded-[11px] border border-line bg-surface-card">
            {searchResults.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectUser(user)}
                className="flex items-center gap-3 border-b border-line-subtle px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-panel"
              >
                <UserRow user={user} />
              </button>
            ))}
          </div>
        )}

        {searchLoading && (
          <p className="py-3 text-center text-[13px] text-fg-tertiary">{t("common.loading")}</p>
        )}

        {query.length >= 2 && !selectedUser && searchResults.length === 0 && !searchLoading && (
          <p className="py-3 text-center text-[13px] text-fg-tertiary">{t("common.empty.noUsersFound")}</p>
        )}
      </Field>

      {selectedUser && (
        <section>
          <SectionLabel>{t("admin.calendars.newOwner")}</SectionLabel>
          <ListRow highlighted className="bg-brand-soft">
            <UserRow user={selectedUser} selected />
          </ListRow>
        </section>
      )}
    </AdminFormPanel>
  );
}
