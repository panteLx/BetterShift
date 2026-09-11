"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, RefreshCw, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { PanelBody, PanelDialog, PanelFooter } from "@/components/panel-dialog";
import { SegmentedControl } from "@/components/segmented-control";
import { ListRow, Pill } from "@/components/form-kit";
import { REFETCH_INTERVAL } from "@/lib/query-client";
import { SyncLog } from "@/lib/db/schema";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type LogFilter = "all" | "success" | "error";

async function fetchSyncLogsApi(calendarId: string): Promise<SyncLog[]> {
  const params = new URLSearchParams({ calendarId, limit: "20" });
  const response = await fetch(`/api/sync-logs?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch sync logs");
  }

  return await response.json();
}

interface SyncNotificationsPanelProps {
  calendarId: string;
  onClose: () => void;
  onErrorsMarkedRead?: () => void;
}

export function SyncNotificationsPanel({
  calendarId,
  onClose,
  onErrorsMarkedRead,
}: SyncNotificationsPanelProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<LogFilter>("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: queryKeys.externalSyncs.logs(calendarId),
    queryFn: () => fetchSyncLogsApi(calendarId),
    refetchInterval: REFETCH_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/sync-logs?calendarId=${calendarId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error("Failed to delete sync logs");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.externalSyncs.logs(calendarId) });
      toast.success(t("common.deleted", { item: t("syncNotifications.title") }));
    },
    onError: () => {
      toast.error(t("common.deleteError", { item: t("syncNotifications.title") }));
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/sync-logs?calendarId=${calendarId}&action=markErrorsAsRead`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to mark errors as read");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.externalSyncs.logs(calendarId) });
      toast.success(t("syncNotifications.markedAsRead"));
      onErrorsMarkedRead?.();
    },
    onError: () => {
      toast.error(t("common.updateError", { item: t("syncNotifications.title") }));
    },
  });

  const hasUnreadErrors = logs.some((log) => log.status === "error" && !log.isRead);
  const filteredLogs = filter === "all" ? logs : logs.filter((log) => log.status === filter);

  return (
    <>
      <PanelBody>
        <div className="flex flex-col gap-3.5">
          <SegmentedControl<LogFilter>
            label={t("syncNotifications.title")}
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: t("syncNotifications.filterAll") },
              { value: "success", label: t("syncNotifications.filterSuccess") },
              { value: "error", label: t("syncNotifications.filterError") },
            ]}
          />

          {isLoading ? (
            <p className="py-8 text-center text-[13px] text-fg-tertiary">{t("common.loading")}</p>
          ) : filteredLogs.length === 0 ? (
            <p className="rounded-[11px] border border-dashed border-control px-4 py-8 text-center text-[13px] text-fg-tertiary">
              {logs.length === 0
                ? t("syncNotifications.noLogs")
                : t("syncNotifications.noLogsFiltered")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredLogs.map((log) => (
                <SyncLogRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      </PanelBody>

      <PanelFooter>
        <Button
          variant="outline"
          className="h-10 flex-1 font-semibold text-danger hover:text-danger"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleteMutation.isPending || logs.length === 0}
        >
          <Trash2 className="size-4" />
          {t("syncNotifications.deleteAll")}
        </Button>
        {hasUnreadErrors ? (
          <Button
            className="h-10 flex-1 font-semibold"
            onClick={() => markReadMutation.mutate()}
            disabled={markReadMutation.isPending}
          >
            <CheckCheck className="size-4" />
            {t("syncNotifications.markAsRead")}
          </Button>
        ) : (
          <Button variant="outline" className="h-10 flex-1 font-semibold" onClick={onClose}>
            {t("common.close")}
          </Button>
        )}
      </PanelFooter>

      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          deleteMutation.mutate();
        }}
        title={t("syncNotifications.title") + " " + t("common.delete")}
        description={t("syncNotifications.deleteConfirm")}
        cancelText={t("common.cancel")}
        confirmText={t("common.delete")}
        confirmVariant="destructive"
      />
    </>
  );
}

function SyncLogRow({ log }: { log: SyncLog }) {
  const t = useTranslations();
  const locale = useLocale();
  const ok = log.status === "success";
  const auto = log.syncType === "auto";
  const TypeIcon = auto ? RefreshCw : User;
  const counts = [
    { count: log.shiftsCreated, label: t("common.createdCount", { count: log.shiftsCreated }), tone: "text-success" },
    { count: log.shiftsUpdated, label: t("common.updatedCount", { count: log.shiftsUpdated }), tone: "text-brand-ink" },
    { count: log.shiftsDeleted, label: t("common.deletedCount", { count: log.shiftsDeleted }), tone: "text-warning" },
  ];
  const changed = counts.some((c) => c.count > 0);

  return (
    <ListRow className={cn("items-start px-[13px]", log.isRead && !ok && "opacity-75")}>
      <span
        className={cn("mt-0.5 h-[34px] w-1 shrink-0 rounded-full", ok ? "bg-success" : "bg-danger")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg-strong">
            {log.externalSyncName}
          </span>
          {log.isRead && !ok && <Pill>{t("syncNotifications.read")}</Pill>}
          <Pill tone={ok ? "success" : "danger"}>
            {ok ? t("syncLog.statusSuccess") : t("syncNotifications.statusError")}
          </Pill>
        </div>
        <div className="mt-[3px] flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-fg-tertiary">
          <span className="font-mono">
            {new Intl.DateTimeFormat(locale, {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(log.syncedAt))}
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <TypeIcon className="size-3" />
            {auto ? t("syncNotifications.syncTypeAuto") : t("syncNotifications.syncTypeManual")}
          </span>
        </div>
        {ok ? (
          changed ? (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[12px] font-medium">
              {counts.map((c) => (
                <span key={c.label} className={c.count > 0 ? c.tone : "text-fg-faint"}>
                  {c.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-fg-tertiary">{t("syncNotifications.noChanges")}</p>
          )
        ) : (
          <p className="mt-2 break-words rounded-lg border border-danger-line bg-danger-surface px-2.5 py-2 text-[12.5px] leading-snug text-danger-body">
            {log.errorMessage || t("syncNotifications.statusError")}
          </p>
        )}
      </div>
    </ListRow>
  );
}

interface SyncNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string | null;
  onErrorsMarkedRead?: () => void;
}

export function SyncNotificationDialog({
  open,
  onOpenChange,
  calendarId,
  onErrorsMarkedRead,
}: SyncNotificationDialogProps) {
  const t = useTranslations();

  return (
    <PanelDialog
      bare
      open={open}
      onOpenChange={onOpenChange}
      title={t("syncNotifications.title")}
      description={t("syncLog.description")}
    >
      {calendarId && (
        <SyncNotificationsPanel
          calendarId={calendarId}
          onClose={() => onOpenChange(false)}
          onErrorsMarkedRead={onErrorsMarkedRead}
        />
      )}
    </PanelDialog>
  );
}
