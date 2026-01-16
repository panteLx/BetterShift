"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { REFETCH_INTERVAL } from "@/lib/query-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SyncLog } from "@/lib/db/schema";
import { queryKeys } from "@/lib/query-keys";
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  User,
  Trash2,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Fetch sync logs from API
 */
async function fetchSyncLogsApi(calendarId: string): Promise<SyncLog[]> {
  const params = new URLSearchParams({ calendarId, limit: "20" });
  const response = await fetch(`/api/sync-logs?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch sync logs");
  }

  return await response.json();
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
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "success" | "error">("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch sync logs with React Query polling
  const { data: logs = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.externalSyncs.logs(calendarId!),
    queryFn: () => fetchSyncLogsApi(calendarId!),
    enabled: !!calendarId && open,
    refetchInterval: REFETCH_INTERVAL,
    refetchIntervalInBackground: false, // Only poll when dialog is open
  });

  // Delete all logs mutation
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.externalSyncs.logs(calendarId!),
      });
      toast.success(
        t("common.deleted", { item: t("syncNotifications.title") })
      );
    },
    onError: () => {
      toast.error(
        t("common.deleteError", { item: t("syncNotifications.title") })
      );
    },
  });

  // Mark errors as read mutation
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.externalSyncs.logs(calendarId!),
      });
      toast.success(t("syncNotifications.markedAsRead"));
      onErrorsMarkedRead?.();
    },
    onError: () => {
      toast.error(
        t("common.updateError", { item: t("syncNotifications.title") })
      );
    },
  });

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const getStatusIcon = (status: string) => {
    if (status === "success") {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }
    return <XCircle className="h-5 w-5 text-red-600" />;
  };

  const getSyncTypeIcon = (syncType: string) => {
    if (syncType === "auto") {
      return <RefreshCw className="h-4 w-4" />;
    }
    return <User className="h-4 w-4" />;
  };

  const hasChanges = (log: SyncLog) => {
    return (
      log.shiftsCreated > 0 || log.shiftsUpdated > 0 || log.shiftsDeleted > 0
    );
  };

  const handleDeleteLogs = () => {
    setShowDeleteConfirm(false);
    deleteMutation.mutate();
  };

  const handleMarkErrorsAsRead = () => {
    markReadMutation.mutate();
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    return log.status === filter;
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
            <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {t("syncNotifications.title")}
            </DialogTitle>
          </DialogHeader>

          {/* Filter and Actions */}
          <div className="flex flex-wrap gap-2 items-center pb-4 border-b border-border/50 px-6 pt-6">
            <Select
              value={filter}
              onValueChange={(v: typeof filter) => setFilter(v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("syncNotifications.filterAll")}
                </SelectItem>
                <SelectItem value="success">
                  {t("syncNotifications.filterSuccess")}
                </SelectItem>
                <SelectItem value="error">
                  {t("syncNotifications.filterError")}
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2 ml-auto">
              {logs.some((log) => log.status === "error" && !log.isRead) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkErrorsAsRead}
                  disabled={markReadMutation.isPending}
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  {t("syncNotifications.markAsRead")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteMutation.isPending || logs.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("syncNotifications.deleteAll")}
              </Button>
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto flex-1 px-6 pb-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("common.loading")}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {logs.length === 0
                  ? t("syncNotifications.noLogs")
                  : t("syncNotifications.noLogsFiltered")}
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-accent/50 transition-colors"
                >
                  {/* Header with status and sync type */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {log.externalSyncName}
                          {log.isRead && log.status === "error" && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {t("syncNotifications.read")}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDateTime(log.syncedAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      {getSyncTypeIcon(log.syncType)}
                      <span>
                        {log.syncType === "auto"
                          ? t("syncNotifications.syncTypeAuto")
                          : t("syncNotifications.syncTypeManual")}
                      </span>
                    </div>
                  </div>

                  {/* Status and changes */}
                  {log.status === "success" ? (
                    <div>
                      {hasChanges(log) ? (
                        <div className="flex flex-wrap gap-3 text-sm">
                          {log.shiftsCreated > 0 && (
                            <div className="flex items-center gap-1.5 text-green-700">
                              <span className="font-medium">
                                {t("common.createdCount", {
                                  count: log.shiftsCreated,
                                })}
                              </span>
                            </div>
                          )}
                          {log.shiftsUpdated > 0 && (
                            <div className="flex items-center gap-1.5 text-blue-700">
                              <span className="font-medium">
                                {t("common.updatedCount", {
                                  count: log.shiftsUpdated,
                                })}
                              </span>
                            </div>
                          )}
                          {log.shiftsDeleted > 0 && (
                            <div className="flex items-center gap-1.5 text-orange-700">
                              <span className="font-medium">
                                {t("common.deletedCount", {
                                  count: log.shiftsDeleted,
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          {t("syncNotifications.noChanges")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-red-100 bg-red-950/90 p-3 rounded border border-red-800">
                      <div className="font-medium mb-1">
                        {t("syncNotifications.errorMessage")}:
                      </div>
                      <div className="text-red-200">{log.errorMessage}</div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDeleteLogs}
        title={t("syncNotifications.title") + " " + t("common.delete")}
        description={t("syncNotifications.deleteConfirm")}
        cancelText={t("common.cancel")}
        confirmText={t("common.delete")}
        confirmVariant="destructive"
      />
    </>
  );
}
