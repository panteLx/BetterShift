"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { toast } from "sonner";

interface AuditLogDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLogIds?: string[];
  onSuccess?: () => void;
}

export function AuditLogDeleteDialog({
  open,
  onOpenChange,
  selectedLogIds = [],
  onSuccess,
}: AuditLogDeleteDialogProps) {
  const t = useTranslations();
  const { deleteLogsByDate, deleteLogsByIds, isLoading } = useAuditLogs();

  const [beforeDate, setBeforeDate] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // Determine mode: by IDs (if provided) or by date
  const deleteByIds = selectedLogIds.length > 0;

  const handleDelete = async () => {
    if (!confirmed) {
      toast.error(t("admin.pleaseConfirmDeletion"));
      return;
    }

    let success = false;

    if (deleteByIds) {
      // Delete by IDs
      success = await deleteLogsByIds(selectedLogIds);
    } else {
      // Delete by date
      if (!beforeDate) {
        toast.error(t("admin.pleaseSelectDate"));
        return;
      }
      success = await deleteLogsByDate(beforeDate);
    }

    if (success) {
      onOpenChange(false);
      setBeforeDate("");
      setConfirmed(false);
      onSuccess?.();
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
      setBeforeDate("");
      setConfirmed(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>
              {deleteByIds
                ? t("common.deleteSelected")
                : t("admin.deleteOldLogs")}
            </DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {deleteByIds
              ? t("admin.deleteSelectedLogsDescription", {
                  count: selectedLogIds.length,
                })
              : t("admin.deleteLogsDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!deleteByIds && (
            <>
              {/* Date Picker */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("admin.deleteLogsBefore")}
                </label>
                <Input
                  type="date"
                  value={beforeDate}
                  onChange={(e) => setBeforeDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("admin.deleteLogsBeforeHint")}
                </p>
              </div>

              {/* Preview */}
              {beforeDate && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <div className="font-medium mb-1">{t("admin.preview")}:</div>
                  <div className="text-muted-foreground">
                    {t("admin.willDeleteLogsOlderThan", {
                      date: new Date(beforeDate).toLocaleDateString(),
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {deleteByIds && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div className="font-medium mb-1">{t("admin.preview")}:</div>
              <div className="text-muted-foreground">
                {t("admin.willDeleteSelectedLogs", {
                  count: selectedLogIds.length,
                })}
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm text-destructive">
                {t("admin.deleteLogsWarning")}
              </div>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="confirm-delete"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              disabled={isLoading}
            />
            <label
              htmlFor="confirm-delete"
              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {t("admin.confirmPermanentDeletion")}
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            <X className="h-4 w-4 mr-2" />
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading || (!deleteByIds && !beforeDate) || !confirmed}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isLoading
              ? t("common.loading")
              : deleteByIds
              ? t("common.deleteSelected")
              : t("admin.deleteOldLogs")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
