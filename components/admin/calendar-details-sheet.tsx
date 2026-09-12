"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { CloudDownload, Eye, EyeOff, Link2, Pencil, Send, SquarePen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListRow, Pill } from "@/components/form-kit";
import { AdminDetailPanel } from "@/components/admin/admin-detail-panel";
import { DetailSection, StatTile, UserAvatar } from "@/components/admin/admin-kit";
import { isOrphaned, ownerColor } from "@/components/admin/calendar-table";
import { fetchAdminCalendarDetails } from "@/hooks/useAdminCalendars";
import {
  useCanEditCalendar,
  useCanDeleteCalendar,
  useCanTransferCalendar,
} from "@/hooks/useAdminAccess";
import { getDateLocale } from "@/lib/locales";
import { queryKeys } from "@/lib/query-keys";
import { shiftVars } from "@/lib/shift-display";

interface CalendarDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  onEdit: () => void;
  onTransfer: () => void;
  onDelete: () => void;
}

function PermissionPill({ permission }: { permission: string }) {
  const t = useTranslations();
  if (permission === "admin") return <Pill tone="violet">{t("common.labels.permissions.admin")}</Pill>;
  if (permission === "write") return <Pill tone="brand">{t("common.labels.permissions.write")}</Pill>;
  return <Pill>{t("common.labels.permissions.read")}</Pill>;
}

