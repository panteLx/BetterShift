"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShiftWithCalendar } from "@/lib/types";
import { ShiftPreset } from "@/lib/db/schema";
import { formatDateToLocal } from "@/lib/date-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker } from "@/components/ui/color-picker";

const PRESET_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Red", value: "#ef4444" },
  { name: "Green", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Orange", value: "#f97316" },
];

interface ShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (shift: ShiftFormData) => void;
  selectedDate?: Date;
  shift?: ShiftWithCalendar;
  onPresetsChange?: () => void;
  calendarId?: string;
}

export interface ShiftFormData {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  color?: string;
  notes?: string;
  presetId?: string;
  isAllDay?: boolean;
}

export function ShiftDialog({
  open,
  onOpenChange,
  onSubmit,
  selectedDate,
  shift,
  onPresetsChange,
  calendarId,
}: ShiftDialogProps) {
  const t = useTranslations();
  const [formData, setFormData] = useState<ShiftFormData>({
    date:
      shift?.date && shift.date instanceof Date
        ? formatDateToLocal(shift.date)
        : selectedDate
        ? formatDateToLocal(selectedDate)
        : formatDateToLocal(new Date()),
    startTime: shift?.startTime || "09:00",
    endTime: shift?.endTime || "17:00",
    title: shift?.title || "",
    notes: shift?.notes || "",
    color: shift?.color || "#3b82f6",
    isAllDay: false,
  });

  const [presets, setPresets] = useState<ShiftPreset[]>([]);
  const [saveAsPreset, setSaveAsPreset] = useState(true); // Auto-save enabled by default
  const [presetName, setPresetName] = useState("");

  // Fetch presets on mount
  useEffect(() => {
    fetchPresets();
  }, []);

  // Update form data when selectedDate or shift changes
  useEffect(() => {
    if (open) {
      setFormData({
        date:
          shift?.date && shift.date instanceof Date
            ? formatDateToLocal(shift.date)
            : selectedDate
            ? formatDateToLocal(selectedDate)
            : formatDateToLocal(new Date()),
        startTime: shift?.startTime || "09:00",
        endTime: shift?.endTime || "17:00",
        title: shift?.title || "",
        notes: shift?.notes || "",
        color: shift?.color || "#3b82f6",
        isAllDay: shift?.isAllDay || false,
      });
      setSaveAsPreset(!shift); // Enable auto-save for new shifts
      setPresetName("");
    }
  }, [open, selectedDate, shift]);

  const fetchPresets = async () => {
    try {
      const response = await fetch("/api/presets");
      const data = await response.json();
      setPresets(data);
    } catch (error) {
      console.error("Failed to fetch presets:", error);
    }
  };

  const handleSaveAsPreset = async (shiftData: ShiftFormData) => {
    if (!presetName.trim() || !calendarId) return;

    try {
      const response = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId,
          title: presetName,
          startTime: shiftData.startTime,
          endTime: shiftData.endTime,
          color: shiftData.color,
          notes: shiftData.notes,
          isAllDay: shiftData.isAllDay,
        }),
      });
      await response.json();
      await fetchPresets();
      // Notify parent to refresh presets
      if (onPresetsChange) {
        onPresetsChange();
      }
    } catch (error) {
      console.error("Failed to save preset:", error);
    }
  };

  const applyPreset = (preset: ShiftPreset) => {
    setFormData({
      ...formData,
      startTime: preset.startTime,
      endTime: preset.endTime,
      title: preset.title,
      notes: preset.notes || "",
      color: preset.color,
      isAllDay: preset.isAllDay || false,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title.trim()) {
      // If all-day, set default times for backend
      const submitData = {
        ...formData,
        startTime: formData.isAllDay ? "00:00" : formData.startTime,
        endTime: formData.isAllDay ? "23:59" : formData.endTime,
      };

      onSubmit(submitData);

      // Save as preset if enabled and it's a new shift
      if (!shift && saveAsPreset && presetName.trim()) {
        handleSaveAsPreset(submitData);
      }

      if (!shift) {
        setFormData({
          date: selectedDate
            ? formatDateToLocal(selectedDate)
            : formatDateToLocal(new Date()),
          startTime: "09:00",
          endTime: "17:00",
          title: "",
          notes: "",
          color: "#3b82f6",
          isAllDay: false,
        });
        setPresetName("");
      }
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {shift ? t("shift.edit") : t("shift.create")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Preset Selection */}
          {!shift && presets.length > 0 && (
            <div className="space-y-2">
              <Label>{t("shift.selectPreset")}</Label>
              <div className="flex gap-2">
                <Select
                  onValueChange={(value) => {
                    const preset = presets.find((p) => p.id === value);
                    if (preset) applyPreset(preset);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("shift.none")} />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.title} ({preset.startTime} - {preset.endTime})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="date">{t("shift.date")}</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
            />
          </div>

          <div className="flex items-center space-x-2 py-2">
            <Checkbox
              id="allDay"
              checked={formData.isAllDay}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isAllDay: !!checked })
              }
            />
            <Label
              htmlFor="allDay"
              className="text-sm font-medium cursor-pointer"
            >
              {t("shift.allDayShift")}
            </Label>
          </div>

          {!formData.isAllDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">{t("shift.startTime")}</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">{t("shift.endTime")}</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="title">{t("shift.titleLabel")}</Label>
            <Input
              id="title"
              placeholder={t("shift.titlePlaceholder")}
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">{t("shift.notesOptional")}</Label>
            <Textarea
              id="notes"
              placeholder={t("shift.notesPlaceholder")}
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
            />
          </div>
          <ColorPicker
            color={formData.color || "#3b82f6"}
            onChange={(color) => setFormData({ ...formData, color })}
            label={t("shift.color")}
            presetColors={PRESET_COLORS}
          />

          {/* Auto-Save as Preset */}
          {!shift && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="savePreset"
                  checked={saveAsPreset}
                  onCheckedChange={(checked) =>
                    setSaveAsPreset(checked as boolean)
                  }
                />
                <Label
                  htmlFor="savePreset"
                  className="text-sm font-normal cursor-pointer"
                >
                  {t("preset.saveAsPreset")}
                </Label>
              </div>
              {saveAsPreset && (
                <div className="space-y-2">
                  <Label htmlFor="presetName">{t("preset.presetName")}</Label>
                  <Input
                    id="presetName"
                    placeholder={t("preset.presetNamePlaceholder")}
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!formData.title.trim()}>
              {shift ? t("shift.saveChanges") : t("shift.addShift")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
