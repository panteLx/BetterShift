"use client";

import { ReactNode, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Trash2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { ListRow, SectionLabel } from "@/components/form-kit";
import {
  CalendarShareUserSearch,
  getUserInitials,
} from "@/components/calendar-share-user-search";
import { useCalendarShares, type CalendarShare } from "@/hooks/useCalendarShares";
import { useAuth } from "@/hooks/useAuth";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { cn } from "@/lib/utils";

type SharePermission = "admin" | "write" | "read";

interface CalendarShareListProps {
  calendarId: string;
  canManageShares: boolean;
}

function PersonRow({
  user,
  highlight,
  suffix,
  action,
}: {
  user: { name: string | null; email: string; image?: string | null };
  highlight?: boolean;
  suffix?: ReactNode;
  action: ReactNode;
}) {
  return (
    <ListRow>
      <Avatar className="size-8">
        {user.image && <AvatarImage src={user.image} alt="" />}
        <AvatarFallback
          className={cn(
            "text-[11.5px] font-semibold",
            highlight ? "bg-brand-soft text-brand-ink" : "bg-surface-sunken text-fg-secondary"
          )}
        >
          {getUserInitials(user)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-fg-strong">
          {user.name || user.email || "…"}
          {suffix}
        </div>
        {user.name && user.email && (
          <div className="truncate text-[12px] text-fg-tertiary">{user.email}</div>
        )}
      </div>
      {action}
    </ListRow>
  );
}

/** "Personen" tab: invite row plus everyone with access. */
export function CalendarShareList({ calendarId, canManageShares }: CalendarShareListProps) {
  const t = useTranslations();
  const { user: currentUser } = useAuth();
  const { isOwner } = useCalendarPermission(calendarId);
  const { shares, updateShare, removeShare } = useCalendarShares(calendarId);
  const [shareToDelete, setShareToDelete] = useState<CalendarShare | null>(null);

  const permissionLabel = (permission: CalendarShare["permission"]) =>
    permission === "owner"
      ? t("sharingSheet.owner")
      : permission === "admin"
        ? t("common.labels.permissions.admin")
        : permission === "write"
          ? t("sharingSheet.permWrite")
          : t("sharingSheet.permRead");

  const permissionOptions: { value: SharePermission; title: string; description: string }[] = [
    { value: "read", title: t("sharingSheet.permRead"), description: t("sharingSheet.permReadDesc") },
    { value: "write", title: t("sharingSheet.permWrite"), description: t("sharingSheet.permWriteDesc") },
    ...(isOwner
      ? [
          {
            value: "admin" as const,
            title: t("common.labels.permissions.admin"),
            description: t("sharingSheet.permAdminDesc"),
          },
        ]
      : []),
  ];

  const you = <span className="ml-1.5 font-normal text-fg-tertiary">({t("share.you")})</span>;
  const staticLabel = (label: string) => (
    <span className="shrink-0 px-[9px] text-[12.5px] font-medium text-fg-secondary">{label}</span>
  );

  const renderAction = (share: CalendarShare) => {
    const isSelf = share.userId === currentUser?.id;
    // Only the owner may touch admins; nobody changes their own level.
    const canRemove = canManageShares && (isOwner || share.permission !== "admin");
    const canChange = canRemove && !isSelf;
    if (!canRemove) return staticLabel(permissionLabel(share.permission));

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("sharingSheet.changePermission", {
            name: share.user.name || share.user.email,
          })}
          className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-lg border border-line px-[9px] text-[12.5px] font-medium text-fg-body transition-colors hover:bg-surface-panel data-[state=open]:bg-surface-panel"
        >
          {permissionLabel(share.permission)}
          <ChevronDown className="size-[13px] text-fg-tertiary" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {canChange && (
            <>
              {permissionOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => {
                    if (option.value !== share.permission) updateShare(share.id, option.value);
                  }}
                  className="items-start gap-2.5 py-2"
                >
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0 text-brand",
                      option.value !== share.permission && "invisible"
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-fg-strong">
                      {option.title}
                    </span>
                    <span className="block text-[12px] text-fg-tertiary">{option.description}</span>
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onClick={() => setShareToDelete(share)}
            className="gap-2.5 text-danger focus:text-danger"
          >
            <Trash2 className="size-4 text-danger" />
            {t("share.removeAccess")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // The shares endpoint lists grants only; the owner row is known just for the owner themself.
  const ownerRow = isOwner && currentUser && (
    <PersonRow
      user={{ name: currentUser.name ?? null, email: currentUser.email, image: currentUser.image }}
      highlight
      suffix={you}
      action={staticLabel(t("sharingSheet.owner"))}
    />
  );

  return (
    <>
      {canManageShares && <CalendarShareUserSearch calendarId={calendarId} />}

      <section className="flex flex-col gap-2">
        <SectionLabel className="mb-0">{t("sharingSheet.haveAccess")}</SectionLabel>
        {ownerRow}
        {shares.map((share) => (
          <PersonRow
            key={share.id}
            user={share.user}
            suffix={share.userId === currentUser?.id ? you : undefined}
            action={renderAction(share)}
          />
        ))}
        {shares.length === 0 && (
          <p className="rounded-[11px] border border-dashed border-control px-3.5 py-3 text-center text-[13px] text-fg-tertiary">
            {t("share.noSharesDescription")}
          </p>
        )}
      </section>

      {shareToDelete && (
        <ConfirmationDialog
          open
          onOpenChange={(open) => !open && setShareToDelete(null)}
          onConfirm={async () => {
            await removeShare(shareToDelete.id);
            setShareToDelete(null);
          }}
          title={t("share.removeShareConfirmTitle")}
          description={t("share.removeShareConfirmDesc", {
            user: shareToDelete.user.name || shareToDelete.user.email,
          })}
          confirmVariant="destructive"
          confirmText={t("share.removeAccess")}
        />
      )}
    </>
  );
}
