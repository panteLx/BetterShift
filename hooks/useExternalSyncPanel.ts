"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ExternalSync } from "@/lib/db/schema";
import { syncToFormValues, useExternalSyncForm } from "@/hooks/useExternalSyncForm";
import { useExternalSync } from "@/hooks/useExternalSync";
import { isRateLimitError, handleRateLimitError } from "@/lib/rate-limit-client";
import { isValidCalendarUrl, detectCalendarSyncType } from "@/lib/external-calendar-utils";
import { useGuardedAction, useReportDirty } from "@/hooks/useDirtyState";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

type PanelMode = { kind: "list" } | { kind: "add" } | { kind: "edit"; syncId: string };

interface UseExternalSyncPanelProps {
  calendarId: string;
  onSyncComplete?: () => void;
  /** Lets the surrounding frame guard its close button against unsaved changes */
  onDirtyChange?: (dirty: boolean) => void;
}

export function useExternalSyncPanel({
  calendarId,
  onSyncComplete,
  onDirtyChange,
}: UseExternalSyncPanelProps) {
  const t = useTranslations();
  const [mode, setMode] = useState<PanelMode>({ kind: "list" });
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { values, setField, reset, isDirty } = useExternalSyncForm();
  const itemLabel = t("externalSync.syncTypeCustom");

  const { externalSyncs: syncs, syncLogs, refetch: invalidateSyncs } = useExternalSync(calendarId);

  // Latest unread error per sync; marking logs as read clears it.
  const syncErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    for (const sync of syncs) {
      const latestError = syncLogs.find(
        (log) => log.externalSyncId === sync.id && log.status === "error" && !log.isRead
      );
      if (latestError) {
        errors[sync.id] = latestError.errorMessage || t("syncNotifications.statusError");
      }
    }
    return errors;
  }, [syncs, syncLogs, t]);

  const editingSync =
    mode.kind === "edit" ? syncs.find((sync) => sync.id === mode.syncId) ?? null : null;
  const formOpen = mode.kind === "add" || editingSync !== null;

  const hasUnsavedChanges = formOpen && isDirty;

  useReportDirty(hasUnsavedChanges, onDirtyChange);

  const showList = () => {
    setMode({ kind: "list" });
    reset();
  };

  const startAdd = () => {
    setMode({ kind: "add" });
    reset();
  };

  const startEdit = (sync: ExternalSync) => {
    setMode({ kind: "edit", syncId: sync.id });
    reset(syncToFormValues(sync));
  };

  /** Runs `action` right away, or after confirming that unsaved input may be dropped. */
  const { guarded: guardUnsaved, confirmProps } = useGuardedAction(hasUnsavedChanges);

  const handleSync = async (syncId: string) => {
    setIsSyncing(syncId);
    try {
      const response = await fetch(`/api/external-syncs/${syncId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (isRateLimitError(response)) {
        await handleRateLimitError(response, t);
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to sync calendar");
      }

      invalidateSyncs();
      onSyncComplete?.();

      const stats = data.stats || { created: 0, updated: 0, deleted: 0 };
      toast.success(
        `${t("common.success")}: ${t("common.createdCount", {
          count: stats.created,
        })}, ${t("common.updatedCount", {
          count: stats.updated,
        })}, ${t("common.deletedCount", { count: stats.deleted })}`
      );
    } catch (error) {
      console.error("Sync error:", error);
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setIsSyncing(null);
    }
  };

  const handleAdd = async () => {
    const name = values.name.trim();
    const url = values.url.trim();
    if (!name) return;

    if (values.importType === "file") {
      if (!values.file) {
        toast.error(t("validation.fileRequired"));
        return;
      }
      if (values.file.size > MAX_FILE_SIZE) {
        toast.error(t("validation.fileTooLarge", { maxSize: "5MB" }));
        return;
      }
    } else {
      if (!url) {
        toast.error(t("validation.urlRequired"));
        return;
      }
      if (!isValidCalendarUrl(url, detectCalendarSyncType(url))) {
        toast.error(t("validation.urlInvalid"));
        return;
      }
      // Uploaded files are stored as data URLs and never collide.
      const exists = syncs.some(
        (sync) => !sync.isOneTimeImport && sync.calendarUrl.toLowerCase() === url.toLowerCase()
      );
      if (exists) {
        toast.error(t("validation.urlAlreadyExists"));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const icsContent =
        values.importType === "file" && values.file ? await values.file.text() : undefined;

      const response = await fetch("/api/external-syncs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId,
          name,
          calendarUrl: url || undefined,
          color: values.color,
          displayMode: values.displayMode,
          autoSyncInterval: values.autoSyncInterval,
          icsContent,
          isHidden: values.isHidden,
          hideFromStats: values.hideFromStats,
        }),
      });

      if (response.ok) {
        const newSync = await response.json();
        showList();
        invalidateSyncs();
        onSyncComplete?.();
        toast.success(t("common.created", { item: itemLabel }));
        await handleSync(newSync.id);
      } else {
        const data = await response.json();
        toast.error(data.error || t("common.createError", { item: itemLabel }));
      }
    } catch (error) {
      console.error("Failed to create sync:", error);
      toast.error(t("common.createError", { item: itemLabel }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!editingSync) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/external-syncs/${editingSync.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          calendarUrl: !editingSync.isOneTimeImport ? values.url.trim() : undefined,
          color: values.color,
          displayMode: values.displayMode,
          autoSyncInterval: values.autoSyncInterval,
          isHidden: values.isHidden,
          hideFromStats: values.hideFromStats,
        }),
      });

      if (response.ok) {
        invalidateSyncs();
        onSyncComplete?.();
        showList();
        toast.success(t("common.updated", { item: itemLabel }));
      } else {
        const data = await response.json();
        toast.error(data.error || t("common.updateError", { item: itemLabel }));
      }
    } catch (error) {
      console.error("Failed to save sync:", error);
      toast.error(t("common.updateError", { item: itemLabel }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    const syncId = deleteTargetId;
    if (!syncId) return;

    setIsDeleting(syncId);
    try {
      const response = await fetch(`/api/external-syncs/${syncId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        if (mode.kind === "edit" && mode.syncId === syncId) showList();
        invalidateSyncs();
        onSyncComplete?.();
        toast.success(t("common.deleted", { item: itemLabel }));
      } else {
        const data = await response.json();
        toast.error(data.error || t("common.deleteError", { item: itemLabel }));
      }
    } catch (error) {
      console.error("Error deleting sync:", error);
      toast.error(t("common.deleteError", { item: itemLabel }));
    } finally {
      setIsDeleting(null);
      setDeleteTargetId(null);
    }
  };

  const busy = !!isSyncing || !!isDeleting;
  const canSubmit =
    !isSubmitting &&
    !!values.name.trim() &&
    (editingSync
      ? isDirty
      : values.importType === "file"
        ? !!values.file
        : !!values.url.trim());

  return {
    syncs,
    syncErrors,
    editingSync,
    formOpen,
    values,
    setField,
    isSubmitting,
    isSyncing,
    isDeleting,
    busy,
    canSubmit,
    deleteTargetId,
    setDeleteTargetId,
    showList,
    startAdd,
    startEdit,
    guardUnsaved,
    confirmProps,
    handleSync,
    handleAdd,
    handleSave,
    confirmDelete,
  };
}
