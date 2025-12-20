"use client";

import { useState, useEffect, memo, useRef } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker } from "@/components/ui/color-picker";
import { ShiftPreset } from "@/lib/db/schema";
import { PRESET_COLORS } from "@/lib/constants";
import { Plus, Trash2, Edit2, Loader2, GripVertical } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useDirtyState } from "@/hooks/useDirtyState";
import { usePresetManagement } from "@/hooks/usePresetManagement";

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

interface PresetManageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  presets: ShiftPreset[];
  onPresetsChange: () => void;
}

// Sortable preset item component
interface SortablePresetItemProps {
  preset: ShiftPreset;
  isDeleting: boolean;
  onEdit: (preset: ShiftPreset) => void;
  onDelete: (id: string) => void;
  t: (key: string) => string;
  showDragHandle?: boolean;
}

const SortablePresetItem = memo(function SortablePresetItem({
  preset,
  isDeleting,
  onEdit,
  onDelete,
  t,
  showDragHandle = true,
}: SortablePresetItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: preset.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-3 p-4 rounded-xl border border-border/50 bg-muted/20 transition-colors"
      {...attributes}
    >
      <div className="flex items-start gap-2">
        {showDragHandle && (
          <button
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted/50 rounded transition-colors shrink-0"
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <div
          className="w-1 h-4 rounded-full shrink-0 mt-0.5"
          style={{ backgroundColor: preset.color }}
        />
        <span className="font-semibold flex-1 min-w-0 break-words">
          {preset.title}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between pl-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {preset.isAllDay ? (
              t("shift.allDay")
            ) : (
              <>
                {preset.startTime} - {preset.endTime}
              </>
            )}
          </span>
          {preset.isSecondary && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
              {t("preset.secondary")}
            </span>
          )}
          {preset.hideFromStats && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 font-medium">
              {t("preset.hiddenFromStats")}
            </span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => onEdit(preset)}
            disabled={isDeleting}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(preset.id)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});

export function PresetManageSheet({
  open,
  onOpenChange,
  calendarId,
  presets,
  onPresetsChange,
}: PresetManageSheetProps) {
  const t = useTranslations();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ShiftPreset | null>(null);
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
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [orderedPrimaryPresets, setOrderedPrimaryPresets] = useState<
    ShiftPreset[]
  >([]);
  const [orderedSecondaryPresets, setOrderedSecondaryPresets] = useState<
    ShiftPreset[]
  >([]);
  const initialFormDataRef = useRef<PresetFormData | null>(null);

  const { createPreset, updatePreset, deletePreset, reorderPresets } =
    usePresetManagement({
      calendarId,
      onSuccess: onPresetsChange,
    });

  // Initialize ordered presets
  useEffect(() => {
    if (open) {
      setOrderedPrimaryPresets(presets.filter((p) => !p.isSecondary));
      setOrderedSecondaryPresets(presets.filter((p) => p.isSecondary));
    }
  }, [presets, open]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handlePrimaryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedPrimaryPresets.findIndex((p) => p.id === active.id);
    const newIndex = orderedPrimaryPresets.findIndex((p) => p.id === over.id);

    const newOrderedPrimary = arrayMove(
      orderedPrimaryPresets,
      oldIndex,
      newIndex
    );
    setOrderedPrimaryPresets(newOrderedPrimary);

    // Save new order to backend
    await savePresetOrder([...newOrderedPrimary, ...orderedSecondaryPresets]);
  };

  const handleSecondaryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedSecondaryPresets.findIndex(
      (p) => p.id === active.id
    );
    const newIndex = orderedSecondaryPresets.findIndex((p) => p.id === over.id);

    const newOrderedSecondary = arrayMove(
      orderedSecondaryPresets,
      oldIndex,
      newIndex
    );
    setOrderedSecondaryPresets(newOrderedSecondary);

    // Save new order to backend
    await savePresetOrder([...orderedPrimaryPresets, ...newOrderedSecondary]);
  };

  const savePresetOrder = async (allPresets: ShiftPreset[]) => {
    const presetOrders = allPresets.map((preset, index) => ({
      id: preset.id,
      order: index,
    }));

    const success = await reorderPresets(presetOrders);
    if (!success) {
      // Revert order on error
      setOrderedPrimaryPresets(presets.filter((p) => !p.isSecondary));
      setOrderedSecondaryPresets(presets.filter((p) => p.isSecondary));
    }
  };

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setShowAddForm(false);
      setEditingPreset(null);
      setFormData({
        title: "",
        startTime: "09:00",
        endTime: "17:00",
        color: PRESET_COLORS[0].value,
        notes: "",
        isSecondary: false,
        isAllDay: false,
        hideFromStats: false,
      });
      setIsLoading(false);
      setIsDeleting(null);
    }
  }, [open]);

  const handleSavePreset = async () => {
    if (!calendarId || !formData.title.trim() || isLoading) return;

    setIsLoading(true);
    try {
      let success = false;

      if (editingPreset) {
        success = await updatePreset(editingPreset.id, formData);
      } else {
        success = await createPreset(formData);
      }

      if (success) {
        setEditingPreset(null);
        setShowAddForm(false);
        setFormData({
          title: "",
          startTime: "09:00",
          endTime: "17:00",
          color: PRESET_COLORS[0].value,
          notes: "",
          isSecondary: false,
          isAllDay: false,
          hideFromStats: false,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (presetId: string) => {
    setDeleteTargetId(presetId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;

    setIsDeleting(deleteTargetId);
    setShowDeleteConfirm(false);

    try {
      const success = await deletePreset(deleteTargetId);
      if (success) {
        // If we're editing the deleted preset, close the edit form
        if (editingPreset?.id === deleteTargetId) {
          setEditingPreset(null);
        }
      }
    } finally {
      setIsDeleting(null);
      setDeleteTargetId(null);
    }
  };

  const startEdit = (preset: ShiftPreset) => {
    const editFormData = {
      title: preset.title,
      startTime: preset.startTime,
      endTime: preset.endTime,
      color: preset.color,
      notes: preset.notes || "",
      isSecondary: preset.isSecondary || false,
      isAllDay: preset.isAllDay || false,
      hideFromStats: preset.hideFromStats || false,
    };
    setEditingPreset(preset);
    setFormData(editFormData);
    setShowAddForm(false);
    // Store initial data for change detection
    initialFormDataRef.current = editFormData;
  };

  const cancelEdit = () => {
    setEditingPreset(null);
    setFormData({
      title: "",
      startTime: "09:00",
      endTime: "17:00",
      color: PRESET_COLORS[0].value,
      notes: "",
      isSecondary: false,
      isAllDay: false,
      hideFromStats: false,
    });
    initialFormDataRef.current = null;
  };

  const hasChanges = () => {
    if (editingPreset && initialFormDataRef.current) {
      // Edit mode: check if data changed from initial
      return (
        JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current)
      );
    } else if (showAddForm) {
      // Add mode: check if any data was entered
      return (
        formData.title.trim() !== "" ||
        formData.startTime !== "09:00" ||
        formData.endTime !== "17:00" ||
        formData.color !== PRESET_COLORS[0].value ||
        formData.notes.trim() !== "" ||
        formData.isSecondary ||
        formData.isAllDay ||
        formData.hideFromStats
      );
    }
    return false;
  };

  const resetForm = () => {
    if (editingPreset) {
      cancelEdit();
    } else if (showAddForm) {
      setShowAddForm(false);
      setFormData({
        title: "",
        startTime: "09:00",
        endTime: "17:00",
        color: PRESET_COLORS[0].value,
        notes: "",
        isSecondary: false,
        isAllDay: false,
        hideFromStats: false,
      });
    }
  };

  const {
    isDirty,
    handleClose,
    showConfirmDialog,
    setShowConfirmDialog,
    handleConfirmClose,
  } = useDirtyState({
    onClose: onOpenChange,
    hasChanges: () => (editingPreset || showAddForm) && hasChanges(),
    onConfirm: resetForm,
  });

  const startAdd = () => {
    setShowAddForm(true);
    setEditingPreset(null);
    setFormData({
      title: "",
      startTime: "09:00",
      endTime: "17:00",
      color: PRESET_COLORS[0].value,
      notes: "",
      isSecondary: false,
      isAllDay: false,
      hideFromStats: false,
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[600px] p-0 flex flex-col gap-0 border-l border-border/50 overflow-hidden"
        >
          <SheetHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-5 space-y-1.5">
            <SheetTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {t("preset.manage")}
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {t("preset.manageDescription")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
            {/* Empty state when no presets exist */}
            {presets.length === 0 && !showAddForm && !editingPreset && (
              <p className="text-center text-muted-foreground py-8">
                {t("preset.noPresets")}
              </p>
            )}

            {/* Primary Presets List */}
            {orderedPrimaryPresets.length > 0 &&
              !showAddForm &&
              !editingPreset && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground px-1">
                    {t("preset.primaryPresets")}
                  </h3>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handlePrimaryDragEnd}
                  >
                    <SortableContext
                      items={orderedPrimaryPresets.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {orderedPrimaryPresets.map((preset) => (
                          <SortablePresetItem
                            key={preset.id}
                            preset={preset}
                            isDeleting={isDeleting === preset.id}
                            onEdit={startEdit}
                            onDelete={handleDeleteClick}
                            t={t}
                            showDragHandle={orderedPrimaryPresets.length > 1}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}

            {/* Secondary Presets List */}
            {orderedSecondaryPresets.length > 0 &&
              !showAddForm &&
              !editingPreset && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground px-1">
                    {t("preset.secondaryPresets")}
                  </h3>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleSecondaryDragEnd}
                  >
                    <SortableContext
                      items={orderedSecondaryPresets.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {orderedSecondaryPresets.map((preset) => (
                          <SortablePresetItem
                            key={preset.id}
                            preset={preset}
                            isDeleting={isDeleting === preset.id}
                            onEdit={startEdit}
                            onDelete={handleDeleteClick}
                            t={t}
                            showDragHandle={orderedSecondaryPresets.length > 1}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}

            {/* Show edited preset */}
            {editingPreset && (
              <div className="space-y-3">
                <SortablePresetItem
                  preset={editingPreset}
                  isDeleting={isDeleting === editingPreset.id}
                  onEdit={startEdit}
                  onDelete={handleDeleteClick}
                  t={t}
                  showDragHandle={false}
                />
              </div>
            )}

            {/* Add/Edit Form */}
            {(showAddForm || editingPreset) && (
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
                <h3 className="font-semibold">
                  {editingPreset ? t("preset.edit") : t("preset.createNew")}
                </h3>

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
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-border/30">
                  <Checkbox
                    id="preset-allday"
                    checked={formData.isAllDay}
                    onCheckedChange={(checked: boolean) =>
                      setFormData({ ...formData, isAllDay: !!checked })
                    }
                    disabled={isLoading}
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
                      <Label
                        htmlFor="preset-start"
                        className="text-sm font-medium"
                      >
                        {t("shift.startTime")}
                      </Label>
                      <Input
                        id="preset-start"
                        type="time"
                        value={formData.startTime}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            startTime: e.target.value,
                          })
                        }
                        className="h-11 border-border/50 focus:border-primary/50 focus:ring-primary/20 bg-background/50"
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="preset-end"
                        className="text-sm font-medium"
                      >
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
                        disabled={isLoading}
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
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-border/30">
                  <Checkbox
                    id="preset-secondary"
                    checked={formData.isSecondary}
                    onCheckedChange={(checked: boolean) =>
                      setFormData({ ...formData, isSecondary: !!checked })
                    }
                    disabled={isLoading}
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
                    onCheckedChange={(checked: boolean) =>
                      setFormData({ ...formData, hideFromStats: !!checked })
                    }
                    disabled={isLoading}
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
              </div>
            )}
          </div>

          {/* Footer: Always visible Add or Save button */}
          {!showAddForm && !editingPreset ? (
            <div className="border-t border-border/50 bg-muted/20 px-6 py-4 mt-auto">
              <Button
                onClick={startAdd}
                className="w-full h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25"
                disabled={!!isDeleting}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("preset.createNew")}
              </Button>
            </div>
          ) : (
            <SheetFooter className="border-t border-border/50 bg-muted/20 px-6 py-4 mt-auto">
              <div className="flex gap-2.5 w-full">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (editingPreset) {
                      cancelEdit();
                    } else {
                      setShowAddForm(false);
                      setFormData({
                        title: "",
                        startTime: "09:00",
                        endTime: "17:00",
                        color: PRESET_COLORS[0].value,
                        notes: "",
                        isSecondary: false,
                        isAllDay: false,
                        hideFromStats: false,
                      });
                    }
                  }}
                  disabled={isLoading}
                  className="flex-1 h-11 border-border/50 hover:bg-muted/50"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={handleSavePreset}
                  disabled={
                    isLoading ||
                    !formData.title.trim() ||
                    (!!editingPreset && !isDirty)
                  }
                  className="flex-1 h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("common.saving")}
                    </>
                  ) : (
                    t("common.save")
                  )}
                </Button>
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleConfirmClose}
        title={t("common.unsavedChanges")}
        description={t("common.unsavedChangesDescription")}
      />

      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDeleteConfirm}
        title={t("preset.preset") + " " + t("common.delete")}
        description={t("preset.deleteConfirm")}
        cancelText={t("common.cancel")}
        confirmText={t("common.delete")}
        confirmVariant="destructive"
      />
    </>
  );
}
