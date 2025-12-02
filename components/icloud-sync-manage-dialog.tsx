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
import { ColorPicker } from "@/components/ui/color-picker";
import { useTranslations } from "next-intl";
import { ICloudSync } from "@/lib/db/schema";
import { Loader2, Trash2, RefreshCw, Plus, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { PRESET_COLORS } from "@/lib/constants";
import { isValidICloudUrl } from "@/lib/icloud-utils";

interface ICloudSyncManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string | null;
  onSyncComplete?: () => void;
}

export function ICloudSyncManageDialog({
  open,
  onOpenChange,
  calendarId,
  onSyncComplete,
}: ICloudSyncManageDialogProps) {
  const t = useTranslations();
  const [syncs, setSyncs] = useState<ICloudSync[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSync, setEditingSync] = useState<ICloudSync | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formColor, setFormColor] = useState("#3b82f6");

  const fetchSyncs = useCallback(async () => {
    if (!calendarId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/icloud-syncs?calendarId=${calendarId}`
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
      setFormColor("#3b82f6");
    }
  }, [open, calendarId, fetchSyncs]);

  const handleAddSync = async () => {
    if (!calendarId || !formName.trim() || !formUrl.trim()) return;

    // Validate iCloud URL format
    if (!isValidICloudUrl(formUrl.trim())) {
      toast.error(t("icloud.invalidUrlFormat"));
      return;
    }

    // Check if URL already exists
    const normalizedUrl = formUrl.trim().toLowerCase();
    const urlExists = syncs.some(
      (sync) => sync.icloudUrl.toLowerCase() === normalizedUrl
    );

    if (urlExists) {
      toast.error(t("icloud.urlAlreadyExists"));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/icloud-syncs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId,
          name: formName.trim(),
          icloudUrl: formUrl.trim(),
          color: formColor,
        }),
      });

      if (response.ok) {
        const newSync = await response.json();
        setFormName("");
        setFormUrl("");
        setFormColor("#3b82f6");
        setShowAddForm(false);
        await fetchSyncs();
        toast.success(t("icloud.createSuccess"));
        // Auto-sync the newly created sync
        await handleSync(newSync.id);
      } else {
        const data = await response.json();
        toast.error(data.error || t("icloud.createError"));
      }
    } catch (error) {
      console.error("Failed to create sync:", error);
      toast.error(t("icloud.createError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSync = async () => {
    if (!editingSync || !formName.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/icloud-syncs/${editingSync.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          icloudUrl: formUrl.trim() || undefined,
          color: formColor,
        }),
      });

      if (response.ok) {
        setEditingSync(null);
        setFormName("");
        setFormUrl("");
        setFormColor("#3b82f6");
        await fetchSyncs();
        onSyncComplete?.(); // Trigger refresh of shifts if color was updated
        toast.success(t("icloud.updateSuccess"));
      } else {
        const data = await response.json();
        toast.error(data.error || t("icloud.updateError"));
      }
    } catch (error) {
      console.error("Failed to update sync:", error);
      toast.error(t("icloud.updateError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async (syncId: string) => {
    setIsSyncing(syncId);
    try {
      const response = await fetch(`/api/icloud-syncs/${syncId}/sync`, {
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
        `${t("icloud.syncSuccess")}: ${stats.created} ${t(
          "icloud.statsCreated"
        )}, ${stats.updated} ${t("icloud.statsUpdated")}, ${stats.deleted} ${t(
          "icloud.statsDeleted"
        )}`
      );
    } catch (error) {
      console.error("Sync error:", error);
      toast.error(
        error instanceof Error ? error.message : t("icloud.syncError")
      );
    } finally {
      setIsSyncing(null);
    }
  };

  const handleDelete = async (syncId: string) => {
    if (!confirm(t("icloud.deleteConfirm"))) return;

    setIsDeleting(syncId);
    try {
      const response = await fetch(`/api/icloud-syncs/${syncId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchSyncs();
        onSyncComplete?.();
        toast.success(t("icloud.deleteSuccess"));
      } else {
        const data = await response.json();
        toast.error(data.error || t("icloud.deleteError"));
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(t("icloud.deleteError"));
    } finally {
      setIsDeleting(null);
    }
  };

  const startEdit = (sync: ICloudSync) => {
    setEditingSync(sync);
    setFormName(sync.name);
    setFormUrl(sync.icloudUrl);
    setFormColor(sync.color);
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingSync(null);
    setFormName("");
    setFormUrl("");
    setFormColor("#3b82f6");
  };

  const startAdd = () => {
    setShowAddForm(true);
    setEditingSync(null);
    setFormName("");
    setFormUrl("");
    setFormColor("#3b82f6");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {t("icloud.manageTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("icloud.manageDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto flex-1 p-6">
          {/* Existing Syncs List */}
          {syncs.length > 0 && (
            <div className="space-y-3">
              {syncs.map((sync) => (
                <div
                  key={sync.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-all"
                  style={{ borderLeftColor: sync.color, borderLeftWidth: 4 }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold flex items-center gap-2">
                      <div
                        className="w-1 h-4 rounded-full"
                        style={{ backgroundColor: sync.color }}
                      />
                      <span className="truncate">{sync.name}</span>
                    </div>
                    {sync.lastSyncedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("icloud.lastSynced")}:{" "}
                        {new Date(sync.lastSyncedAt).toLocaleString()}
                      </p>
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
              ))}
            </div>
          )}

          {/* Add/Edit Form */}
          {(showAddForm || editingSync) && (
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
              <h3 className="font-semibold">
                {editingSync ? t("icloud.editSync") : t("icloud.addSync")}
              </h3>

              <div className="space-y-2">
                <Label htmlFor="sync-name">{t("icloud.nameLabel")}</Label>
                <Input
                  id="sync-name"
                  type="text"
                  placeholder={t("icloud.namePlaceholder")}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sync-url">{t("icloud.urlLabel")}</Label>
                <Input
                  id="sync-url"
                  type="text"
                  placeholder={t("icloud.urlPlaceholder")}
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  disabled={isLoading || !!editingSync}
                />
                {!editingSync && (
                  <p className="text-xs text-muted-foreground">
                    {t("icloud.urlHint")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <ColorPicker
                  color={formColor}
                  onChange={setFormColor}
                  label={t("icloud.colorLabel")}
                  presetColors={PRESET_COLORS}
                />
                <p className="text-xs text-muted-foreground">
                  {t("icloud.colorHint")}
                </p>
              </div>

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
                      setFormColor("#3b82f6");
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
                  {editingSync ? t("common.save") : t("icloud.addSync")}
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
              {t("icloud.addNewSync")}
            </Button>
          )}

          {/* Instructions */}
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4">
            <div className="text-sm space-y-2">
              <div className="font-medium">{t("icloud.howToTitle")}</div>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>{t("icloud.howToStep1")}</li>
                <li>{t("icloud.howToStep2")}</li>
                <li>{t("icloud.howToStep3")}</li>
                <li>{t("icloud.howToStep4")}</li>
              </ol>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
