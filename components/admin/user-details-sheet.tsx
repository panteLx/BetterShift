"use client";

import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { ChevronRight, KeyRound, Lock, LockOpen, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListRow, Pill, SectionLabel } from "@/components/form-kit";
import { StatusBanner } from "@/components/status-banner";
import { AdminDetailPanel } from "@/components/admin/admin-detail-panel";
import { RolePill, StatTile, StatusPill, UserAvatar } from "@/components/admin/admin-kit";
import { fetchAdminUserDetails } from "@/hooks/useAdminUsers";
import { useUserPermissions } from "@/hooks/useAdminAccess";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { getDateLocale } from "@/lib/locales";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { shiftVars } from "@/lib/shift-display";

interface UserDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onEdit: () => void;
  onResetPassword: () => void;
  onBan: () => void;
  onUnban: () => void;
  onDelete: () => void;
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger,
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn(
        "h-[38px] gap-2 rounded-[9px] px-2 text-[13.5px] font-semibold text-fg-body",
        danger && "border-danger-line text-danger hover:bg-danger-surface hover:text-danger",
        className
      )}
    >
      <Icon className={cn("size-[15px]", !danger && "text-fg-secondary")} />
      <span className="truncate">{label}</span>
    </Button>
  );
}

/** Phone variant of a secondary action: a full-width row with a chevron (13i). */
function ActionRow({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[46px] w-full items-center gap-2.5 rounded-[10px] border border-line bg-surface-card px-[13px] text-left transition-colors hover:bg-surface-panel"
    >
      <Icon className="size-[17px] text-fg-secondary" />
      <span className="flex-1 truncate text-[14px] font-semibold text-fg-body">{label}</span>
      <ChevronRight className="size-4 text-fg-faint" />
    </button>
  );
}

