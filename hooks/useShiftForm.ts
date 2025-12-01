import { useState, useEffect } from "react";
import { ShiftFormData } from "@/components/shift-dialog";
import { ShiftPreset } from "@/lib/db/schema";
import { ShiftWithCalendar } from "@/lib/types";
import { formatDateToLocal } from "@/lib/date-utils";
import { usePresets } from "@/hooks/usePresets";

interface UseShiftFormOptions {
  open: boolean;
  shift?: ShiftWithCalendar;
  selectedDate?: Date;
  calendarId?: string;
}

export function useShiftForm({
  open,
  shift,
  selectedDate,
  calendarId,
}: UseShiftFormOptions) {
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

  const { presets, refetchPresets } = usePresets(calendarId);
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  const saveAsPresetHandler = async (shiftData: ShiftFormData) => {
    if (!presetName.trim() || !calendarId) return false;

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

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Failed to save preset: ${response.status} ${response.statusText}`,
          errorText
        );
        return false;
      }

      await response.json();
      await refetchPresets();
      return true;
    } catch (error) {
      console.error("Failed to save preset:", error);
      return false;
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

  const resetForm = () => {
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
    setSaveAsPreset(false);
  };

  // Update form data when dialog opens or shift/date changes
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
      setSaveAsPreset(false);
      setPresetName("");
    }
  }, [open, selectedDate, shift]);

  return {
    formData,
    setFormData,
    presets,
    saveAsPreset,
    setSaveAsPreset,
    presetName,
    setPresetName,
    applyPreset,
    saveAsPresetHandler,
    resetForm,
    refetchPresets,
  };
}
