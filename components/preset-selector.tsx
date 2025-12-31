"use client";

import { ShiftPreset } from "@/lib/db/schema";
import { CalendarWithCount } from "@/lib/types";
import { useState } from "react";
import { PresetList } from "@/components/preset-list";
import { PresetManageSheet } from "@/components/preset-manage-sheet";

interface PresetSelectorProps {
  calendars: CalendarWithCount[];
  presets: ShiftPreset[];
  selectedPresetId?: string;
  onSelectPreset: (presetId: string | undefined) => void;
  onPresetsChange: () => void;
  onShiftsChange?: () => void;
  onStatsRefresh?: () => void;
  calendarId: string;
  onViewSettingsClick?: () => void;
  loading?: boolean;
  hidePresetHeader?: boolean;
  onHidePresetHeaderChange?: (hide: boolean) => void;
  hideManageButton?: boolean;
}

export function PresetSelector({
  calendars,
  presets,
  selectedPresetId,
  onSelectPreset,
  onPresetsChange,
  onShiftsChange,
  onStatsRefresh,
  calendarId,
  onViewSettingsClick,
  hidePresetHeader = false,
  onHidePresetHeaderChange,
  hideManageButton = false,
}: PresetSelectorProps) {
  const [showManageDialog, setShowManageDialog] = useState(false);

  const handleManageClick = () => {
    setShowManageDialog(true);
  };

  const handlePresetsChange = () => {
    onPresetsChange();
    if (onShiftsChange) onShiftsChange();
    if (onStatsRefresh) onStatsRefresh();
  };

  return (
    <>
      <PresetList
        calendars={calendars}
        calendarId={calendarId}
        presets={presets}
        selectedPresetId={selectedPresetId}
        onSelectPreset={onSelectPreset}
        onCreateNew={handleManageClick}
        onManageClick={handleManageClick}
        onViewSettingsClick={onViewSettingsClick}
        hidePresetHeader={hidePresetHeader}
        onHidePresetHeaderChange={onHidePresetHeaderChange}
        hideManageButton={hideManageButton}
      />

      <PresetManageSheet
        open={showManageDialog}
        onOpenChange={setShowManageDialog}
        calendarId={calendarId}
        presets={presets}
        onPresetsChange={handlePresetsChange}
      />
    </>
  );
}
