"use client";

import { ShiftPreset } from "@/lib/db/schema";
import { CalendarWithCount } from "@/lib/types";
import { useState } from "react";
import { PresetList } from "@/components/preset-list";
import { PresetManageSheet } from "@/components/preset-manage-sheet";
import { usePasswordProtection } from "@/hooks/usePasswordProtection";

interface PresetSelectorProps {
  calendars: CalendarWithCount[];
  presets: ShiftPreset[];
  selectedPresetId?: string;
  onSelectPreset: (presetId: string | undefined) => void;
  onPresetsChange: () => void;
  onShiftsChange?: () => void;
  onStatsRefresh?: () => void;
  calendarId: string;
  onPasswordRequired: (action: () => Promise<void>) => void;
  onViewSettingsClick?: () => void;
  loading?: boolean;
  hidePresetHeader?: boolean;
  onHidePresetHeaderChange?: (hide: boolean) => void;
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
  onPasswordRequired,
  onViewSettingsClick,
  loading = false,
  hidePresetHeader = false,
  onHidePresetHeaderChange,
}: PresetSelectorProps) {
  const [showManageDialog, setShowManageDialog] = useState(false);

  const { withPasswordCheck } = usePasswordProtection({
    calendarId,
    onPasswordRequired,
  });

  const handleManageClick = async () => {
    await withPasswordCheck(async () => {
      setShowManageDialog(true);
    });
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
        onUnlock={() => onPasswordRequired(async () => {})}
        loading={loading}
        hidePresetHeader={hidePresetHeader}
        onHidePresetHeaderChange={onHidePresetHeaderChange}
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
