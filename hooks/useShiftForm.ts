import { useState, useEffect, useRef } from "react";
import { ShiftFormData } from "@/components/shift-sheet";
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

  const { presets, createPreset } = usePresets(calendarId);
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  const saveAsPresetHandler = async (shiftData: ShiftFormData) => {
    if (!presetName.trim() || !calendarId) return false;

    // Use the new createPreset mutation from usePresets
    const success = await createPreset({
      title: presetName,
      startTime: shiftData.startTime,
      endTime: shiftData.endTime,
      color: shiftData.color || "#3b82f6",
      notes: shiftData.notes || "",
      isAllDay: shiftData.isAllDay || false,
      isSecondary: false,
      hideFromStats: false,
    });

    return success;
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

  // Sync form data when dialog state changes (refs only)
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // Only update on mount or when key changes
  useEffect(() => {
    if (open) {
      const newFormData = {
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
      };

      // Compare form data fields directly
      const needsUpdate =
        formDataRef.current.date !== newFormData.date ||
        formDataRef.current.startTime !== newFormData.startTime ||
        formDataRef.current.endTime !== newFormData.endTime ||
        formDataRef.current.title !== newFormData.title ||
        formDataRef.current.notes !== newFormData.notes ||
        formDataRef.current.color !== newFormData.color ||
        formDataRef.current.isAllDay !== newFormData.isAllDay;

      if (needsUpdate) {
        setFormData(newFormData);
        setSaveAsPreset(false);
        setPresetName("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shift?.id, selectedDate?.toString()]);

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
  };
}