function Section({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function UserDetailsSheet({
  open,
  onOpenChange,
  userId,
  onEdit,
  onResetPassword,
  onBan,
  onUnban,
  onDelete,
}: UserDetailsSheetProps) {
  const t = useTranslations();
  const dateLocale = getDateLocale(useLocale());
  const desktop = useMediaQuery(DESKTOP_QUERY, true);
  const { data: userDetails = null, isError: loadFailed } = useQuery({
    queryKey: queryKeys.admin.users.detail(userId),
    queryFn: () => fetchAdminUserDetails(userId),
    enabled: open,
    retry: false,
  });

  const { canEdit, canBan, canDelete, canResetPassword } = useUserPermissions(userDetails);

  const user = userDetails;
  const date = (value: Date, pattern = "PP") => format(value, pattern, { locale: dateLocale });
  const hasActions = canEdit || canResetPassword || canBan || canDelete;

  const banAction =
    user && canBan
      ? user.banned
        ? { icon: LockOpen, label: t("admin.unbanUser"), onClick: onUnban }
        : { icon: Lock, label: t("adminUsers.ban"), onClick: onBan }
      : null;

  const phoneFooter = user && hasActions && (
    <div className="flex w-full flex-col gap-2">
      {banAction && <ActionRow {...banAction} />}
      {canResetPassword && (
        <ActionRow icon={KeyRound} label={t("admin.resetPassword")} onClick={onResetPassword} />
      )}
      {(canEdit || canDelete) && (
        <div className="flex gap-2">
          {canEdit && (
            <ActionButton
              icon={Pencil}
              label={t("adminUsers.edit")}
              onClick={onEdit}
              className="h-[46px] flex-1 text-[14px]"
            />
          )}
          {canDelete && (
            <ActionButton
              icon={Trash2}
              label={t("common.delete")}
              onClick={onDelete}
              danger
              className="h-[46px] flex-1 text-[14px]"
            />
          )}
        </div>
      )}
    </div>
  );

  const desktopFooter = (
    <Button
      type="button"
      variant="outline"
      onClick={() => onOpenChange(false)}
      className="h-10 flex-1 font-semibold"
    >
      {t("common.close")}
    </Button>
  );

  return (
    <AdminDetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.userDetails")}
      subtitle={user?.name || user?.email}
      footer={desktop ? desktopFooter : phoneFooter || undefined}
    >
      {!user ? (
        <p className="py-12 text-center text-[13px] text-fg-tertiary">
          {loadFailed ? t("admin.userNotFound") : t("common.loading")}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-[13px]">
            <UserAvatar name={user.name || user.email} image={user.image} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[17px] font-semibold tracking-[-0.01em] text-fg-strong">
                  {user.name}
                </span>
                <RolePill role={user.role} />
                <StatusPill banned={user.banned} />
              </div>
              <div className="mt-0.5 truncate text-[13px] text-fg-secondary">{user.email}</div>
              <div className="mt-0.5 text-[12px] text-fg-faint">
                {t("adminUsers.joinedOn", { date: date(user.createdAt, "PPP") })}
              </div>
            </div>
          </div>

          {user.banned && (
            <StatusBanner
              tone="danger"
              icon={Lock}
              title={
                user.banExpires
                  ? t("admin.bannedUntil", { date: date(user.banExpires, "PPP") })
                  : t("admin.bannedPermanently")
              }
            >
              {user.banReason && t("adminUsers.banReasonQuoted", { reason: user.banReason })}
            </StatusBanner>
          )}

          <Section label={t("adminUsers.numbers")}>
            <div className="grid grid-cols-3 gap-2.5">
              <StatTile label={t("admin.ownedCalendars")} value={user.ownedCalendars.length} />
              <StatTile label={t("common.labels.sharedCalendars")} value={user.sharedCalendars.length} />
              <StatTile label={t("common.auth.activeSessions")} value={user.sessionsCount} />
            </div>
          </Section>

          {user.ownedCalendars.length > 0 && (
            <Section label={t("admin.ownedCalendars")}>
              {user.ownedCalendars.map((calendar) => (
                <ListRow key={calendar.id} className="py-2.5">
                  <span
                    className="shift-rail size-2.5 shrink-0 rounded-full"
                    style={shiftVars(calendar.color)}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-fg-strong">
                    {calendar.name}
                  </span>
                </ListRow>
              ))}
            </Section>
          )}

          {user.sharedCalendars.length > 0 && (
            <Section label={t("common.labels.sharedCalendars")}>
              {user.sharedCalendars.map((share) => (
                <ListRow key={share.id} className="py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-fg-strong">
                    {share.name}
                  </span>
                  <Pill>
                    {share.permission === "admin"
                      ? t("common.labels.permissions.admin")
                      : share.permission === "write"
                        ? t("common.labels.permissions.write")
                        : t("common.labels.permissions.read")}
                  </Pill>
                </ListRow>
              ))}
            </Section>
          )}

          {user.accounts.length > 0 && (
            <Section label={t("common.auth.connectedAccounts")}>
              {user.accounts.map((account) => (
                <ListRow key={account.id} className="py-[11px]">
                  <KeyRound className="size-4 shrink-0 text-fg-secondary" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold capitalize text-fg-strong">
                    {account.providerId}
                  </span>
                  <span className="font-mono text-[12px] text-fg-tertiary">{date(account.createdAt)}</span>
                </ListRow>
              ))}
            </Section>
          )}

          {desktop && hasActions && (
            <Section label={t("adminUsers.actions")}>
              <div className="grid grid-cols-2 gap-2">
                {canEdit && <ActionButton icon={Pencil} label={t("adminUsers.edit")} onClick={onEdit} />}
                {canResetPassword && (
                  <ActionButton icon={KeyRound} label={t("admin.resetPassword")} onClick={onResetPassword} />
                )}
                {banAction && <ActionButton {...banAction} />}
                {canDelete && (
                  <ActionButton icon={Trash2} label={t("common.delete")} onClick={onDelete} danger />
                )}
              </div>
            </Section>
          )}
        </>
      )}
    </AdminDetailPanel>
  );
}
