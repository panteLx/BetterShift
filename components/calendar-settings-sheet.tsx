"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import { CalendarShareManagementSheet } from "@/components/calendar-share-management-sheet";
import { useCalendars } from "@/hooks/useCalendars";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { PRESET_COLORS } from "@/lib/constants";
import { AlertTriangle, Trash2, Download, Cloud, Users } from "lucide-react";
import { ExportDialog } from "@/components/export-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useDirtyState } from "@/hooks/useDirtyState";
import { CalendarWithCount } from "@/lib/types";

interface CalendarSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  calendarGuestPermission?: "none" | "read" | "write";
  onSuccess: () => void;
  onDelete: () => void;
  onExternalSync?: () => void;
  availableCalendars?: CalendarWithCount[];
}

interface FormState {
  name: string;
  selectedColor: string;
}

export function CalendarSettingsSheet({
  open,
  onOpenChange,
  calendarId,
  calendarName,
  calendarColor,
  calendarGuestPermission = "none",
  onSuccess,
  onDelete,
  onExternalSync,
  availableCalendars = [],
}: CalendarSettingsSheetProps) {
  const t = useTranslations();
  const { updateCalendar } = useCalendars();
  const { canShare, canManage, canDelete } = useCalendarPermission(calendarId);
  const { isAuthEnabled } = useAuthFeatures();

  // Use props directly as initial state, controlled by key prop on component
  const [name, setName] = useState(calendarName);
  const [selectedColor, setSelectedColor] = useState(calendarColor);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showShareManagement, setShowShareManagement] = useState(false);
  const initialFormStateRef = useRef<FormState | null>(null);

  // Initialize form state reference when opening
  useEffect(() => {
    if (open && !initialFormStateRef.current) {
      initialFormStateRef.current = {
        name: calendarName,
        selectedColor: calendarColor,
      };
    }
    if (!open) {
      initialFormStateRef.current = null;
    }
  }, [open, calendarName, calendarColor, calendarGuestPermission]);

  const hasChanges = () => {
    if (!initialFormStateRef.current) return false;

    const current: FormState = {
      name,
      selectedColor,
    };

    // Check basic fields
    return (
      JSON.stringify(current) !== JSON.stringify(initialFormStateRef.current)
    );
  };

  const {
    isDirty,
    handleClose,
    showConfirmDialog,
    setShowConfirmDialog,
    handleConfirmClose,
  } = useDirtyState({
    onClose: onOpenChange,
    hasChanges,
  });

  const handleSubmit = async () => {
    setLoading(true);

    const updates = {
      name: name !== calendarName ? name : undefined,
      color: selectedColor !== calendarColor ? selectedColor : undefined,
    };

    await updateCalendar(calendarId, updates);

    setLoading(false);
    onSuccess();
    onOpenChange(false);
  };

  const handleDelete = () => {
    onDelete();
    onOpenChange(false);
  };

  // Only owner/admin can access settings
  if (!canManage) {
    return null;
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[600px] p-0 flex flex-col gap-0 border-l border-border/50 overflow-hidden"
        >
          <SheetHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-5 space-y-1.5">
            <SheetTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {t("calendar.settings", { name: calendarName })}
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {t("calendar.settingsDescription")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Calendar Name */}
            <div className="space-y-2.5">
              <Label
                htmlFor="calendarName"
                className="text-sm font-medium flex items-center gap-2"
              >
                <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
                {t("common.labels.name")}
              </Label>
              <Input
                id="calendarName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("form.namePlaceholder", {
                  example: t("calendar.name"),
                })}
                className="h-11 border-primary/30 focus:border-primary/50 focus:ring-primary/20 bg-background/50"
                required
              />
            </div>

            {/* Calendar Color */}
            <ColorPicker
              color={selectedColor}
              onChange={setSelectedColor}
              label={t("form.colorLabel")}
              presetColors={PRESET_COLORS}
            />

            {/* External Sync Section */}
            {onExternalSync && (
              <div className="pt-4 mt-4 border-t border-border/50">
                <div className="space-y-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onExternalSync}
                    className="w-full h-11 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
                  >
                    <Cloud className="h-4 w-4 mr-2" />
                    {t("externalSync.manageTitle")}
                  </Button>
                </div>
              </div>
            )}

            {/* Export Section */}
            <div className="pt-4 mt-4 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowExportDialog(true)}
                className="w-full h-11 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
              >
                <Download className="h-4 w-4 mr-2" />
                {t("export.exportCalendar")}
              </Button>
            </div>

            {/* Manage Sharing Section */}
            {isAuthEnabled && canShare && (
              <div className="pt-4 mt-4 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowShareManagement(true)}
                  className="w-full h-11 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
                >
                  <Users className="h-4 w-4 mr-2" />
                  {t("share.manageSharing")}
                </Button>
              </div>
            )}

            {/* Delete Section */}
            {canDelete && (
              <div className="pt-4 mt-4 border-t border-border/50">
                <div className="space-y-3">
                  {!showDeleteConfirm ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full h-11 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t("calendar.deleteCalendar")}
                    </Button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3"
                    >
                      <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                        <div className="flex items-start gap-2.5 text-destructive mb-2">
                          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-semibold">
                              {t("common.deleteConfirm", {
                                item: t("calendar.title"),
                                name: calendarName,
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("calendar.deleteWarning")}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 h-11"
                        >
                          {t("common.cancel")}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleDelete}
                          className="flex-1 h-11 shadow-lg shadow-destructive/25"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("common.delete")}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="border-t border-border/50 bg-muted/20 px-6 py-4 mt-auto">
            <div className="flex gap-2.5 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="flex-1 h-11 border-border/50 hover:bg-muted/50"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !isDirty}
                className="flex-1 h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
              >
                {loading ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        calendarId={calendarId}
        availableCalendars={availableCalendars}
        calendarName={calendarName}
      />

      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleConfirmClose}
      />

      <CalendarShareManagementSheet
        open={showShareManagement}
        onOpenChange={setShowShareManagement}
        calendarId={calendarId}
        calendarName={calendarName}
        calendarGuestPermission={calendarGuestPermission}
        canManageShares={canShare}
      />
    </>
  );
}