export function CalendarDetailsSheet({
  open,
  onOpenChange,
  calendarId,
  onEdit,
  onTransfer,
  onDelete,
}: CalendarDetailsSheetProps) {
  const t = useTranslations();
  const dateLocale = getDateLocale(useLocale());
  const { data: calendar = null, isError: loadFailed } = useQuery({
    queryKey: queryKeys.admin.calendars.detail(calendarId),
    queryFn: () => fetchAdminCalendarDetails(calendarId),
    enabled: open,
    retry: false,
  });

  const canEdit = useCanEditCalendar();
  const canDelete = useCanDeleteCalendar();
  const canTransfer = useCanTransferCalendar();

  const date = (value: Date) => format(value, "PP", { locale: dateLocale });
  const orphaned = calendar ? isOrphaned(calendar) : false;

  const guest = calendar?.guestPermission;
  const GuestIcon = guest === "write" ? SquarePen : guest === "read" ? Eye : EyeOff;
  const guestLabel =
    guest === "write"
      ? t("common.labels.permissions.write")
      : guest === "read"
        ? t("common.labels.permissions.read")
        : t("common.labels.permissions.none");
  const guestHint =
    guest === "write"
      ? t("adminCalendars.guestWriteHint")
      : guest === "read"
        ? t("adminCalendars.guestReadHint")
        : t("adminCalendars.guestNoneHint");

  const footer = (canEdit || canTransfer || canDelete) && calendar && (
    <>
      {canEdit && (
        <Button variant="outline" onClick={onEdit} className="h-10 min-w-0 flex-1 font-semibold">
          <Pencil className="size-[15px] text-fg-secondary" />
          <span className="truncate">{t("adminUsers.edit")}</span>
        </Button>
      )}
      {canTransfer && (
        <Button variant="outline" onClick={onTransfer} className="h-10 min-w-0 flex-1 font-semibold">
          <Send className="size-[15px] text-fg-secondary" />
          <span className="truncate">{t("admin.calendars.transferOwnership")}</span>
        </Button>
      )}
      {canDelete && (
        <Button
          variant="outline"
          onClick={onDelete}
          aria-label={t("admin.calendars.deleteCalendar")}
          title={t("admin.calendars.deleteCalendar")}
          className="h-10 w-11 shrink-0 border-danger-line p-0 text-danger hover:bg-danger-surface hover:text-danger"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </>
  );

  return (
    <AdminDetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.calendars.calendarDetails")}
      subtitle={calendar?.name}
      footer={footer || undefined}
    >
      {!calendar ? (
        <p className="py-12 text-center text-[13px] text-fg-tertiary">
          {loadFailed ? t("admin.calendars.noCalendarsFound") : t("common.loading")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-[11px] border border-line bg-surface-card px-3.5 py-[13px]">
              <div className="flex min-w-0 items-center gap-[9px]">
                <span
                  className="shift-rail size-2.5 shrink-0 rounded-full"
                  style={shiftVars(calendar.color)}
                />
                <span className="truncate text-[15px] font-semibold text-fg-strong">{calendar.name}</span>
              </div>
              <div className="mt-[9px] text-[11.5px] leading-relaxed text-fg-tertiary">
                <div>
                  {t("common.stats.created")} {date(calendar.createdAt)}
                </div>
                <div>
                  {t("admin.calendars.updated")} {date(calendar.updatedAt)}
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-[11px] border border-line bg-surface-card px-3.5 py-[13px]">
              <div className="eyebrow">{t("admin.calendars.owner")}</div>
              {orphaned ? (
                <div className="mt-[9px] flex flex-col items-start gap-1.5">
                  <Pill tone="warning">{t("admin.calendars.orphaned")}</Pill>
                  <span className="text-[12px] text-fg-tertiary">{t("admin.calendars.noOwner")}</span>
                </div>
              ) : (
                <div className="mt-[9px] flex min-w-0 items-center gap-2.5">
                  <UserAvatar
                    name={calendar.owner?.name || calendar.owner?.email}
                    image={calendar.owner?.image}
                    size={30}
                    color={ownerColor(calendar.ownerId)}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-fg-strong">
                      {calendar.owner?.name}
                    </div>
                    <div className="truncate text-[11.5px] text-fg-tertiary">{calendar.owner?.email}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DetailSection label={t("adminCalendars.content")}>
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile label={t("common.labels.shifts")} value={calendar.shiftsCount} />
              <StatTile label={t("common.labels.presets")} value={calendar.presetsCount} />
              <StatTile label={t("common.labels.notes")} value={calendar.notesCount} />
              <StatTile
                label={t("adminCalendars.sharesAndLinks", {
                  links: calendar.shareTokens?.length || 0,
                })}
                value={calendar.shares.length}
              />
            </div>
          </DetailSection>

          <DetailSection label={t("adminCalendars.publicAccess")}>
            <ListRow className="py-[11px]">
              <GuestIcon className="size-4 shrink-0 text-fg-secondary" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-fg-strong">
                  {t("adminCalendars.guestPermissionValue", { permission: guestLabel })}
                </div>
                <div className="mt-0.5 text-[11.5px] text-fg-tertiary">{guestHint}</div>
              </div>
            </ListRow>
          </DetailSection>

          {calendar.shares.length > 0 && (
            <DetailSection label={t("admin.calendars.userSharesList")}>
              {calendar.shares.map((share) => (
                <ListRow key={share.userId} className="py-2.5">
                  <UserAvatar name={share.userName || share.userEmail} image={share.userImage} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-fg-strong">{share.userName}</div>
                    <div className="truncate text-[12px] text-fg-tertiary">{share.userEmail}</div>
                  </div>
                  <PermissionPill permission={share.permission} />
                </ListRow>
              ))}
            </DetailSection>
          )}

          {calendar.shareTokens?.length > 0 && (
            <DetailSection label={t("admin.calendars.tokenSharesList")}>
              {calendar.shareTokens.map((token) => (
                <ListRow key={token.id} className="py-2.5">
                  <Link2 className="size-4 shrink-0 text-fg-secondary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-fg-strong">{token.name}</div>
                    <div className="text-[12px] text-fg-tertiary">
                      {t("common.stats.created")} {date(new Date(token.createdAt))}
                    </div>
                  </div>
                  <PermissionPill permission={token.permission} />
                </ListRow>
              ))}
            </DetailSection>
          )}

          {calendar.externalSyncs?.length > 0 && (
            <DetailSection label={t("admin.calendars.externalSyncs")}>
              {calendar.externalSyncs.map((sync) => (
                <ListRow key={sync.id} className="items-start py-2.5">
                  <CloudDownload className="mt-0.5 size-4 shrink-0 text-fg-secondary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-fg-strong">{sync.name}</div>
                    <div className="truncate font-mono text-[11.5px] text-fg-tertiary">{sync.url}</div>
                    {sync.lastSyncedAt && (
                      <div className="mt-0.5 text-[12px] text-fg-tertiary">
                        {t("admin.calendars.lastSynced")} {date(sync.lastSyncedAt)}
                      </div>
                    )}
                  </div>
                </ListRow>
              ))}
            </DetailSection>
          )}
        </>
      )}
    </AdminDetailPanel>
  );
}
