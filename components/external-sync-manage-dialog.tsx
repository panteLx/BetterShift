"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorPicker } from "@/components/ui/color-picker";
import { Slider } from "@/components/ui/slider";
import { useTranslations } from "next-intl";
import { ExternalSync } from "@/lib/db/schema";
import {
  Loader2,
  Trash2,
  RefreshCw,
  Plus,
  Edit2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { PRESET_COLORS } from "@/lib/constants";
import { getCachedPassword } from "@/lib/password-cache";
import {
  isValidCalendarUrl,
  detectCalendarSyncType,
  type CalendarSyncType,
} from "@/lib/external-calendar-utils";

interface ExternalSyncManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string | null;
  onSyncComplete?: () => void;
  syncErrorRefreshTrigger?: number;
}

export function ExternalSyncManageDialog({
  open,
  onOpenChange,
  calendarId,
  onSyncComplete,
  syncErrorRefreshTrigger,
}: ExternalSyncManageDialogProps) {
  const t = useTranslations();
  const [syncs, setSyncs] = useState<ExternalSync[]>([]);
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSync, setEditingSync] = useState<ExternalSync | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formColor, setFormColor] = useState("#3b82f6");
  const [formDisplayMode, setFormDisplayMode] = useState("normal");
  const [formAutoSyncInterval, setFormAutoSyncInterval] = useState(0);
  const [icsFile, setIcsFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"url" | "file">("url");
  const [formIsHidden, setFormIsHidden] = useState(false);
  const [formHideFromStats, setFormHideFromStats] = useState(false);
  const [expandedHint, setExpandedHint] = useState<CalendarSyncType | null>(
    null
  );

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialFormDataRef = useRef<{
    name: string;
    url: string;
    color: string;
    displayMode: string;
    autoSyncInterval: number;
  } | null>(null);
  const isInitialMount = useRef(true);

  const fetchSyncs = useCallback(
    async (showLoadingState = true) => {
      if (!calendarId) return;

      if (showLoadingState) {
        setIsLoading(true);
      }
      try {
        const password = getCachedPassword(calendarId);
        const params = new URLSearchParams({ calendarId });
        if (password) {
          params.append("password", password);
        }

        const response = await fetch(`/api/external-syncs?${params}`);
        if (response.ok) {
          const data = await response.json();
          setSyncs(data);

          // Fetch last sync logs to check for errors
          const logsParams = new URLSearchParams({ calendarId, limit: "50" });
          if (password) {
            logsParams.append("password", password);
          }

          const logsResponse = await fetch(`/api/sync-logs?${logsParams}`);
          if (logsResponse.ok) {
            const logs = await logsResponse.json();
            const errors: Record<string, string> = {};

            // Get the latest error for each external sync
            data.forEach((sync: ExternalSync) => {
              const syncLogs = logs.filter(
                (log: any) => log.externalSyncId === sync.id
              );
              // Only show unread errors
              const latestError = syncLogs.find(
                (log: any) => log.status === "error" && !log.isRead
              );
              if (latestError) {
                errors[sync.id] =
                  latestError.errorMessage ||
                  t("syncNotifications.statusError");
              }
            });

            setSyncErrors(errors);
          }
        }
      } catch (error) {
        console.error("Failed to fetch syncs:", error);
      } finally {
        if (showLoadingState) {
          setIsLoading(false);
        }
      }
    },
    [calendarId, t]
  );

  // Silent refresh for sync error updates (triggered by SSE)
  useEffect(() => {
    if (
      open &&
      calendarId &&
      syncErrorRefreshTrigger &&
      syncErrorRefreshTrigger > 0
    ) {
      // Silently refresh sync errors without loading state
      fetchSyncs(false);
    }
  }, [syncErrorRefreshTrigger, open, calendarId, fetchSyncs]);

  // Load syncs when dialog opens, reset state when it closes
  useEffect(() => {
    if (open && calendarId) {
      fetchSyncs();
    } else {
      // Reset all internal state when dialog closes or calendarId becomes falsy
      setSyncs([]);
      setIsLoading(false);
      setIsSyncing(null);
      setIsDeleting(null);
      setShowAddForm(false);
      setEditingSync(null);
      setFormName("");
      setFormUrl("");
      setFormColor("#3b82f6");
      setFormDisplayMode("normal");
      setFormAutoSyncInterval(0);
      setIcsFile(null);
      setImportType("url");
      setFormIsHidden(false);
      setFormHideFromStats(false);
    }
  }, [open, calendarId, fetchSyncs]);

  const handleAddSync = async () => {
    if (!calendarId || !formName.trim()) return;

    // For file upload
    if (importType === "file") {
      if (!icsFile) {
        toast.error(t("validation.fileRequired"));
        return;
      }
    } else {
      // For URL-based imports
      if (!formUrl.trim()) {
        toast.error(t("validation.urlRequired"));
        return;
      }

      // Detect and validate calendar URL format
      const detectedType = detectCalendarSyncType(formUrl.trim());
      if (!isValidCalendarUrl(formUrl.trim(), detectedType)) {
        toast.error(t("validation.urlInvalid"));
        return;
      }

      // Check if URL already exists (only for URL-based imports, not file uploads)
      const normalizedUrl = formUrl.trim().toLowerCase();
      const urlExists = syncs.some(
        (sync) =>
          !sync.isOneTimeImport &&
          sync.calendarUrl.toLowerCase() === normalizedUrl
      );

      if (urlExists) {
        toast.error(t("validation.urlAlreadyExists"));
        return;
      }
    }

    setIsLoading(true);
    try {
      let icsContent: string | undefined;

      // Read file content if file upload
      if (importType === "file" && icsFile) {
        // Check file size (limit: 5MB)
        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
        if (icsFile.size > MAX_FILE_SIZE) {
          toast.error(t("validation.fileTooLarge", { maxSize: "5MB" }));
          setIsLoading(false);
          return;
        }
        icsContent = await icsFile.text();
      }

      const password = getCachedPassword(calendarId);

      const response = await fetch("/api/external-syncs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId,
          name: formName.trim(),
          calendarUrl: formUrl.trim() || undefined,
          color: formColor,
          displayMode: formDisplayMode,
          autoSyncInterval: formAutoSyncInterval,
          icsContent,
          isHidden: formIsHidden,
          hideFromStats: formHideFromStats,
          password,
        }),
      });

      if (response.ok) {
        const newSync = await response.json();
        setFormName("");
        setFormUrl("");
        setFormColor("#3b82f6");
        setFormDisplayMode("normal");
        setFormAutoSyncInterval(0);
        setIcsFile(null);
        setImportType("url");
        setFormIsHidden(false);
        setFormHideFromStats(false);
        setShowAddForm(false);
        await fetchSyncs();
        onSyncComplete?.(); // Trigger refresh to update parent state
        toast.success(
          t("common.created", { item: t("externalSync.syncTypeCustom") })
        );
        // Auto-sync the newly created sync
        await handleSync(newSync.id);
      } else {
        const data = await response.json();
        toast.error(
          data.error ||
            t("common.createError", { item: t("externalSync.syncTypeCustom") })
        );
      }
    } catch (error) {
      console.error("Failed to create sync:", error);
      toast.error(
        t("common.createError", { item: t("externalSync.syncTypeCustom") })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSync = async () => {
    if (!editingSync || !formName.trim()) return;

    setIsLoading(true);
    try {
      const password = getCachedPassword(calendarId);

      const response = await fetch(`/api/external-syncs/${editingSync.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          calendarUrl: formUrl.trim() || undefined,
          color: formColor,
          displayMode: formDisplayMode,
          autoSyncInterval: formAutoSyncInterval,
          password,
        }),
      });

      if (response.ok) {
        setEditingSync(null);
        setFormName("");
        setFormUrl("");
        setFormColor("#3b82f6");
        setFormDisplayMode("normal");
        setFormAutoSyncInterval(0);
        await fetchSyncs();
        onSyncComplete?.(); // Trigger refresh of shifts and externalSyncs
        toast.success(
          t("common.updated", { item: t("externalSync.syncTypeCustom") })
        );
      } else {
        const data = await response.json();
        toast.error(
          data.error ||
            t("common.updateError", { item: t("externalSync.syncTypeCustom") })
        );
      }
    } catch (error) {
      console.error("Failed to update sync:", error);
      toast.error(
        t("common.updateError", { item: t("externalSync.syncTypeCustom") })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async (syncId: string) => {
    setIsSyncing(syncId);
    try {
      const password = getCachedPassword(calendarId);

      const response = await fetch(`/api/external-syncs/${syncId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync calendar");
      }

      await fetchSyncs();
      onSyncComplete?.();

      // Show sync statistics
      const stats = data.stats || { created: 0, updated: 0, deleted: 0 };
      toast.success(
        `${t("externalSync.syncSuccess")}: ${stats.created} ${t(
          "externalSync.statsCreated"
        )}, ${stats.updated} ${t("externalSync.statsUpdated")}, ${
          stats.deleted
        } ${t("externalSync.statsDeleted")}`
      );
    } catch (error) {
      console.error("Sync error:", error);
      toast.error(
        error instanceof Error ? error.message : t("externalSync.syncError")
      );
    } finally {
      setIsSyncing(null);
    }
  };

  const handleDelete = async (syncId: string) => {
    if (!confirm(t("externalSync.deleteConfirm"))) return;

    setIsDeleting(syncId);
    try {
      const password = getCachedPassword(calendarId);

      const response = await fetch(`/api/external-syncs/${syncId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        await fetchSyncs();
        onSyncComplete?.();
        toast.success(
          t("common.deleted", { item: t("externalSync.syncTypeCustom") })
        );
      } else {
        const data = await response.json();
        toast.error(
          data.error ||
            t("common.deleteError", { item: t("externalSync.syncTypeCustom") })
        );
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(
        t("common.deleteError", { item: t("externalSync.syncTypeCustom") })
      );
    } finally {
      setIsDeleting(null);
    }
  };

  const startEdit = (sync: ExternalSync) => {
    setEditingSync(sync);
    setFormName(sync.name || "");
    setFormUrl(sync.calendarUrl || "");
    setFormColor(sync.color || "#3b82f6");
    setFormDisplayMode(sync.displayMode || "normal");
    setFormAutoSyncInterval(sync.autoSyncInterval || 0);
    setFormIsHidden(sync.isHidden || false);
    setFormHideFromStats(sync.hideFromStats || false);
    setShowAddForm(false);

    // Set initial data for auto-save comparison
    initialFormDataRef.current = {
      name: sync.name || "",
      url: sync.calendarUrl || "",
      color: sync.color || "#3b82f6",
      displayMode: sync.displayMode || "normal",
      autoSyncInterval: sync.autoSyncInterval || 0,
    };
    isInitialMount.current = true;
  };

  const cancelEdit = () => {
    setEditingSync(null);
    setFormName("");
    setFormUrl("");
    setFormColor("#3b82f6");
    setFormDisplayMode("normal");
    setFormAutoSyncInterval(0);
    initialFormDataRef.current = null;

    // Clear any pending save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  };

  const handleToggleVisibility = async (
    syncId: string,
    field: "isHidden" | "hideFromStats",
    currentValue: boolean
  ) => {
    // Optimistically update local editingSync state for immediate UI feedback
    if (editingSync && editingSync.id === syncId) {
      setEditingSync({
        ...editingSync,
        [field]: !currentValue,
      });
    }

    try {
      const password = getCachedPassword(calendarId);

      const response = await fetch(`/api/external-syncs/${syncId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [field]: !currentValue,
          password,
        }),
      });

      if (response.ok) {
        await fetchSyncs();
        onSyncComplete?.(); // Trigger refresh
        toast.success(
          t("common.updated", { item: t("externalSync.syncTypeCustom") })
        );
      } else {
        const data = await response.json();
        toast.error(
          data.error ||
            t("common.updateError", { item: t("externalSync.syncTypeCustom") })
        );

        // Revert optimistic update on error
        if (editingSync && editingSync.id === syncId) {
          setEditingSync({
            ...editingSync,
            [field]: currentValue,
          });
        }
      }
    } catch (error) {
      console.error("Failed to update visibility:", error);
      toast.error(
        t("common.updateError", { item: t("externalSync.syncTypeCustom") })
      );

      // Revert optimistic update on error
      if (editingSync && editingSync.id === syncId) {
        setEditingSync({
          ...editingSync,
          [field]: currentValue,
        });
      }
    }
  };

  const startAdd = () => {
    setShowAddForm(true);
    setEditingSync(null);
    setFormName("");
    setFormUrl("");
    setFormColor("#3b82f6");
    setFormDisplayMode("normal");
    setFormAutoSyncInterval(0);
    setIcsFile(null);
    setImportType("url");
    setFormIsHidden(false);
    setFormHideFromStats(false);
  };

  // Shared function to save external sync changes
  const saveExternalSyncChanges = useCallback(
    async (updateInitialRef: boolean = false): Promise<boolean> => {
      if (!editingSync) return false;

      try {
        const password = getCachedPassword(calendarId);

        const response = await fetch(`/api/external-syncs/${editingSync.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            calendarUrl: !editingSync.isOneTimeImport
              ? formUrl.trim()
              : undefined,
            color: formColor,
            displayMode: formDisplayMode,
            autoSyncInterval: formAutoSyncInterval,
            password,
          }),
        });

        if (response.ok) {
          await fetchSyncs();
          onSyncComplete?.();
          if (updateInitialRef) {
            // Update initial data ref after successful save
            initialFormDataRef.current = {
              name: formName,
              url: formUrl,
              color: formColor,
              displayMode: formDisplayMode,
              autoSyncInterval: formAutoSyncInterval,
            };
          }
          toast.success(
            t("common.updated", { item: t("externalSync.syncTypeCustom") })
          );
          return true;
        } else {
          const data = await response.json();
          toast.error(
            data.error ||
              t("common.updateError", {
                item: t("externalSync.syncTypeCustom"),
              })
          );
          return false;
        }
      } catch (error) {
        console.error("Failed to save sync:", error);
        toast.error(
          t("common.updateError", { item: t("externalSync.syncTypeCustom") })
        );
        return false;
      }
    },
    [
      editingSync,
      formName,
      formUrl,
      formColor,
      formDisplayMode,
      formAutoSyncInterval,
      fetchSyncs,
      onSyncComplete,
      t,
    ]
  );

  // Auto-save for editing external syncs
  useEffect(() => {
    if (!editingSync || !initialFormDataRef.current) return;

    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Check if data has changed
    const currentFormData = {
      name: formName,
      url: formUrl,
      color: formColor,
      displayMode: formDisplayMode,
      autoSyncInterval: formAutoSyncInterval,
    };

    const hasChanged =
      JSON.stringify(currentFormData) !==
      JSON.stringify(initialFormDataRef.current);

    if (hasChanged && formName.trim()) {
      saveTimeoutRef.current = setTimeout(() => {
        saveExternalSyncChanges(true);
      }, 1000); // 1 second debounce
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    formName,
    formUrl,
    formColor,
    formDisplayMode,
    formAutoSyncInterval,
    editingSync,
    saveExternalSyncChanges,
  ]);

  // Handle dialog close with immediate save if needed
  const handleDialogClose = async (open: boolean) => {
    // If opening the dialog, proceed immediately
    if (open) {
      onOpenChange(open);
      return;
    }

    // If closing and editing an existing sync, check for unsaved changes
    if (editingSync && initialFormDataRef.current) {
      // Cancel pending timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      // Check if data has changed
      const currentFormData = {
        name: formName,
        url: formUrl,
        color: formColor,
        displayMode: formDisplayMode,
        autoSyncInterval: formAutoSyncInterval,
      };

      const hasChanged =
        JSON.stringify(currentFormData) !==
        JSON.stringify(initialFormDataRef.current);

      // Save immediately if data changed and name is not empty
      if (hasChanged && formName.trim()) {
        const success = await saveExternalSyncChanges(false);
        if (!success) {
          // Failed to save, keep dialog open
          return;
        }
        // Save succeeded, proceed to close
      }
    }

    // Close the dialog (only reached after successful save or no changes)
    onOpenChange(false);
  };

  // Get URL placeholder - show generic placeholder for all
  const getUrlPlaceholder = () => {
    return t("form.urlPlaceholder");
  };

  const getUrlHint = () => {
    if (!editingSync) {
      // When creating new calendar, show custom hint
      return t("externalSync.urlHintCustom");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-[600px] max-w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {t("externalSync.manageTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("externalSync.manageDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto flex-1 p-6">
          {/* Existing Syncs List - hide when adding new sync, show only edited sync when editing */}
          {syncs.length > 0 && !showAddForm && (
            <div className="space-y-3">
              {syncs
                .filter((sync) => !editingSync || sync.id === editingSync.id)
                .map((sync) => (
                  <div
                    key={sync.id}
                    className="flex flex-col gap-3 p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-all"
                    style={{ borderLeftColor: sync.color, borderLeftWidth: 4 }}
                  >
                    {/* Title row - always full width on mobile */}
                    <div className="flex items-start gap-2">
                      <div
                        className="w-1 h-4 rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: sync.color }}
                      />
                      <span className="font-semibold flex-1 min-w-0 break-words">
                        {sync.name}
                      </span>
                    </div>

                    {/* Badges and buttons row */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium">
                          {sync.syncType === "google"
                            ? t("externalSync.syncTypeGoogle")
                            : sync.syncType === "custom"
                            ? t("externalSync.syncTypeCustom")
                            : t("externalSync.syncTypeICloud")}
                        </span>
                        {sync.isOneTimeImport && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
                            {t("externalSync.oneTimeImport")}
                          </span>
                        )}
                        {!sync.isOneTimeImport && sync.autoSyncInterval > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 text-xs font-medium">
                            <RefreshCw className="h-3 w-3" />
                            {sync.autoSyncInterval < 60
                              ? `${sync.autoSyncInterval} min`
                              : sync.autoSyncInterval < 1440
                              ? `${sync.autoSyncInterval / 60} h`
                              : `${sync.autoSyncInterval / 1440} d`}
                          </span>
                        ) : (
                          !sync.isOneTimeImport && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 text-xs font-medium">
                              {t("externalSync.autoSyncManual")}
                            </span>
                          )
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startEdit(sync)}
                          disabled={!!isSyncing || !!isDeleting}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {!sync.isOneTimeImport && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleSync(sync.id)}
                            disabled={!!isSyncing || !!isDeleting}
                          >
                            {isSyncing === sync.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(sync.id)}
                          disabled={!!isSyncing || !!isDeleting}
                        >
                          {isDeleting === sync.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Last synced info and errors - always below badges */}
                    {(sync.lastSyncedAt || syncErrors[sync.id]) && (
                      <div className="pt-1 border-t border-border/30 space-y-1.5">
                        {sync.lastSyncedAt && (
                          <div className="text-xs text-muted-foreground">
                            {t("externalSync.lastSynced")}:{" "}
                            {new Date(sync.lastSyncedAt).toLocaleString()}
                          </div>
                        )}
                        {syncErrors[sync.id] && (
                          <div className="text-xs text-red-100 bg-red-950/90 p-2 rounded border border-red-800">
                            <div className="font-medium mb-0.5">
                              {t("syncNotifications.errorMessage")}:
                            </div>
                            <div className="text-red-200">
                              {syncErrors[sync.id]}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Add/Edit Form */}
          {(showAddForm || editingSync) && (
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
              <h3 className="font-semibold">
                {editingSync ? t("externalSync.editSync") : t("common.add")}
              </h3>

              <div className="space-y-2">
                <Label htmlFor="sync-name">{t("form.nameLabel")}</Label>
                <Input
                  id="sync-name"
                  type="text"
                  placeholder={t("form.namePlaceholder", {
                    example: t("externalSync.syncTypeCustom"),
                  })}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {!editingSync && (
                <div className="space-y-2">
                  <Label htmlFor="import-type">
                    {t("externalSync.importMethod")}
                  </Label>
                  <Select
                    value={importType}
                    onValueChange={(value: "url" | "file") => {
                      setImportType(value);
                      setFormUrl("");
                      setIcsFile(null);
                    }}
                  >
                    <SelectTrigger
                      id="import-type"
                      className="bg-background/50"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="url">
                        {t("externalSync.importMethodUrl")}
                      </SelectItem>
                      <SelectItem value="file">
                        {t("externalSync.importMethodFile")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {importType === "url"
                      ? t("externalSync.importMethodUrlHint")
                      : t("externalSync.importMethodFileHint")}
                  </p>
                </div>
              )}

              {!editingSync && importType === "file" ? (
                <div className="space-y-2">
                  <Label htmlFor="ics-file">
                    {t("externalSync.fileLabel")}
                  </Label>
                  <Input
                    id="ics-file"
                    type="file"
                    accept=".ics,.ical"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setIcsFile(file || null);
                    }}
                    disabled={isLoading}
                    className="cursor-pointer"
                    value=""
                  />
                  {icsFile && (
                    <p className="text-xs text-muted-foreground">
                      {t("externalSync.fileSelected")}: {icsFile.name}
                    </p>
                  )}
                </div>
              ) : (
                // Show URL input for new syncs OR when editing non-one-time-import syncs
                (!editingSync || !editingSync.isOneTimeImport) && (
                  <div className="space-y-2">
                    <Label htmlFor="sync-url">{t("form.urlLabel")}</Label>
                    <Input
                      id="sync-url"
                      type="text"
                      placeholder={getUrlPlaceholder()}
                      value={formUrl || ""}
                      onChange={(e) => setFormUrl(e.target.value)}
                      disabled={isLoading}
                      readOnly={!!editingSync}
                      className={
                        editingSync
                          ? "bg-muted/30 cursor-default font-mono text-sm"
                          : ""
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {getUrlHint()}
                    </p>
                  </div>
                )
              )}

              <div className="space-y-2">
                <ColorPicker
                  color={formColor}
                  onChange={setFormColor}
                  label={t("form.colorLabel")}
                  presetColors={PRESET_COLORS}
                />
                <p className="text-xs text-muted-foreground">
                  {t("externalSync.colorHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sync-display-mode">
                  {t("externalSync.displayMode")}
                </Label>
                <Select
                  value={formDisplayMode}
                  onValueChange={setFormDisplayMode}
                >
                  <SelectTrigger
                    id="sync-display-mode"
                    className="bg-background/50"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">
                      {t("externalSync.displayModeNormal")}
                    </SelectItem>
                    <SelectItem value="minimal">
                      {t("externalSync.displayModeMinimal")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("externalSync.displayModeHint")}
                </p>
              </div>

              {/* Only show auto-sync for URL-based imports (both creating and editing) */}
              {!(importType === "file") &&
                !(editingSync && editingSync.isOneTimeImport) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>{t("externalSync.autoSyncLabel")}</Label>
                      <span className="text-sm font-medium text-primary">
                        {formAutoSyncInterval === 0
                          ? t("externalSync.autoSyncManual")
                          : formAutoSyncInterval < 60
                          ? `${formAutoSyncInterval} min`
                          : formAutoSyncInterval < 1440
                          ? `${formAutoSyncInterval / 60} h`
                          : `${formAutoSyncInterval / 1440} d`}
                      </span>
                    </div>
                    <Slider
                      value={[
                        (() => {
                          const intervals = [
                            0, 5, 15, 30, 60, 120, 360, 720, 1440,
                          ];
                          const index = intervals.indexOf(formAutoSyncInterval);
                          return index >= 0 ? index : 0;
                        })(),
                      ]}
                      onValueChange={(value: number[]) => {
                        const intervals = [
                          0, 5, 15, 30, 60, 120, 360, 720, 1440,
                        ];
                        setFormAutoSyncInterval(intervals[value[0]]);
                      }}
                      max={8}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("externalSync.autoSyncManual")}</span>
                      <span>{t("externalSync.autoSync24hShort")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("externalSync.autoSyncHint")}
                    </p>
                  </div>
                )}

              {/* Visibility options - both for creating and editing */}
              <div className="space-y-3 pt-2 border-t border-border/30">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hide-calendar"
                    checked={
                      editingSync ? editingSync.isHidden || false : formIsHidden
                    }
                    onCheckedChange={(checked) => {
                      if (editingSync) {
                        handleToggleVisibility(
                          editingSync.id,
                          "isHidden",
                          editingSync.isHidden || false
                        );
                      } else {
                        setFormIsHidden(checked as boolean);
                      }
                    }}
                  />
                  <Label
                    htmlFor="hide-calendar"
                    className="text-sm font-normal cursor-pointer"
                  >
                    {t("externalSync.hideCalendar")}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  {t("externalSync.hideCalendarHint")}
                </p>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hide-from-stats"
                    checked={
                      editingSync
                        ? editingSync.isHidden ||
                          editingSync.hideFromStats ||
                          false
                        : formIsHidden || formHideFromStats
                    }
                    onCheckedChange={(checked) => {
                      if (editingSync) {
                        handleToggleVisibility(
                          editingSync.id,
                          "hideFromStats",
                          editingSync.hideFromStats || false
                        );
                      } else {
                        setFormHideFromStats(checked as boolean);
                      }
                    }}
                    disabled={editingSync ? editingSync.isHidden : formIsHidden}
                  />
                  <Label
                    htmlFor="hide-from-stats"
                    className={`text-sm font-normal ${
                      (editingSync ? editingSync.isHidden : formIsHidden)
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer"
                    }`}
                  >
                    {t("externalSync.hideFromStats")}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  {t("externalSync.hideFromStatsHint")}
                </p>
              </div>

              {editingSync ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => cancelEdit()}
                    className="flex-1"
                  >
                    {t("common.close")}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      setFormName("");
                      setFormUrl("");
                      setFormColor("#3b82f6");
                      setFormDisplayMode("normal");
                      setFormAutoSyncInterval(0);
                      setIcsFile(null);
                      setImportType("url");
                      setFormIsHidden(false);
                      setFormHideFromStats(false);
                    }}
                    disabled={isLoading}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    onClick={handleAddSync}
                    disabled={
                      isLoading ||
                      !formName.trim() ||
                      (importType === "file" ? !icsFile : !formUrl.trim())
                    }
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {t("common.add")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Add Button */}
          {!showAddForm && !editingSync && (
            <Button
              onClick={startAdd}
              className="w-full h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25"
              disabled={!!isSyncing || !!isDeleting}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("externalSync.addNewSync")}
            </Button>
          )}

          {/* Hints Section - show only when creating */}
          {showAddForm && (
            <div className="rounded-xl border border-border/50 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-foreground/90">
                {t("externalSync.hintsTitle")}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t("externalSync.hintsDescription")}
              </p>

              {/* iCloud Hint */}
              <div className="border border-border/50 rounded-lg overflow-hidden bg-background/50">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedHint(expandedHint === "icloud" ? null : "icloud")
                  }
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium">
                    {t("externalSync.syncTypeICloud")}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      expandedHint === "icloud" ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expandedHint === "icloud" && (
                  <div className="px-3 pb-3 text-sm text-muted-foreground space-y-1">
                    <p>{t("externalSync.hintICloud")}</p>
                  </div>
                )}
              </div>

              {/* Google Hint */}
              <div className="border border-border/50 rounded-lg overflow-hidden bg-background/50">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedHint(expandedHint === "google" ? null : "google")
                  }
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium">
                    {t("externalSync.syncTypeGoogle")}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      expandedHint === "google" ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expandedHint === "google" && (
                  <div className="px-3 pb-3 text-sm text-muted-foreground space-y-1">
                    <p>{t("externalSync.hintGoogle")}</p>
                  </div>
                )}
              </div>

              {/* Custom Calendar Hint */}
              <div className="border border-border/50 rounded-lg overflow-hidden bg-background/50">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedHint(expandedHint === "custom" ? null : "custom")
                  }
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium">
                    {t("externalSync.customCalendar")}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      expandedHint === "custom" ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expandedHint === "custom" && (
                  <div className="px-3 pb-3 text-sm text-muted-foreground space-y-1">
                    <p>{t("externalSync.hintCustom")}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
