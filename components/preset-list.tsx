"use client";

import { useTranslations } from "next-intl";
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
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { ShiftPreset } from "@/lib/db/schema";
import { getShiftCode, presetTime, shiftVars } from "@/lib/shift-display";
import { ListRow, Pill, RowIconButton, SectionLabel } from "@/components/form-kit";
import { cn } from "@/lib/utils";

interface PresetRowActions {
  readOnly: boolean;
  editingId: string | null;
  deletingId: string | null;
  onEdit: (preset: ShiftPreset) => void;
  onDelete: (preset: ShiftPreset) => void;
}

interface SortablePresetRowProps extends PresetRowActions {
  preset: ShiftPreset;
  draggable: boolean;
}

function SortablePresetRow({
  preset,
  draggable,
  readOnly,
  editingId,
  deletingId,
  onEdit,
  onDelete,
}: SortablePresetRowProps) {
  const t = useTranslations();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: preset.id, disabled: !draggable });
  const busy = deletingId === preset.id;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
      }}
      className={cn("relative", isDragging && "z-10 opacity-60")}
    >
      <ListRow
        highlighted={editingId === preset.id}
        className={cn("gap-2.5 py-2.5 pr-1.5", draggable ? "pl-1.5" : "pl-3.5")}
      >
        {draggable && (
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={t("presetSheet.dragHandle")}
            className="-my-1 flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-fg-tertiary transition-colors hover:bg-surface-sunken active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <span
          className="shift-solid flex size-[22px] shrink-0 items-center justify-center rounded-[6px] text-[11px] font-bold"
          style={shiftVars(preset.color)}
        >
          {getShiftCode(preset.title)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-fg-strong">
            {preset.title}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[12px] text-fg-tertiary">
              {presetTime(preset, t("presetSheet.allDayShort"))}
            </span>
            {preset.isSecondary && <Pill>{t("preset.secondary")}</Pill>}
            {preset.hideFromStats && (
              <Pill tone="warning">{t("presetSheet.notInStats")}</Pill>
            )}
          </div>
        </div>
        {!readOnly && (
          <>
            <RowIconButton
              icon={Pencil}
              label={t("preset.edit")}
              onClick={() => onEdit(preset)}
              disabled={busy}
            />
            <RowIconButton
              icon={Trash2}
              tone="danger"
              label={t("presetSheet.delete")}
              onClick={() => onDelete(preset)}
              disabled={busy}
            />
          </>
        )}
      </ListRow>
    </div>
  );
}

interface PresetSectionProps extends PresetRowActions {
  label: string;
  presets: ShiftPreset[];
  onReorder: (next: ShiftPreset[]) => void;
}

/** One sortable group; primary and secondary presets are reordered separately. */
export function PresetSection({ label, presets, onReorder, ...actions }: PresetSectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const draggable = !actions.readOnly && presets.length > 1;

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = presets.findIndex((p) => p.id === active.id);
    const newIndex = presets.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(presets, oldIndex, newIndex));
  };

  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={presets.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {presets.map((preset) => (
              <SortablePresetRow
                key={preset.id}
                preset={preset}
                draggable={draggable}
                {...actions}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
