import React from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Check,
  Plus,
  Settings,
  Settings2,
  ChevronDown,
  ChevronUp,
  Tag,
} from "lucide-react";

import { ShiftPreset } from "@/lib/db/schema";
import { CalendarWithCount } from "@/lib/types";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";

interface PresetListProps {
  calendars: CalendarWithCount[];
  calendarId: string;
  presets: ShiftPreset[];
  selectedPresetId?: string;
  selectedPresetIds?: string[];
  onSelectPreset: (presetId: string | undefined, multiSelect?: boolean) => void;
  onCreateNew?: () => void;
  onManageClick?: () => void;
  onViewSettingsClick?: () => void;
  hidePresetHeader?: boolean;
  onHidePresetHeaderChange?: (hide: boolean) => void;
  hideManageButton?: boolean;
}

export function PresetList({
  calendarId,
  presets,
  selectedPresetId,
  selectedPresetIds,
  onSelectPreset,
  onManageClick,
  onViewSettingsClick,
  hidePresetHeader = false,
  onHidePresetHeaderChange,
  hideManageButton = false,
}: PresetListProps) {
  const t = useTranslations();
  const permission = useCalendarPermission(calendarId);
  const [showSecondary, setShowSecondary] = React.useState(false);

  const activePresetIds = new Set(
    selectedPresetIds && selectedPresetIds.length > 0
      ? selectedPresetIds
      : selectedPresetId
        ? [selectedPresetId]
        : []
  );
  const primaryPresets = presets.filter((p) => !p.isSecondary);
  const secondaryPresets = presets.filter((p) => p.isSecondary);

  const groups = React.useMemo(() => {
    const map = new Map<string, ShiftPreset[]>();
    for (const preset of presets) {
      const name = preset.groupName?.trim();
      if (!name) continue;
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(preset);
    }
    return [...map.entries()]
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [presets]);

  const handlePresetToggle = (
    presetId: string,
    event?: React.MouseEvent<HTMLButtonElement>
  ) => {
    const multiSelect =
      !!event && (event.metaKey || event.ctrlKey || event.shiftKey);

    if (multiSelect) {
      onSelectPreset(presetId, true);
      return;
    }

    onSelectPreset(activePresetIds.has(presetId) ? undefined : presetId, false);
  };

  // A group chip applies (or removes) every preset in that group at once,
  // layering on top of whatever is already individually selected: fully
  // selected -> deselect the whole group, otherwise -> select what's missing.
  const handleGroupToggle = (groupPresets: ShiftPreset[]) => {
    const ids = groupPresets.map((p) => p.id);
    const allSelected = ids.every((id) => activePresetIds.has(id));
    ids.forEach((id) => {
      if (allSelected || !activePresetIds.has(id)) {
        onSelectPreset(id, true);
      }
    });
  };

  // Check if current calendar is read-only
  const isReadOnly = !permission.canEdit;

  // Presets are now loaded at page level - no skeleton needed here
  // If loading is true, parent should show FullscreenLoader

  if (presets.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-lg p-4 sm:p-6 text-center space-y-2 sm:space-y-3">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Plus className="h-4 sm:h-5 w-4 sm:w-5" />
          <p className="text-xs sm:text-sm font-medium">
            {t("preset.noPresets")}
          </p>
        </div>
        <p className="text-[10px] sm:text-xs text-muted-foreground max-w-md mx-auto">
          {t("preset.createFirstDescription")}
        </p>
        {!hideManageButton && (
          <Button
            onClick={onManageClick}
            size="sm"
            className="gap-2"
            disabled={!onManageClick}
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs sm:text-sm">
              {t("preset.createYourFirst")}
            </span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Preset Buttons Row */}
      {!hidePresetHeader && (
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {primaryPresets.map((preset) => (
            <PresetButton
              key={preset.id}
              preset={preset}
              isSelected={activePresetIds.has(preset.id)}
              onSelect={(event) => handlePresetToggle(preset.id, event)}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      )}

      {/* Group Chips - selecting one toggles every preset in that group */}
      {!hidePresetHeader && groups.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground px-2">
            {t("preset.groups")}
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {groups.map((group) => {
              const ids = group.items.map((p) => p.id);
              const isFullySelected = ids.every((id) => activePresetIds.has(id));
              return (
                <Button
                  key={group.name}
                  variant={isFullySelected ? "default" : "outline"}
                  size="sm"
                  onClick={
                    isReadOnly ? undefined : () => handleGroupToggle(group.items)
                  }
                  disabled={isReadOnly}
                  className="gap-1 text-xs sm:text-sm px-2.5 sm:px-3 h-8 sm:h-9 rounded-full border-dashed"
                  title={t("preset.selectGroupHint")}
                >
                  {isFullySelected ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Tag className="h-3 w-3" />
                  )}
                  <span className="font-medium truncate max-w-[120px] sm:max-w-none">
                    {group.name} ({group.items.length})
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Secondary Presets - Collapsible */}
      {!hidePresetHeader && secondaryPresets.length > 0 && (
        <div className="space-y-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSecondary(!showSecondary)}
            className="gap-1 text-xs text-muted-foreground h-6 px-2"
          >
            {showSecondary ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            <span>
              {t("preset.secondaryPresets")} ({secondaryPresets.length})
            </span>
          </Button>
          {showSecondary && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {secondaryPresets.map((preset) => (
                <PresetButton
                  key={preset.id}
                  preset={preset}
                  isSelected={activePresetIds.has(preset.id)}
                  onSelect={(event) => handlePresetToggle(preset.id, event)}
                  compact
                  isReadOnly={isReadOnly}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Control Buttons Row */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {!hidePresetHeader && !hideManageButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={onManageClick}
            disabled={!onManageClick}
            className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 sm:h-9 border-primary/30 hover:border-primary/50 hover:bg-primary/5"
            title={t("preset.manage")}
          >
            <Settings className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
          </Button>
        )}
        <div className="flex-1" />
        {onViewSettingsClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewSettingsClick}
            className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 sm:h-9 border-primary/30 hover:border-primary/50 hover:bg-primary/5"
            title={t("view.settingsTitle")}
          >
            <Settings2 className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
          </Button>
        )}
        {onHidePresetHeaderChange && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onHidePresetHeaderChange(!hidePresetHeader)}
            className="h-8 sm:h-9 w-8 sm:w-9 p-0 text-muted-foreground hover:text-foreground"
            title={
              hidePresetHeader
                ? t("preset.showPresets")
                : t("preset.hidePresets")
            }
          >
            {hidePresetHeader ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

interface PresetButtonProps {
  preset: ShiftPreset;
  isSelected: boolean;
  onSelect: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  compact?: boolean;
  isReadOnly?: boolean;
}

function PresetButton({
  preset,
  isSelected,
  onSelect,
  compact,
  isReadOnly = false,
}: PresetButtonProps) {
  const t = useTranslations();

  if (compact) {
    return (
      <Button
        variant={isSelected ? "default" : "outline"}
        size="sm"
        onClick={isReadOnly ? undefined : (event) => onSelect(event)}
        disabled={isReadOnly}
        className="relative text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9"
        style={{
          backgroundColor: isSelected ? preset.color : undefined,
          borderColor: preset.color,
        }}
      >
        {isSelected && <Check className="mr-1 h-3 w-3" />}
        <span className="font-medium truncate max-w-[80px] sm:max-w-none">
          {preset.title}
        </span>
        <span className="ml-1 text-[10px] sm:text-xs opacity-70">
          {preset.isAllDay ? (
            <span>{t("shift.allDay")}</span>
          ) : (
            <>
              <span className="sm:hidden">{preset.startTime}</span>
              <span className="hidden sm:inline">
                {preset.startTime} - {preset.endTime}
              </span>
            </>
          )}
        </span>
      </Button>
    );
  }

  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <Button
        variant={isSelected ? "default" : "outline"}
        size="sm"
        onClick={isReadOnly ? undefined : (event) => onSelect(event)}
        disabled={isReadOnly}
        className="relative text-[11px] sm:text-sm px-2 sm:px-4 h-8 sm:h-10 rounded-full font-semibold transition-all"
        style={{
          backgroundColor: isSelected ? preset.color : undefined,
          borderColor: preset.color,
          borderWidth: "2px",
        }}
      >
        {isSelected && (
          <Check className="mr-1 sm:mr-1.5 h-3 sm:h-3.5 w-3 sm:w-3.5" />
        )}
        <span className="truncate max-w-[80px] sm:max-w-none">
          {preset.title}
        </span>
        <span className="ml-1 sm:ml-1.5 text-[9px] sm:text-xs opacity-80">
          {preset.isAllDay ? (
            <span>{t("shift.allDay")}</span>
          ) : (
            <>
              <span className="sm:hidden">
                {preset.startTime.substring(0, 5)}
              </span>
              <span className="hidden sm:inline">
                {preset.startTime} - {preset.endTime}
              </span>
            </>
          )}
        </span>
      </Button>
    </motion.div>
  );
}
