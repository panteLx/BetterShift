"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { SegmentedControl } from "@/components/segmented-control";
import { StatusBanner } from "@/components/status-banner";
import { PersonRow } from "@/components/person-row";
import { CalendarShareUserSearch } from "@/components/calendar-share-user-search";
import { BundlePicker, useBundleDisplayName } from "@/components/permission-bundle-picker";
import { CalendarTokenList } from "@/components/calendar-token-list";
import { AccessLinkCreateForm } from "@/components/calendar-token-form";
import { useCalendarShares, type CalendarShare } from "@/hooks/useCalendarShares";
import { useCalendarBundles } from "@/hooks/useCalendarBundles";
import { useCalendars } from "@/hooks/useCalendars";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { useAuth } from "@/hooks/useAuth";
import type { usePermissionLinkForm } from "@/hooks/usePermissionLinkForm";
import type { CalendarWithCount } from "@/lib/types";

interface PermissionAssignmentsProps {
  calendarId: string;
  allowGuest: boolean;
  linkForm: ReturnType<typeof usePermissionLinkForm>;
  calendar: CalendarWithCount | undefined;
  updateCalendar: ReturnType<typeof useCalendars>["updateCalendar"];
}

/** "Zuweisungen" tab: who and what holds each bundle — people, public/guest access, links. */
export function PermissionAssignments({
  calendarId,
  allowGuest,
  linkForm,
  calendar,
  updateCalendar,
}: PermissionAssignmentsProps) {
  const t = useTranslations();
  const { user: currentUser } = useAuth();
  const { bundles, isError: bundlesError } = useCalendarBundles(calendarId);
  const { shares, updateShare, removeShare } = useCalendarShares(calendarId);
  const { can, isOwner } = useCalendarPermission(calendarId);
  const displayName = useBundleDisplayName();

  // S2: assigning shares needs manageShares; guest access and links need
  // manageGuestAccess — a bundle can hold one without the other.
  const canManageShares = can("manageShares");
  const canManageGuestAccess = can("manageGuestAccess");

  const [inviteBundleId, setInviteBundleId] = useState<string>("");
  const [shareToDelete, setShareToDelete] = useState<CalendarShare | null>(null);
  const [guestSaving, setGuestSaving] = useState(false);
  const [optimisticGuestBundleId, setOptimisticGuestBundleId] = useState<
    string | null | undefined
  >(undefined);

  type AssignmentSubTab = "people" | "public" | "links";
  const [subTab, setSubTab] = useState<AssignmentSubTab>("people");
  const subTabs: { value: AssignmentSubTab; label: string }[] = [
    { value: "people", label: t("permissionBundles.people") },
    { value: "public", label: t("share.publicAccess") },
    ...(allowGuest
      ? [{ value: "links" as const, label: t("share.links") }]
      : []),
  ];

  const effectiveInviteBundleId =
    inviteBundleId || bundles.find((b) => b.seedKey === "read")?.id || bundles[0]?.id || "";

  const guestBundleId =
    optimisticGuestBundleId !== undefined
      ? optimisticGuestBundleId
      : (calendar?.guestBundleId ?? null);

  const handleGuestChange = async (bundleId: string | null) => {
    if (!canManageGuestAccess) return;
    setOptimisticGuestBundleId(bundleId);
    setGuestSaving(true);
    try {
      await updateCalendar(calendarId, { guestBundleId: bundleId });
    } finally {
      setGuestSaving(false);
      setOptimisticGuestBundleId(undefined);
    }
  };

  const you = <span className="ml-1.5 font-normal text-fg-tertiary">({t("share.you")})</span>;
  const staticLabel = (label: string) => (
    <span className="shrink-0 px-[9px] text-[12.5px] font-medium text-fg-secondary">{label}</span>
  );

  const ownerRow = isOwner && currentUser && (
    <PersonRow
      user={{ name: currentUser.name ?? null, email: currentUser.email, image: currentUser.image }}
      highlight
      suffix={you}
      action={staticLabel(t("sharingSheet.owner"))}
    />
  );

  const cardClass = "flex flex-col gap-3 rounded-[11px] border border-line p-3.5";

  return (
    <div className="flex flex-col gap-3.5">
      <SegmentedControl
        label={t("permissionBundles.tabAssignments")}
        value={subTab}
        onChange={setSubTab}
        options={subTabs}
      />

      {subTab === "people" && (
        <section className={cardClass}>
          {canManageShares && bundlesError && (
            <StatusBanner tone="danger" icon={TriangleAlert}>
              {t("permissionBundles.bundlesUnavailable")}
            </StatusBanner>
          )}
          {canManageShares && !bundlesError && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="min-w-0 flex-1">
                <CalendarShareUserSearch calendarId={calendarId} bundleId={effectiveInviteBundleId} />
              </div>
              <BundlePicker
                bundles={bundles}
                value={effectiveInviteBundleId || null}
                onChange={(id) => id && setInviteBundleId(id)}
                triggerAriaLabel={t("permissionBundles.inviteAs")}
                className="h-10 shrink-0 self-start"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            {ownerRow}
            {shares.map((share) => {
              const isSelf = share.userId === currentUser?.id;
              const editable = canManageShares && !isSelf && !bundlesError;
              return (
                <PersonRow
                  key={share.id}
                  user={share.user}
                  suffix={isSelf ? you : undefined}
                  action={
                    editable ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <BundlePicker
                          bundles={bundles}
                          value={share.bundleId}
                          onChange={(id) => id && updateShare(share.id, id)}
                          triggerAriaLabel={t("sharingSheet.changePermission", {
                            name: share.user.name || share.user.email,
                          })}
                        />
                        <button
                          type="button"
                          aria-label={t("share.removeAccess")}
                          onClick={() => setShareToDelete(share)}
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-tertiary transition-colors hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ) : (
                      staticLabel(displayName(share.bundle) ?? "")
                    )
                  }
                />
              );
            })}
            {shares.length === 0 && !ownerRow && (
              <p className="rounded-[11px] border border-dashed border-control px-3.5 py-3 text-center text-[13px] text-fg-tertiary">
                {t("share.noSharesDescription")}
              </p>
            )}
          </div>
        </section>
      )}

      {subTab === "public" && (
        <section className={cardClass}>
          {canManageGuestAccess && bundlesError ? (
            <StatusBanner tone="danger" icon={TriangleAlert}>
              {t("permissionBundles.bundlesUnavailable")}
            </StatusBanner>
          ) : (
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <p className="min-w-0 flex-1 text-[13px] text-fg-secondary">
                {allowGuest
                  ? t("share.publicAccessDescriptionGuestsOn")
                  : t("share.publicAccessDescriptionGuestsOff")}
              </p>
              <BundlePicker
                bundles={bundles}
                value={guestBundleId}
                onChange={handleGuestChange}
                guestEligibleOnly
                allowNone
                noneLabel={t("sharingSheet.accessNone")}
                disabled={!canManageGuestAccess || guestSaving}
                triggerAriaLabel={t("share.publicAccess")}
              />
            </div>
          )}
        </section>
      )}

      {subTab === "links" && allowGuest && (
        <section className={cardClass}>
          <CalendarTokenList calendarId={calendarId} />
          {canManageGuestAccess && linkForm.bundlesError && (
            <StatusBanner tone="danger" icon={TriangleAlert}>
              {t("permissionBundles.bundlesUnavailable")}
            </StatusBanner>
          )}
          {canManageGuestAccess && !linkForm.bundlesError && (
            <>
              <AccessLinkCreateForm form={linkForm} />
              <Button
                onClick={linkForm.create}
                disabled={linkForm.creating || !linkForm.bundleId}
                className="h-10 self-start font-semibold"
              >
                {linkForm.creating ? t("sharingSheet.creating") : t("sharingSheet.createLink")}
              </Button>
            </>
          )}
        </section>
      )}

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
    </div>
  );
}
