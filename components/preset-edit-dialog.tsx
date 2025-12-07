import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker } from "@/components/ui/color-picker";
import { ShiftPreset } from "@/lib/db/schema";
import { PRESET_COLORS } from "@/lib/constants";

interface PresetFormData {
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  notes: string;
  isSecondary: boolean;
  isAllDay: boolean;
  hideFromStats: boolean;
}

interface PresetEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: ShiftPreset | null;
  isCreating: boolean;
  onSave: (data: PresetFormData) => void;
}

export function PresetEditDialog({
  open,
  onOpenChange,
  preset,
  isCreating,
  onSave,
}: PresetEditDialogProps) {
  const t = useTranslations();
  const [formData, setFormData] = useState<PresetFormData>({
    title: "",
    startTime: "09:00",
    endTime: "17:00",
    color: PRESET_COLORS[0].value,
    notes: "",
    isSecondary: false,
    isAllDay: false,
    hideFromStats: false,
  });
  const initialDataRef = useRef<PresetFormData | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (open && preset && !isCreating) {
      const initialData = {
        title: preset.title,
        startTime: preset.startTime,
        endTime: preset.endTime,
        color: preset.color,
        notes: preset.notes || "",
        isSecondary: preset.isSecondary || false,
        isAllDay: preset.isAllDay || false,
        hideFromStats: preset.hideFromStats || false,
      };
      setFormData(initialData);
      initialDataRef.current = initialData;
      isInitialMount.current = true;
    } else if (open && isCreating) {
      const initialData = {
        title: "",
        startTime: "09:00",
        endTime: "17:00",
        color: PRESET_COLORS[0].value,
        notes: "",
        isSecondary: false,
        isAllDay: false,
        hideFromStats: false,
      };
      setFormData(initialData);
      initialDataRef.current = initialData;
      isInitialMount.current = true;
    } else if (!open) {
      // Clear timeout when dialog closes
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    }
  }, [open, preset, isCreating]);

  // Auto-save with debouncing (only for editing existing presets)
  useEffect(() => {
    if (!open || isCreating || !initialDataRef.current) return;

    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Check if data has changed and title is not empty
    const hasChanged =
      JSON.stringify(formData) !== JSON.stringify(initialDataRef.current);
    if (hasChanged && formData.title.trim()) {
      saveTimeoutRef.current = setTimeout(() => {
        onSave(formData);
        initialDataRef.current = formData;
      }, 1000); // 1 second debounce
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, open, isCreating, onSave]);

  // Handle dialog close with immediate save if needed
  const handleDialogClose = (open: boolean) => {
    if (!open && !isCreating && initialDataRef.current) {
      // Cancel pending timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      // Save immediately if data changed and title is not empty
      const hasChanged =
        JSON.stringify(formData) !== JSON.stringify(initialDataRef.current);
      if (hasChanged && formData.title.trim()) {
        onSave(formData);
      }
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden w-[95vw] max-w-[520px] p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {isCreating ? t("preset.createNew") : t("preset.edit")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isCreating
              ? t("preset.createDescription", {
                  default: "Create a new preset for quick shift creation",
                })
              : t("preset.editDescription", {
                  default: "Update preset details",
                })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 p-6">
          <div className="space-y-2.5">
            <Label
              htmlFor="preset-title"
              className="text-sm font-medium flex items-center gap-2"
            >
              <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
              {t("shift.titleLabel")}
            </Label>
            <Input
              id="preset-title"
              placeholder={t("form.namePlaceholder", {
                example: t("preset.presetName"),
              })}
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="h-11 border-border/50 focus:border-primary/50 focus:ring-primary/20 bg-background/50"
            />
          </div>

          <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-border/30">
            <Checkbox
              id="preset-allday"
              checked={formData.isAllDay}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isAllDay: !!checked })
              }
            />
            <Label
              htmlFor="preset-allday"
              className="text-sm font-medium cursor-pointer"
            >
              {t("shift.allDayShift")}
            </Label>
          </div>

          {!formData.isAllDay && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 gap-3"
            >
              <div className="space-y-2">
                <Label htmlFor="preset-start" className="text-sm font-medium">
                  {t("shift.startTime")}
                </Label>
                <Input
                  id="preset-start"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                  className="h-11 border-border/50 focus:border-primary/50 focus:ring-primary/20 bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preset-end" className="text-sm font-medium">
                  {t("shift.endTime")}
                </Label>
                <Input
                  id="preset-end"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                  className="h-11 border-border/50 focus:border-primary/50 focus:ring-primary/20 bg-background/50"
                />
              </div>
            </motion.div>
          )}

          <ColorPicker
            color={formData.color}
            onChange={(color) => setFormData({ ...formData, color })}
            label={t("form.colorLabel")}
            presetColors={PRESET_COLORS}
          />

          <div className="space-y-2.5">
            <Label
              htmlFor="preset-notes"
              className="text-sm font-medium flex items-center gap-2"
            >
              <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
              {t("form.notesLabel")}
            </Label>
            <Input
              id="preset-notes"
              placeholder={t("form.notesPlaceholder")}
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="h-11 border-border/50 focus:border-primary/50 focus:ring-primary/20 bg-background/50"
            />
          </div>

          <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-border/30">
            <Checkbox
              id="preset-secondary"
              checked={formData.isSecondary}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isSecondary: !!checked })
              }
            />
            <Label
              htmlFor="preset-secondary"
              className="text-sm font-medium cursor-pointer"
            >
              {t("preset.markAsSecondary")}
            </Label>
          </div>

          <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-border/30">
            <Checkbox
              id="preset-hide-stats"
              checked={formData.hideFromStats}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, hideFromStats: !!checked })
              }
            />
            <div className="flex-1">
              <Label
                htmlFor="preset-hide-stats"
                className="text-sm font-medium cursor-pointer"
              >
                {t("preset.hideFromStats")}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("preset.hideFromStatsHint")}
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11 border-border/50 hover:bg-muted/50"
            >
              {t("common.close")}
            </Button>
            {isCreating && (
              <Button
                type="button"
                onClick={() => {
                  if (formData.title.trim()) {
                    onSave(formData);
                  }
                }}
                disabled={!formData.title.trim()}
                className="flex-1 h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
              >
                {t("common.create")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { PresetFormData };
