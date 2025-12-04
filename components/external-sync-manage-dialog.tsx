"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Loader2, Trash2, RefreshCw, Plus, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { PRESET_COLORS } from "@/lib/constants";
import {
  isValidCalendarUrl,
  type CalendarSyncType,
} from "@/lib/external-calendar-utils";

interface ExternalSyncManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string | null;
  onSyncComplete?: () => void;
}

export function ExternalSyncManageDialog({
  open,
  onOpenChange,
  calendarId,
  onSyncComplete,
}: ExternalSyncManageDialogProps) {
  const t = useTranslations();
  const [syncs, setSyncs] = useState<ExternalSync[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSync, setEditingSync] = useState<ExternalSync | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formSyncType, setFormSyncType] = useState("icloud");
  const [formColor, setFormColor] = useState("#3b82f6");
  const [formDisplayMode, setFormDisplayMode] = useState("normal");
  const [formAutoSyncInterval, setFormAutoSyncInterval] = useState(0);

  const fetchSyncs = useCallback(async () => {
    if (!calendarId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/external-syncs?calendarId=${calendarId}`
      );
      if (response.ok) {
        const data = await response.json();
        setSyncs(data);
      }
    } catch (error) {
      console.error("Failed to fetch syncs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [calendarId]);

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
      setFormSyncType("icloud");
      setFormColor("#3b82f6");
      setFormDisplayMode("normal");
      setFormAutoSyncInterval(0);
    }
  }, [open, calendarId, fetchSyncs]);

  const handleAddSync = async () => {
    if (!calendarId || !formName.trim() || !formUrl.trim()) return;

    // Validate calendar URL format
    if (!isValidCalendarUrl(formUrl.trim(), formSyncType as CalendarSyncType)) {
      toast.error(t("externalSync.invalidUrlFormat"));
      return;
    }

    // Check if URL already exists
    const normalizedUrl = formUrl.trim().toLowerCase();
    const urlExists = syncs.some(
      (sync) => sync.calendarUrl.toLowerCase() === normalizedUrl
    );

    if (urlExists) {
      toast.error(t("externalSync.urlAlreadyExists"));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/external-syncs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId,
          name: formName.trim(),
          calendarUrl: formUrl.trim(),
          syncType: formSyncType,
          color: formColor,
          displayMode: formDisplayMode,
          autoSyncInterval: formAutoSyncInterval,
        }),
      });

      if (response.ok) {
        const newSync = await response.json();
        setFormName("");
        setFormUrl("");
        setFormSyncType("icloud");
        setFormColor("#3b82f6");
        setFormDisplayMode("normal");
        setFormAutoSyncInterval(0);
        setShowAddForm(false);
        await fetchSyncs();
        onSyncComplete?.(); // Trigger refresh to update parent state
        toast.success(t("externalSync.createSuccess"));
        // Auto-sync the newly created sync
        await handleSync(newSync.id);
      } else {
        const data = await response.json();
        toast.error(data.error || t("externalSync.createError"));
      }
    } catch (error) {
      console.error("Failed to create sync:", error);
      toast.error(t("externalSync.createError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSync = async () => {
    if (!editingSync || !formName.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/external-syncs/${editingSync.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          icloudUrl: formUrl.trim() || undefined,
          color: formColor,
          displayMode: formDisplayMode,
          autoSyncInterval: formAutoSyncInterval,
        }),
      });

      if (response.ok) {
        setEditingSync(null);
        setFormName("");
        setFormUrl("");
        setFormSyncType("icloud");
        setFormColor("#3b82f6");
        setFormDisplayMode("normal");
        setFormAutoSyncInterval(0);
        await fetchSyncs();
        onSyncComplete?.(); // Trigger refresh of shifts and externalSyncs
        toast.success(t("externalSync.updateSuccess"));
      } else {
        const data = await response.json();
        toast.error(data.error || t("externalSync.updateError"));
      }
    } catch (error) {
      console.error("Failed to update sync:", error);
      toast.error(t("externalSync.updateError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async (syncId: string) => {
    setIsSyncing(syncId);
    try {
      const response = await fetch(`/api/external-syncs/${syncId}/sync`, {
        method: "POST",
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
      const response = await fetch(`/api/external-syncs/${syncId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchSyncs();
        onSyncComplete?.();
        toast.success(t("externalSync.deleteSuccess"));
      } else {
        const data = await response.json();
        toast.error(data.error || t("externalSync.deleteError"));
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(t("externalSync.deleteError"));
    } finally {
      setIsDeleting(null);
    }
  };

  const startEdit = (sync: ExternalSync) => {
    setEditingSync(sync);
    setFormName(sync.name);
    setFormUrl(sync.calendarUrl);
    setFormColor(sync.color);
    setFormDisplayMode(sync.displayMode || "normal");
    setFormAutoSyncInterval(sync.autoSyncInterval || 0);
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingSync(null);
    setFormName("");
    setFormUrl("");
    setFormSyncType("icloud");
    setFormColor("#3b82f6");
    setFormDisplayMode("normal");
    setFormAutoSyncInterval(0);
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
      const response = await fetch(`/api/external-syncs/${syncId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [field]: !currentValue,
        }),
      });

      if (response.ok) {
        await fetchSyncs();
        onSyncComplete?.(); // Trigger refresh
        toast.success(t("externalSync.updateSuccess"));
      } else {
        const data = await response.json();
        toast.error(data.error || t("externalSync.updateError"));

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
      toast.error(t("externalSync.updateError"));

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
    setFormSyncType("icloud");
    setFormColor("#3b82f6");
    setFormDisplayMode("normal");
    setFormAutoSyncInterval(0);
  };

  // Get URL placeholder and hint based on sync type
  const getUrlPlaceholder = () => {
    if (formSyncType === "google") {
      return t("externalSync.urlPlaceholderGoogle");
    }
    return t("externalSync.urlPlaceholderICloud");
  };

  const getUrlHint = () => {
    if (formSyncType === "google") {
      return t("externalSync.urlHintGoogle");
    }
    return t("externalSync.urlHintICloud");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          {/* Existing Syncs List */}
          {syncs.length > 0 && (
            <div className="space-y-3">
              {syncs.map((sync) => (
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
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border/50 font-normal">
                        {sync.syncType === "google"
                          ? t("externalSync.syncTypeGoogle")
                          : t("externalSync.syncTypeICloud")}
                      </span>
                      {sync.autoSyncInterval > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                          <RefreshCw className="h-3 w-3" />
                          {sync.autoSyncInterval < 60
                            ? `${sync.autoSyncInterval} min`
                            : sync.autoSyncInterval < 1440
                            ? `${sync.autoSyncInterval / 60} h`
                            : `${sync.autoSyncInterval / 1440} d`}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground text-xs font-medium">
                          {t("externalSync.autoSyncManual")}
                        </span>
                      )}
                      {sync.lastSyncedAt && (
                        <span className="text-xs text-muted-foreground">
                          {t("externalSync.lastSynced")}:{" "}
                          {new Date(sync.lastSyncedAt).toLocaleString()}
                        </span>
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
                </div>
              ))}
            </div>
          )}

          {/* Add/Edit Form */}
          {(showAddForm || editingSync) && (
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
              <h3 className="font-semibold">
                {editingSync
                  ? t("externalSync.editSync")
                  : t("externalSync.addSync")}
              </h3>

              <div className="space-y-2">
                <Label htmlFor="sync-name">{t("externalSync.nameLabel")}</Label>
                <Input
                  id="sync-name"
                  type="text"
                  placeholder={t("externalSync.namePlaceholder")}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {!editingSync && (
                <div className="space-y-2">
                  <Label htmlFor="sync-type">
                    {t("externalSync.syncTypeLabel")}
                  </Label>
                  <Select value={formSyncType} onValueChange={setFormSyncType}>
                    <SelectTrigger id="sync-type" className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="icloud">
                        {t("externalSync.syncTypeICloud")}
                      </SelectItem>
                      <SelectItem value="google">
                        {t("externalSync.syncTypeGoogle")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="sync-url">{t("externalSync.urlLabel")}</Label>
                <Input
                  id="sync-url"
                  type="text"
                  placeholder={getUrlPlaceholder()}
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  disabled={isLoading || !!editingSync}
                />
                {!editingSync && (
                  <p className="text-xs text-muted-foreground">
                    {getUrlHint()}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <ColorPicker
                  color={formColor}
                  onChange={setFormColor}
                  label={t("externalSync.colorLabel")}
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
                      const intervals = [0, 5, 15, 30, 60, 120, 360, 720, 1440];
                      const index = intervals.indexOf(formAutoSyncInterval);
                      return index >= 0 ? index : 0;
                    })(),
                  ]}
                  onValueChange={(value: number[]) => {
                    const intervals = [0, 5, 15, 30, 60, 120, 360, 720, 1440];
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

              {editingSync && (
                <div className="space-y-3 pt-2 border-t border-border/30">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hide-calendar"
                      checked={editingSync.isHidden || false}
                      onCheckedChange={() => {
                        handleToggleVisibility(
                          editingSync.id,
                          "isHidden",
                          editingSync.isHidden || false
                        );
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
                        editingSync.isHidden ||
                        editingSync.hideFromStats ||
                        false
                      }
                      onCheckedChange={() => {
                        handleToggleVisibility(
                          editingSync.id,
                          "hideFromStats",
                          editingSync.hideFromStats || false
                        );
                      }}
                      disabled={editingSync.isHidden}
                    />
                    <Label
                      htmlFor="hide-from-stats"
                      className={`text-sm font-normal ${
                        editingSync.isHidden
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
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (editingSync) {
                      cancelEdit();
                    } else {
                      setShowAddForm(false);
                      setFormName("");
                      setFormUrl("");
                      setFormSyncType("icloud");
                      setFormColor("#3b82f6");
                      setFormDisplayMode("normal");
                      setFormAutoSyncInterval(0);
                    }
                  }}
                  disabled={isLoading}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={editingSync ? handleUpdateSync : handleAddSync}
                  disabled={
                    isLoading ||
                    !formName.trim() ||
                    (!editingSync && !formUrl.trim())
                  }
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {editingSync ? t("common.save") : t("externalSync.addSync")}
                </Button>
              </div>
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

          {/* Instructions */}
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4">
            <div className="text-sm space-y-2">
              <div className="font-medium">
                {t(
                  formSyncType === "google"
                    ? "externalSync.howToTitleGoogle"
                    : "externalSync.howToTitleICloud"
                )}
              </div>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>
                  {t(
                    formSyncType === "google"
                      ? "externalSync.howToStep1Google"
                      : "externalSync.howToStep1ICloud"
                  )}
                </li>
                <li>
                  {t(
                    formSyncType === "google"
                      ? "externalSync.howToStep2Google"
                      : "externalSync.howToStep2ICloud"
                  )}
                </li>
                <li>
                  {t(
                    formSyncType === "google"
                      ? "externalSync.howToStep3Google"
                      : "externalSync.howToStep3ICloud"
                  )}
                </li>
                <li>
                  {t(
                    formSyncType === "google"
                      ? "externalSync.howToStep4Google"
                      : "externalSync.howToStep4ICloud"
                  )}
                </li>
              </ol>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
